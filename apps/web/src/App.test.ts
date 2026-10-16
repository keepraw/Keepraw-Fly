import { expectTypeOf, it } from "vitest";
import type { ArchiveLoadState } from "./App";
import type { ArchiveLoadResult } from "./storage/adapter";

it("rejects full valid load results in retained load state", () => {
  // These assertions are checked by the workspace TypeScript check.
  type ValidResult = Extract<ArchiveLoadResult, { status: "valid" }>;
  type ValidState = Extract<ArchiveLoadState, { status: "valid" }>;
  expectTypeOf<ValidResult>().not.toExtend<ArchiveLoadState>();
  expectTypeOf<Omit<ValidState, "document">>().toEqualTypeOf<
    Omit<ValidResult, "document">
  >();
});

it("preserves every non-valid load result and both startup states", () => {
  type NonValidResult = Exclude<ArchiveLoadResult, { status: "valid" }>;
  expectTypeOf<Exclude<ArchiveLoadState, { status: "valid" }>>().toEqualTypeOf<
    NonValidResult | { readonly status: "loading" | "read-error" }
  >();
});
