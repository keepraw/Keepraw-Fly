import { afterEach, describe, expect, it, vi } from "vitest";
import {
  finishImportPreflight,
  runImportPreflight,
} from "./import-preflight-work";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("cooperative import preflight", () => {
  it("yields before work and after the time budget, preserving order and result", async () => {
    vi.useFakeTimers();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const visited: number[] = [];
    function* rows() {
      for (let i = 0; i < 10; i++) {
        visited.push(i);
        elapsed += 3;
        yield;
      }
      return "complete";
    }
    const result = runImportPreflight(rows());
    expect(visited).toEqual([]);
    vi.advanceTimersToNextTimer();
    await Promise.resolve();
    expect(visited).toEqual([0, 1, 2]);
    vi.advanceTimersToNextTimer();
    await Promise.resolve();
    expect(visited).toEqual([0, 1, 2, 3, 4, 5]);
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe(finishImportPreflight(rows()));
  });

  it("stops cancelled work without consuming further rows", async () => {
    vi.useFakeTimers();
    let elapsed = 0;
    vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const visited: number[] = [];
    const cleanup = vi.fn();
    function* rows() {
      try {
        for (let i = 0; i < 20; i++) {
          visited.push(i);
          elapsed += 8;
          yield;
        }
        return 20;
      } finally {
        cleanup();
      }
    }
    const controller = new AbortController();
    const result = runImportPreflight(rows(), controller.signal);
    const rejection = expect(result).rejects.toMatchObject({
      name: "AbortError",
    });
    vi.advanceTimersToNextTimer();
    await Promise.resolve();
    expect(visited).toEqual([0]);
    controller.abort();
    await vi.runAllTimersAsync();
    await rejection;
    expect(visited).toEqual([0]);
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("does not start work cancelled before its first slice", async () => {
    const controller = new AbortController();
    const visit = vi.fn();
    function* rows() {
      visit();
      yield;
      return 1;
    }
    const result = runImportPreflight(rows(), controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(visit).not.toHaveBeenCalled();
  });
});
