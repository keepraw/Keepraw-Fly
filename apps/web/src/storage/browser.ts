import Dexie, { type EntityTable } from "dexie";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type {
  ArchiveKind,
  ArchiveLoadResult,
  SettingsStore,
  StorageAdapter,
} from "./adapter";
import { normalizeViewerSettings, type ViewerSettings } from "./types";
import { ArchiveConflictError } from "./conflict";

export type PersistentStorageState =
  "checking" | "granted" | "available" | "unsupported" | "failed";

function storageManager(): StorageManager | undefined {
  return typeof navigator !== "undefined" ? navigator.storage : undefined;
}

type PersistentStorageManager = StorageManager & {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
};

export async function persistentStorageState(): Promise<
  Exclude<PersistentStorageState, "checking">
> {
  try {
    const persistent = storageManager() as PersistentStorageManager | undefined;
    if (typeof persistent?.persisted !== "function") return "unsupported";
    return (await persistent.persisted())
      ? "granted"
      : typeof persistent.persist === "function"
        ? "available"
        : "unsupported";
  } catch {
    return "failed";
  }
}

export async function requestPersistentStorage(): Promise<
  Exclude<PersistentStorageState, "checking">
> {
  try {
    const persistent = storageManager() as PersistentStorageManager | undefined;
    if (typeof persistent?.persisted !== "function") return "unsupported";
    if (await persistent.persisted()) return "granted";
    if (typeof persistent.persist !== "function") return "unsupported";
    return (await persistent.persist()) ? "granted" : "available";
  } catch {
    return "failed";
  }
}

interface DocumentRecord {
  key: "active";
  document: unknown;
  kind?: ArchiveKind;
  updatedAt: string;
}

interface SettingsRecord {
  key: "viewer" | "archive-revision";
  settings?: ViewerSettings;
  revision?: string;
}

class KeeprawFlyDatabase extends Dexie {
  documents!: EntityTable<DocumentRecord, "key">;
  preferences!: EntityTable<SettingsRecord, "key">;

  constructor(databaseName = "keepraw-fly") {
    super(databaseName);
    this.version(1).stores({
      documents: "&key, updatedAt",
      preferences: "&key",
    });
  }
}

export class BrowserStorageAdapter implements StorageAdapter, SettingsStore {
  private readonly database: KeeprawFlyDatabase;
  // null is the pre-revision format (including an empty database).
  private archiveRevision: string | null = null;
  private conflicted = false;
  private pendingLoad?: Promise<ArchiveLoadResult>;

  constructor(databaseName?: string) {
    this.database = new KeeprawFlyDatabase(databaseName);
  }

  loadDocument(): Promise<ArchiveLoadResult> {
    // React StrictMode can start two reads; migrate a legacy archive only once.
    this.pendingLoad ??= this.readDocument().finally(() => {
      this.pendingLoad = undefined;
    });
    return this.pendingLoad;
  }

  private async readDocument(): Promise<ArchiveLoadResult> {
    const [record, revision] = await this.database.transaction(
      "r",
      this.database.documents,
      this.database.preferences,
      async () =>
        [
          await this.database.documents.get("active"),
          (await this.database.preferences.get("archive-revision"))?.revision ??
            null,
        ] as const,
    );
    this.archiveRevision = revision ?? (record ? JSON.stringify(record) : null);
    this.conflicted = false;
    if (!record) return { status: "empty" };
    const kind = record.kind ?? "personal";
    const { validateAndMigrateKeeprawFly } =
      await import("@keepraw-fly/validator");
    const result = validateAndMigrateKeeprawFly(record.document);
    if (!result.valid) {
      const recoverySource = {
        rawDocument: record.document,
        kind,
        updatedAt: record.updatedAt,
      };
      return result.reason === "unsupported-version"
        ? {
            status: "unsupported-version",
            ...recoverySource,
            formatVersion: result.formatVersion,
          }
        : { status: "invalid", ...recoverySource, issues: result.issues };
    }
    if (result.migrations.length) {
      try {
        await this.saveDocument(result.data, kind);
      } catch (error) {
        // No local edits exist during migration. Adopt the winning committed
        // archive rather than presenting the stale migration as a recovery source.
        if (error instanceof ArchiveConflictError) return this.readDocument();
        return {
          status: "invalid",
          rawDocument: record.document,
          kind,
          updatedAt: record.updatedAt,
          issues: [
            {
              path: "/",
              keyword: "migration",
              message: "The migrated archive could not be saved safely.",
            },
          ],
        };
      }
    }
    return {
      status: "valid",
      document: result.data,
      kind,
      updatedAt: record.updatedAt,
    };
  }

  async loadArchiveKind(): Promise<ArchiveKind | null> {
    const record = await this.database.documents.get("active");
    return record ? (record.kind ?? "personal") : null;
  }

  async saveDocument(
    document: KeeprawFlyDocument,
    kind: ArchiveKind = "personal",
  ): Promise<void> {
    const record: DocumentRecord = {
      key: "active",
      document: structuredClone(document),
      kind,
      updatedAt: new Date().toISOString(),
    };
    await this.commitArchive(() => this.database.documents.put(record));
  }

  async clearDocument(): Promise<void> {
    await this.commitArchive(() => this.database.documents.delete("active"));
  }

  private async commitArchive(write: () => Promise<unknown>): Promise<void> {
    if (this.conflicted) throw new ArchiveConflictError();
    const expectedRevision = this.archiveRevision;
    const nextRevision = crypto.randomUUID();
    try {
      await this.database.transaction(
        "rw",
        this.database.documents,
        this.database.preferences,
        async () => {
          const metadata =
            await this.database.preferences.get("archive-revision");
          const record = await this.database.documents.get("active");
          // Legacy records have no generation yet; compare their exact source.
          const current =
            metadata?.revision ?? (record ? JSON.stringify(record) : null);
          if (current !== expectedRevision) throw new ArchiveConflictError();
          await write();
          // Keep this generation after deletion: stale tabs must not resurrect it.
          // It is device metadata and never enters portable JSON backups.
          await this.database.preferences.put({
            key: "archive-revision",
            revision: nextRevision,
          });
        },
      );
      // Only acknowledge a generation after the entire transaction commits.
      this.archiveRevision = nextRevision;
    } catch (error) {
      if (error instanceof ArchiveConflictError) this.conflicted = true;
      throw error;
    }
  }

  async loadSettings(): Promise<ViewerSettings | null> {
    const settings = (await this.database.preferences.get("viewer"))?.settings;
    return settings ? normalizeViewerSettings(settings) : null;
  }

  async saveSettings(settings: ViewerSettings): Promise<void> {
    await this.database.preferences.put({
      key: "viewer",
      settings: structuredClone(settings),
    });
  }

  async deleteDatabaseForTests(): Promise<void> {
    this.database.close();
    await Dexie.delete(this.database.name);
  }
}

export const browserStorage = new BrowserStorageAdapter();
