import Dexie, { type EntityTable } from "dexie";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ArchiveKind, SettingsStore, StorageAdapter } from "./adapter";
import type { ViewerSettings } from "./types";

interface DocumentRecord {
  key: "active";
  document: KeeprawFlyDocument;
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

  async loadDocument(): Promise<KeeprawFlyDocument | null> {
    return (await this.database.documents.get("active"))?.document ?? null;
  }

  async loadArchiveKind(): Promise<ArchiveKind | null> {
    const record = await this.database.documents.get("active");
    return record ? record.kind ?? "personal" : null;
  }

  async saveDocument(document: KeeprawFlyDocument, kind: ArchiveKind = "personal"): Promise<void> {
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
