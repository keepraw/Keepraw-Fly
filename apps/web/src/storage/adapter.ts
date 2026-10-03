import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { ValidationIssue } from "@keepraw-fly/validator";
import type { ViewerSettings } from "./types";

export type ArchiveKind = "personal" | "demo";

export type ArchiveLoadResult =
  | { readonly status: "empty" }
  | {
      readonly status: "valid";
      readonly document: KeeprawFlyDocument;
      readonly kind: ArchiveKind;
      readonly updatedAt: string;
    }
  | {
      readonly status: "invalid";
      /** Read-only recovery source; never pass it through repair or persistence. */
      readonly rawDocument: unknown;
      readonly kind: ArchiveKind;
      readonly updatedAt: string;
      readonly issues: ValidationIssue[];
    }
  | {
      readonly status: "unsupported-version";
      readonly rawDocument: unknown;
      readonly kind: ArchiveKind;
      readonly updatedAt: string;
      readonly formatVersion?: string;
    };

export interface StorageAdapter {
  loadDocument(): Promise<ArchiveLoadResult>;
  loadArchiveKind(): Promise<ArchiveKind | null>;
  saveDocument(document: KeeprawFlyDocument, kind?: ArchiveKind): Promise<void>;
  clearDocument(): Promise<void>;
}

export interface SettingsStore {
  loadSettings(): Promise<ViewerSettings | null>;
  saveSettings(settings: ViewerSettings): Promise<void>;
}
