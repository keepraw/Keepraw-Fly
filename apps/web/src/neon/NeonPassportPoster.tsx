import { useEffect, useRef, useState } from "react";
import {
  createNeonPassportExport,
  NEON_POSTER_SIZE,
  renderNeonPassport,
} from "./neon-passport-canvas";
import { preparePosterFonts } from "../share/poster-fonts";
import { NEON_AVIATION } from "./neon-aviation-tokens";

type NeonExportWindow = Window & {
  __neonPassportExport?: (scale: number) => string;
};

export function NeonPassportPoster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exportWindow = window as NeonExportWindow;
    let active = true;
    void Promise.allSettled([
      document.fonts.load('600 56px "Barlow Semi Condensed"'),
      document.fonts.load('400 13px "IBM Plex Mono"'),
      preparePosterFonts("en", {
        sample: "FLIGHT PASSPORT · PASSEPORT · 护照",
      }),
    ] as const).then(([, , fonts]) => {
      if (!active) return;
      const cjkFontFamily =
        fonts.status === "fulfilled"
          ? fonts.value.families.text
          : NEON_AVIATION.type.family.label;
      renderNeonPassport(canvas, window.devicePixelRatio || 1, cjkFontFamily);
      canvas.dataset.ready = "true";
      exportWindow.__neonPassportExport = (scale) =>
        createNeonPassportExport(scale, cjkFontFamily);
      setReady(true);
    });
    return () => {
      active = false;
      delete exportWindow.__neonPassportExport;
    };
  }, []);

  return (
    <figure
      className="neon-passport-sample"
      data-neon-passport-ready={ready ? "true" : "false"}
    >
      <canvas
        ref={canvasRef}
        className="neon-passport-canvas"
        width={NEON_POSTER_SIZE.width}
        height={NEON_POSTER_SIZE.height}
        role="img"
        aria-label="Fictional Keepraw Fly flight passport poster, specimen"
      />
      <figcaption>
        Fictional portfolio specimen · 1080 × 1350 artboard
      </figcaption>
    </figure>
  );
}
