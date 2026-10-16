export type ImportPreflightWork<T> = Generator<void, T, void>;

export function finishImportPreflight<T>(work: ImportPreflightWork<T>): T {
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}

const yieldToMain = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

export async function runImportPreflight<T>(
  work: ImportPreflightWork<T>,
  signal?: AbortSignal,
): Promise<T> {
  // Allow the pending preview to paint before starting, then keep row work in
  // small slices. A row and a single duplicate lookup remain indivisible.
  await yieldToMain();
  let started = performance.now();
  try {
    for (;;) {
      signal?.throwIfAborted();
      const step = work.next();
      if (step.done) return step.value;
      if (performance.now() - started >= 8) {
        await yieldToMain();
        started = performance.now();
      }
    }
  } finally {
    work.return(undefined as never);
  }
}
