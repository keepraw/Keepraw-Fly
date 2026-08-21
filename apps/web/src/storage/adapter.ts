import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ViewerSettings } from "./types";

export interface StorageAdapter {
  loadDocument(): Promise<KeeprawFlyDocument | null>;
  saveDocument(document: KeeprawFlyDocument): Promise<void>;
  clearDocument(): Promise<void>;
}

export interface SettingsStore {
  loadSettings(): Promise<ViewerSettings | null>;
  saveSettings(settings: ViewerSettings): Promise<void>;
}

