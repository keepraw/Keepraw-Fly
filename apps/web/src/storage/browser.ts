import Dexie, { type EntityTable } from "dexie";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type {
  ArchiveKind,
  ArchiveLoadResult,
  SettingsStore,
  StorageAdapter,
} from "./adapter";
import type { ViewerSettings } from "./types";

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
  key: "viewer";
  settings: ViewerSettings;
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

  constructor(databaseName?: string) {
    this.database = new KeeprawFlyDatabase(databaseName);
  }

  async loadDocument(): Promise<ArchiveLoadResult> {
    const record = await this.database.documents.get("active");
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
      } catch {
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
    await this.database.documents.put({
      key: "active",
      document: structuredClone(document),
      kind,
      updatedAt: new Date().toISOString(),
    });
  }

  async clearDocument(): Promise<void> {
    await this.database.documents.delete("active");
  }

  async loadSettings(): Promise<ViewerSettings | null> {
    return (await this.database.preferences.get("viewer"))?.settings ?? null;
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
