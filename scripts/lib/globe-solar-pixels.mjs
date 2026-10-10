// Runs in a browser against screenshots of the actual WebGL canvas.
export async function solarPixels({
  diagnostic,
  lit,
  unlit,
  scene,
  sun,
  width,
}) {
  const decode = async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    return {
      pixels: context.getImageData(0, 0, image.width, image.height).data,
      w: image.width,
      h: image.height,
    };
  };
  const mask = await decode(diagnostic),
    on = await decode(lit),
    off = await decode(unlit);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const normalize = (a) => a.map((v) => v / Math.hypot(...a));
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const forward = normalize(scene.camera.map((v) => -v));
  const right = normalize(cross(forward, [0, 1, 0])),
    up = cross(right, forward);
  const tan = Math.tan((scene.fov * Math.PI) / 360),
    aspect = mask.w / mask.h;
  const groups = Object.fromEntries(
    ["day", "twilight", "night"].map((k) => [
      k,
      { count: 0, luminance: 0, emission: 0, changed: 0 },
    ]),
  );
  let signature = 2166136261;
  let compared = 0,
    mismatched = 0;
  // Reconstruct world normals independently of GLSL, including perspective.
  for (let y = 1; y < mask.h; y += 2)
    for (let x = 1; x < mask.w; x += 2) {
      const vx = ((2 * (x + 0.5)) / mask.w - 1) * tan * aspect,
        vy = (1 - (2 * (y + 0.5)) / mask.h) * tan;
      const ray = normalize(
        forward.map((v, i) => v + right[i] * vx + up[i] * vy),
      );
      const b = dot(scene.camera, ray),
        discriminant = b * b - dot(scene.camera, scene.camera) + 1;
      if (discriminant < 0.12) continue; // avoid antialiased/grazing boundary
      const t = -b - Math.sqrt(discriminant),
        normal = normalize(scene.camera.map((v, i) => v + t * ray[i]));
      const solar = dot(normal, sun);
      if (Math.abs(Math.abs(solar) - width) < 0.01) continue;
      const expected =
        solar > width ? "day" : solar < -width ? "night" : "twilight";
      const i = (y * mask.w + x) * 4,
        rgb = Array.from(mask.pixels.slice(i, i + 3));
      const actual =
        rgb[1] > rgb[0] && rgb[1] > rgb[2]
          ? "day"
          : rgb[2] > rgb[0]
            ? "night"
            : "twilight";
      signature =
        Math.imul(
          signature ^ { day: 1, twilight: 2, night: 3 }[actual],
          16777619,
        ) >>> 0;
      compared++;
      if (actual !== expected) mismatched++;
      const group = groups[expected];
      group.count++;
      const lum = (p) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      group.luminance += lum(off.pixels);
      group.emission += lum(on.pixels) - lum(off.pixels);
      if (
        Math.max(
          ...[0, 1, 2].map((c) =>
            Math.abs(on.pixels[i + c] - off.pixels[i + c]),
          ),
        ) > 2
      )
        group.changed++;
    }
  for (const g of Object.values(groups)) {
    g.luminance /= g.count;
    g.emission /= g.count;
  }
  return { groups, compared, mismatched, signature };
}
