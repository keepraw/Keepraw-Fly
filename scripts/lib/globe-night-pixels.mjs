// Actual display pixels, after ACES and sRGB, grouped by independent world rays.
export async function nightPixels({ on, off, routes, scene, regions }) {
  const decode = async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    return {
      data: ctx.getImageData(0, 0, c.width, c.height).data,
      w: c.width,
      h: c.height,
    };
  };
  const a = await decode(on),
    b = await decode(off),
    r = routes ? await decode(routes) : null;
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
    aspect = a.w / a.h;
  const blank = () => ({
    count: 0,
    changed: 0,
    nearWhite: 0,
    delta: [],
    luminance: [],
    routeDelta: [],
  });
  const result = Object.fromEntries(
    regions.map((r) => [
      r.id,
      { all: blank(), core: blank(), periphery: blank() },
    ]),
  );
  const global = blank();
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const vx =
        ((2 * (x + 0.5)) / a.w - 1 + 2 * scene.viewOffset.x) * tan * aspect;
      const vy = (1 - (2 * (y + 0.5)) / a.h - 2 * scene.viewOffset.y) * tan;
      const ray = norm(f.map((v, i) => v + right[i] * vx + up[i] * vy));
      const d = dot(scene.camera, ray),
        disc = d * d - dot(scene.camera, scene.camera) + 1;
      if (disc < 0.12) continue;
      const t = -d - Math.sqrt(disc),
        n = norm(scene.camera.map((v, i) => v + t * ray[i]));
      const lon = (Math.atan2(-n[2], n[0]) * 180) / Math.PI,
        lat = (Math.asin(n[1]) * 180) / Math.PI;
      const i = (y * a.w + x) * 4,
        lum = (p) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      const delta = lum(a.data) - lum(b.data),
        changed =
          Math.max(
            ...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c])),
          ) > 2;
      const add = (g) => {
        g.count++;
        g.changed += changed;
        g.nearWhite += Math.min(...a.data.slice(i, i + 3)) >= 240;
        g.delta.push(delta);
        g.luminance.push(lum(a.data));
        if (r) {
          const rd = lum(r.data) - lum(a.data);
          if (
            Math.max(
              ...[0, 1, 2].map((c) => Math.abs(r.data[i + c] - a.data[i + c])),
            ) > 2
          )
            g.routeDelta.push(Math.abs(rd));
        }
      };
      add(global);
      for (const region of regions) {
        const [w, s, e, n] = region.bounds;
        if (lon < w || lon > e || lat < s || lat > n) continue;
        const core = region.cores.some(
          ([x, y]) => Math.abs(lon - x) <= 0.25 && Math.abs(lat - y) <= 0.25,
        );
        add(result[region.id].all);
        add(result[region.id][core ? "core" : "periphery"]);
      }
    }
  const stats = (values) => {
    values.sort((a, b) => a - b);
    return {
      mean: values.reduce((a, b) => a + b, 0) / (values.length || 1),
      p50: values[Math.floor(values.length * 0.5)] ?? 0,
      p90: values[Math.floor(values.length * 0.9)] ?? 0,
      p99: values[Math.floor(values.length * 0.99)] ?? 0,
      max: values.at(-1) ?? 0,
    };
  };
  const summarize = (g) => ({
    count: g.count,
    changed: g.changed,
    coveragePercent: (100 * g.changed) / (g.count || 1),
    nearWhite: g.nearWhite,
    delta: stats(g.delta),
    luminance: stats(g.luminance),
    routeDelta: stats(g.routeDelta),
    routeChanged: g.routeDelta.length,
  });
  return {
    units:
      "sRGB weighted display values 0..255; city visibility = any channel difference >2; near-white = every channel >=240",
    global: summarize(global),
    regions: Object.fromEntries(
      Object.entries(result).map(([k, v]) => [
        k,
        Object.fromEntries(
          Object.entries(v).map(([k, v]) => [k, summarize(v)]),
        ),
      ]),
    ),
  };
}
