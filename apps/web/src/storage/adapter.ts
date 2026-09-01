import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ViewerSettings } from "./types";

export type ArchiveKind = "personal" | "demo";

export interface StorageAdapter {
  loadDocument(): Promise<KeeprawFlyDocument | null>;
  loadArchiveKind(): Promise<ArchiveKind | null>;
  saveDocument(document: KeeprawFlyDocument, kind?: ArchiveKind): Promise<void>;
  clearDocument(): Promise<void>;
}

export interface SettingsStore {
  loadSettings(): Promise<ViewerSettings | null>;
  saveSettings(settings: ViewerSettings): Promise<void>;
}
