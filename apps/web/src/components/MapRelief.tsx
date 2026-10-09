import { useEffect, useState } from "react";
import { projectionAt, WORLD_HEIGHT, WORLD_WIDTH } from "../data/map-geometry";
import reliefSource from "../assets/map-relief.webp";

// Cache only a few geographic centers. Panning/zooming transforms the same
// image together with the vector map, without recalculating pixels per frame.
const projectedRelief = new Map<number, Promise<string>>();
let sourcePixels: Promise<ImageData> | undefined;

function loadPixels() {
  sourcePixels ??= new Promise<ImageData>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = reject;
    image.src = reliefSource;
  });
  return sourcePixels;
}

async function projectRelief(longitude: number) {
  const source = await loadPixels();
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext("2d")!;
  const output = context.createImageData(canvas.width, canvas.height);
  const projection = projectionAt(longitude);
  for (let y = 0; y < canvas.height; y++) {
    // Yield between strips so input and map navigation remain responsive.
    if (y % 64 === 0)
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    for (let x = 0; x < canvas.width; x++) {
      const coordinate = projection.invert!([
        ((x + 0.5) / canvas.width) * WORLD_WIDTH,
        ((y + 0.5) / canvas.height) * WORLD_HEIGHT,
      ]);
      if (!coordinate || Math.abs(coordinate[1]) > 90) continue;
      const longitude = (((coordinate[0] + 180) % 360) + 360) % 360;
      const sourceX = Math.min(
        source.width - 1,
        Math.floor((longitude / 360) * source.width),
      );
      const sourceY = Math.min(
        source.height - 1,
        Math.max(0, Math.floor(((90 - coordinate[1]) / 180) * source.height)),
      );
      const value = source.data[(sourceY * source.width + sourceX) * 4]!;
      const index = (y * canvas.width + x) * 4;
      output.data[index] = value;
      output.data[index + 1] = value;
      output.data[index + 2] = value;
      output.data[index + 3] = 255;
    }
  }
  context.putImageData(output, 0, 0);
  return canvas.toDataURL("image/png");
}

export function MapRelief({
  centerLongitude,
  lightFilter,
  darkFilter,
}: {
  centerLongitude: number;
  lightFilter: string;
  darkFilter: string;
}) {
  const [image, setImage] = useState<string>();
  useEffect(() => {
    let active = true;
    setImage(undefined);
    const key = Math.round(centerLongitude * 1000) / 1000;
    if (!projectedRelief.has(key)) {
      if (projectedRelief.size >= 3)
        projectedRelief.delete(projectedRelief.keys().next().value!);
      projectedRelief.set(key, projectRelief(centerLongitude));
    }
    projectedRelief
      .get(key)!
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        projectedRelief.delete(key);
      });
    return () => {
      active = false;
    };
  }, [centerLongitude]);
  return image ? (
    <g aria-hidden="true">
      <image
        className="map-relief-texture is-light"
        href={image}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        filter={`url(#${lightFilter})`}
      />
      <image
        className="map-relief-texture is-dark"
        href={image}
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        filter={`url(#${darkFilter})`}
      />
    </g>
  ) : null;
}
