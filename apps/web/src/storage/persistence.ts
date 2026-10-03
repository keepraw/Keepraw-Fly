export type PersistenceState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; savedAt: string }
  | { status: "error"; error: "storage" };

/** Serialize immutable snapshots, and report only the latest requested revision. */
export function createPersistenceQueue<Snapshot>(
  write: (snapshot: Snapshot) => Promise<void>,
  onStateChange: (state: PersistenceState) => void,
) {
  let state: PersistenceState = { status: "idle" };
  let revision = 0;
  let latestSnapshot: Snapshot;
  let tail: Promise<unknown> = Promise.resolve();

  function changeState(next: PersistenceState) {
    state = next;
    onStateChange(next);
  }

  function save(snapshot: Snapshot): Promise<boolean> {
    latestSnapshot = snapshot;
    const currentRevision = ++revision;
    changeState({ status: "saving" });

    // Catch each write so a failure cannot block later saves or retries.
    const result = tail.then(async () => {
      try {
        await write(snapshot);
        if (currentRevision === revision) {
          changeState({ status: "saved", savedAt: new Date().toISOString() });
        }
        return true;
      } catch {
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
    return state.status === "error" ? save(latestSnapshot) : Promise.resolve(false);
  }

  return { save, retry };
}
