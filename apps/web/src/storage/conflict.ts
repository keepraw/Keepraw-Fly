/** A stale archive must never enter the retryable storage-failure path. */
export class ArchiveConflictError extends Error {
  constructor() {
    super("archive-conflict");
    this.name = "ArchiveConflictError";
  }
}
