import { expect, type Locator } from "@playwright/test";

/** Read a row once after scrolling/clipping checks, retaining every pair assertion. */
export async function expectFlightRowGeometry(row: Locator, desktop: boolean) {
  const pairs: [string, string][] = [
    ...[
      ".airline-logo",
      ".flight-number",
      ".flight-route-cities",
      ".flight-route-codes",
      ".flight-time-column",
    ].map((selector): [string, string] => [selector, ".flight-date"]),
    [".flight-route-cities", ".flight-number"],
    [".flight-route-cities", ".flight-time-column"],
    [".flight-route-codes", ".flight-time-column"],
  ];
  const snapshot = await row.evaluate(
    (element, { pairs, desktop }) => {
      const boxes: Record<
        string,
        { x: number; y: number; width: number; height: number } | null
      > = {};
      for (const selector of new Set(pairs.flat())) {
        const matches = element.querySelectorAll<HTMLElement>(selector);
        if (matches.length !== 1)
          throw new Error(`Expected one ${selector}, found ${matches.length}`);
        const target = matches[0]!;
        const rect = target.getBoundingClientRect();
        const style = getComputedStyle(target);
        boxes[selector] =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.visibility !== "collapse"
            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            : null;
      }
      const date = element.querySelector<HTMLElement>(".flight-date")!;
      const archive = element.closest<HTMLElement>(".passport-archive-scroll");
      if (desktop && !archive) throw new Error("Missing archive scrollport");
      return {
        boxes,
        dateFits: date.scrollWidth <= date.clientWidth,
        scrollLeft: archive?.scrollLeft,
      };
    },
    { pairs, desktop },
  );
  if (desktop) expect(snapshot.scrollLeft).toBe(0);
  expect(snapshot.dateFits).toBe(true);
  for (const [first, second] of pairs) {
    const a = snapshot.boxes[first];
    const b = snapshot.boxes[second];
    expect(a, `${first} must have a rendered rectangle`).not.toBeNull();
    expect(b, `${second} must have a rendered rectangle`).not.toBeNull();
    expect(
      a!.x + a!.width <= b!.x ||
        b!.x + b!.width <= a!.x ||
        a!.y + a!.height <= b!.y ||
        b!.y + b!.height <= a!.y,
      `${first} and ${second}: rendered rectangles must not overlap`,
    ).toBe(true);
  }
}
