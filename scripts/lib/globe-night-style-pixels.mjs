// Actual emission-only display pixels after the product shader's ACES/sRGB path.
export async function nightStylePixels({ image, scene, exclusions = [] }) {
  const img = new Image();
  img.src = `data:image/png;base64,${image}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const light = [],
    accent = [],
    warm = [];
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
    norm = (a) => a.map((v) => v / Math.hypot(...a));
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const f = norm(scene.camera.map((v) => -v)),
    right = norm(cross(f, [0, 1, 0])),
    up = cross(right, f);
  const tan = Math.tan((scene.fov * Math.PI) / 360),
    aspect = canvas.width / canvas.height;
  let nearWhite = 0,
    clipped = 0,
    total = 0,
    count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % canvas.width,
      y = Math.floor(i / 4 / canvas.width);
    if (
      exclusions.some(
        (r) =>
          x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
      )
    )
      continue;
    const vx =
      ((2 * (x + 0.5)) / canvas.width - 1 + 2 * scene.viewOffset.x) *
      tan *
      aspect;
    const vy =
      (1 - (2 * (y + 0.5)) / canvas.height - 2 * scene.viewOffset.y) * tan;
    const ray = norm(f.map((v, i) => v + right[i] * vx + up[i] * vy));
    const d = dot(scene.camera, ray),
      disc = d * d - dot(scene.camera, scene.camera) + 1;
    if (disc < 0.12) continue; // exclude space, atmospheric rim and HTML review controls
    count++;
    const [r, g, b] = pixels.slice(i, i + 3),
      lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    total += lum;
    if (r > 2 || g > 2 || b > 2) {
      light.push(lum);
      warm.push((r - b) / Math.max(r, 1));
    }
    if (r > 120) accent.push(lum);
    nearWhite += Math.min(r, g, b) >= 240;
    clipped += Math.max(r, g, b) >= 254;
  }
  const stats = (a) => {
    a.sort((a, b) => a - b);
    return {
      count: a.length,
      mean: a.reduce((a, b) => a + b, 0) / (a.length || 1),
      p50: a[Math.floor(a.length * 0.5)] ?? 0,
      p95: a[Math.floor(a.length * 0.95)] ?? 0,
      max: a.at(-1) ?? 0,
    };
  };
  return {
    dimensions: [canvas.width, canvas.height],
    count,
    meanLuminance: total / count,
    light: stats(light),
    accent: stats(accent),
    warmSeparation: stats(warm),
    nearWhite,
    clipped,
    units:
      "nongrazing sphere only; weighted sRGB 0..255; light:any channel>2; accent:red>120; warm separation:(R-B)/R",
  };
}
