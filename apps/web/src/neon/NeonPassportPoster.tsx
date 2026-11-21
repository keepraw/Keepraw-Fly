import { useEffect, useRef } from "react";
import {
  createNeonPassportExport,
  NEON_POSTER_SIZE,
  renderNeonPassport,
} from "./neon-passport-canvas";
import { preparePosterFonts } from "../share/poster-fonts";

type NeonExportWindow = Window & {
  __neonPassportExport?: (scale: number) => string;
};

export function NeonPassportPoster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const exportWindow = window as NeonExportWindow;
    let active = true;
    void Promise.all([
      document.fonts.load('600 56px "Barlow Semi Condensed"'),
      document.fonts.load('400 13px "IBM Plex Mono"'),
      preparePosterFonts("en", {
        sample: "FLIGHT PASSPORT · PASSEPORT · 护照",
      }),
    ]).then(([, , fonts]) => {
      if (!active) return;
      renderNeonPassport(
        canvas,
        window.devicePixelRatio || 1,
        fonts.families.text,
      );
      canvas.dataset.ready = "true";
      exportWindow.__neonPassportExport = (scale) =>
        createNeonPassportExport(scale, fonts.families.text);
    });
    return () => {
      active = false;
      delete exportWindow.__neonPassportExport;
    };
  }, []);

  return (
    <figure className="neon-passport-sample" data-neon-passport-ready="true">
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
