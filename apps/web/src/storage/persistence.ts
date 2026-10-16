import { ArchiveConflictError } from "./conflict";

export type PersistenceState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; savedAt: string }
  | { status: "conflict" }
  | { status: "error"; error: "storage" };

/** Serialize immutable snapshots, and report only the latest requested revision. */
export function createPersistenceQueue<Snapshot>(
  write: (snapshot: Snapshot) => Promise<void>,
  onStateChange: (state: PersistenceState) => void,
  canWrite: () => boolean = () => true,
) {
  let state: PersistenceState = { status: "idle" };
  let revision = 0;
  let latestSnapshot: Snapshot;
  let tail: Promise<unknown> = Promise.resolve();
  let conflicted = false;

  function changeState(next: PersistenceState) {
    state = next;
    onStateChange(next);
  }

  function save(snapshot: Snapshot): Promise<boolean> {
    // Rejected requests must never become snapshots that a later retry can save.
    if (conflicted || !canWrite()) return Promise.resolve(false);
    latestSnapshot = snapshot;
    const currentRevision = ++revision;
    changeState({ status: "saving" });

    // Catch each write so a failure cannot block later saves or retries.
    const result = tail.then(async () => {
      // Permission may change while this snapshot waits behind an older write.
      if (conflicted) return false;
      if (!canWrite()) {
        if (currentRevision === revision) changeState({ status: "idle" });
        return false;
      }
      try {
        await write(snapshot);
        if (currentRevision === revision) {
          changeState({ status: "saved", savedAt: new Date().toISOString() });
        }
        return true;
      } catch (error) {
        if (error instanceof ArchiveConflictError) {
          // Invalidate every pending snapshot, even if this is an older write.
          conflicted = true;
          latestSnapshot = undefined as Snapshot;
          changeState({ status: "conflict" });
          return false;
        }
        if (currentRevision === revision) {
          changeState({ status: "error", error: "storage" });
        }
        return false;
      }
    });
    tail = result;
    return result;
  }

  function retry(): Promise<boolean> {
    // save() changes state synchronously, also preventing repeated Retry clicks.
    return state.status === "error"
      ? save(latestSnapshot)
      : Promise.resolve(false);
  }

  async function reset() {
    await tail;
    conflicted = false;
    latestSnapshot = undefined as Snapshot;
    changeState({ status: "idle" });
  }

  return { save, retry, reset };
}
