import type { ShareComposer } from "./share-renderer";
import { applyTextStyle, drawShareTextBlock } from "./share-text";

/**
 * Neutral verification composition for render checks. It is deliberately
 * NOT a poster template (no Flight Passport / Year in Flight design): it only
 * exercises the gradient, Earth layer, explicit text styles, wrapping and
 * dividers that the stage 3B templates will build on.
 */
export function verificationComposer(text: {
  title: string;
  body: string;
}): ShareComposer {
  return (context, { model, plan, fonts, drawGlobe }) => {
    const { width, height } = plan;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, plan.theme === "dark" ? "#0a1424" : "#f2f6fb");
    gradient.addColorStop(1, plan.theme === "dark" ? "#04070d" : "#dfe8f2");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    drawGlobe();
    const ink = plan.theme === "dark" ? "#f4f7fb" : "#16202c";
    const muted = plan.theme === "dark" ? "#9fb0c4" : "#4a5a6c";
    const margin = 72;
    applyTextStyle(context, fonts, {
      size: 22,
      weight: 600,
      color: muted,
      letterSpacing: 2,
    });
    context.fillText("RENDER CHECK · NOT A TEMPLATE", margin, 96);
    drawShareTextBlock(
      context,
      fonts,
      text.title,
      margin,
      160,
      width - margin * 2,
      {
        size: 56,
        weight: 600,
        color: ink,
        lineHeight: 68,
        maxLines: 2,
      },
    );
    const statsY = height - 210;
    context.fillStyle = muted;
    context.fillRect(margin, statsY - 56, width - margin * 2, 1);
    const stats = [
      String(model.statistics.flights),
      Math.round(model.statistics.distanceKilometers).toLocaleString("en-US"),
      String(model.statistics.airports),
    ];
    stats.forEach((value, index) => {
      applyTextStyle(context, fonts, {
        size: 64,
        weight: 600,
        color: ink,
        align: "left",
        baseline: "top",
      });
      context.fillText(value, margin + index * 320, statsY);
    });
    drawShareTextBlock(
      context,
      fonts,
      text.body,
      margin,
      height - 80,
      width - margin * 2,
      { size: 26, weight: 400, color: muted, lineHeight: 34, maxLines: 1 },
    );
  };
}
