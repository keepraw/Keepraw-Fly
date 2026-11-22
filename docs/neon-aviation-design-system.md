# Neon Aviation design system / 霓虹航空视觉系统

This began as a development-only visual study with fictional flight counts and
passport statistics. Its map themes and shared 2D scene now drive the production
Passport, Flight Detail maps and Flight Passport export (see the
[2D map architecture](map-2d-architecture.md)); the 3D Globe has been removed.
The Neon Lab route itself remains development-only.

本页最初是仅供开发使用的视觉研究，航班数量与护照统计均为虚构数据。其地图主题与共享 2D
场景现已用于正式 Passport、航班详情地图和飞行护照导出（见
[2D 地图架构指南](map-2d-architecture.md)），3D Globe 已删除。Neon Lab 路由本身仍仅供开发使用。

## English

### Direction and boundaries

The direction pairs a deep indigo ocean with quiet land texture, thin geographic
structure, and pale route strokes. The visual reference informs layout and color
direction only; this system uses Keepraw Fly naming and original specimen
decorations. It intentionally excludes the reference's brand text, neon
tower/skyline illustration, flag stickers, and portrait.

The `/neon-lab` route is lazy-loaded only in Vite development mode and bypasses
archive startup. Its three samples are isolated under `.neon-aviation`:

- **World network (SVG):** sparse and seeded dense fictional routes, shared
  projection data, keyboard/pointer selection, clipped land hatch, and a capped
  route glow budget.
- **Great-circle detail (SVG):** a date-line-centered TPE–LAX view and a PVG–CDG
  comparison, with fictional local times and a route-distance estimate.
- **Flight passport (Canvas 2D):** `FLIGHT PASSPORT` as the main title, a
  multilingual passport line, and a smaller `KEEPRAW TRAVELER` holder line with
  route-derived hub markers and a full-width specimen MRZ. It exports
  1080 × 1350 artwork through the shared Canvas path adapter.

The theme source is
[`map2d/themes/neon-aviation.ts`](../apps/web/src/map2d/themes/neon-aviation.ts)
and it is registered through
[`theme-registry.ts`](../apps/web/src/map2d/theme-registry.ts). World and detail
SVG samples use `buildMapScene`, `segmentsToPath`, and
`mapThemeCssVariables`; the Canvas sample uses `buildMapScene`, `traceSegments`,
and tokens resolved explicitly from the registry. See the
[shared 2D architecture](map-2d-architecture.md) for identity and theme rules.

### Final shared tokens

RGBA rows list red, green, blue, and alpha channels. Lengths are CSS pixels at
zoom one unless the name says otherwise. Numeric state durations are
milliseconds; family stacks and letter spacing retain their CSS values.

| Token                        | Final value                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `color.backgroundTop`        | 27, 16, 64, 1                                                                    |
| `color.backgroundBottom`     | 11, 10, 38, 1                                                                    |
| `color.backgroundBloom`      | 92, 64, 214, 0.22                                                                |
| `color.ocean`                | 17, 13, 52, 1                                                                    |
| `color.land`                 | 58, 52, 138, 0.5                                                                 |
| `color.landHatch`            | 150, 140, 255, 0.58                                                              |
| `color.coastline`            | 150, 140, 255, 0.55                                                              |
| `color.border`               | 160, 150, 255, 0.16                                                              |
| `color.graticule`            | 150, 140, 255, 0.08                                                              |
| `color.routeBase`            | 196, 181, 255, 1                                                                 |
| `color.routeFrequent`        | 176, 220, 255, 1                                                                 |
| `color.routeHighlight`       | 236, 242, 255, 1                                                                 |
| `color.routeSelected`        | 255, 255, 255, 1                                                                 |
| `color.routeGlow`            | 150, 170, 255, 1                                                                 |
| `color.airport`              | 255, 214, 236, 1                                                                 |
| `color.airportHub`           | 255, 236, 246, 1                                                                 |
| `color.airportSelected`      | 255, 255, 255, 1                                                                 |
| `color.airportHalo`          | 255, 150, 210, 1                                                                 |
| `color.label`                | 244, 241, 255, 1                                                                 |
| `color.labelMuted`           | 184, 176, 232, 1                                                                 |
| `color.labelHalo`            | 14, 11, 44, 0.92                                                                 |
| `color.tooltip`              | 22, 17, 66, 0.96                                                                 |
| `color.tooltipLine`          | 170, 160, 255, 0.28                                                              |
| `color.focus`                | 130, 220, 255, 1                                                                 |
| `color.dateline`             | 176, 220, 255, 0.45                                                              |
| `route.base.width`           | 1.1                                                                              |
| `route.base.opacity`         | 0.5                                                                              |
| `route.frequent.width`       | 1.6                                                                              |
| `route.frequent.opacity`     | 0.78                                                                             |
| `route.highlight.width`      | 2.2                                                                              |
| `route.highlight.opacity`    | 0.95                                                                             |
| `route.selected.width`       | 2.6                                                                              |
| `route.selected.opacity`     | 1                                                                                |
| `route.disabledOpacity`      | 0.18                                                                             |
| `route.dimmedOpacity`        | 0.26                                                                             |
| `glow.spread`                | 3.5                                                                              |
| `glow.intensity`             | 0.14                                                                             |
| `glow.innerSpread`           | 1.4                                                                              |
| `glow.innerIntensity`        | 0.32                                                                             |
| `glow.maxGlowingRoutes`      | 12                                                                               |
| `airport.base.radius`        | 2.1                                                                              |
| `airport.base.stroke`        | 0.8                                                                              |
| `airport.base.halo`          | 5                                                                                |
| `airport.hub.radius`         | 3.2                                                                              |
| `airport.hub.stroke`         | 1                                                                                |
| `airport.hub.halo`           | 8                                                                                |
| `airport.selected.radius`    | 4                                                                                |
| `airport.selected.stroke`    | 1.4                                                                              |
| `airport.selected.halo`      | 11                                                                               |
| `hatch.angleDegrees`         | 45                                                                               |
| `hatch.spacing`              | 4                                                                                |
| `hatch.width`                | 1                                                                                |
| `line.coastline`             | 0.75                                                                             |
| `line.border`                | 0.5                                                                              |
| `line.graticule`             | 0.5                                                                              |
| `type.family.display`        | "Barlow Semi Condensed", "Inter", system-ui, "Helvetica Neue", Arial, sans-serif |
| `type.family.data`           | "IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace        |
| `type.family.label`          | "Inter", system-ui, "Segoe UI", "Helvetica Neue", Arial, sans-serif              |
| `type.size.mapLabel`         | 10                                                                               |
| `type.size.mapLabelHub`      | 11.5                                                                             |
| `type.size.mapLabelSelected` | 13                                                                               |
| `type.size.tooltipTitle`     | 12                                                                               |
| `type.size.tooltipBody`      | 11                                                                               |
| `type.size.statValue`        | 56                                                                               |
| `type.size.statLabel`        | 15                                                                               |
| `type.size.posterTitle`      | 84                                                                               |
| `type.weight.regular`        | 400                                                                              |
| `type.weight.semibold`       | 600                                                                              |
| `type.weight.bold`           | 700                                                                              |
| `type.letterSpacing.code`    | 0.08em                                                                           |
| `type.letterSpacing.caps`    | 0.18em                                                                           |
| `state.hoverScale`           | 1.15                                                                             |
| `state.focusRingWidth`       | 2                                                                                |
| `state.focusRingOffset`      | 2                                                                                |
| `state.transitionMs`         | 160                                                                              |

### State and density rules

Base/frequent tiers use repeat count and a threshold of three flights. Hover
raises a route to the highlight tier and adds one broad, low-opacity underlay.
Selection uses the selected width/color, broad and inner underlays, and a focus
ring; other routes dim. Disabled routes use the disabled opacity. Routes are
painted from lower to higher counts, and no more than the configured top-route
budget receives an idle glow. No SVG filter, CSS filter, or Canvas `shadowBlur`
is used.

Airport hubs are selected from the five largest incident-count totals. Hover
and keyboard focus are equivalent; Enter or Space selects an airport or route.
The detail map chooses the great-circle midpoint as its central longitude so a
date-line route is not split at the map seam.

### Hatch, DPR, and moiré

`deviceSnap(cssPx, dpr)` rounds to whole device pixels with a one-device-pixel
minimum. `hatchTile` snaps spacing and line width to device pixels; SVG
patterns apply the inverse camera scale so screen-space hatch density stays
constant through zoom. SVG hatch is a single `userSpaceOnUse` pattern clipped
once to land.
Canvas hatch is drawn into a device-scale tile and clipped to the land path.
Inspect the zoom-four crop at multiple DPRs for moiré; avoid adding a second
texture layer or reducing hatch spacing to compensate for individual captures.

### SVG and Canvas integration

Keep the SVG implementation scoped beneath `.neon-aviation` and use
`mapThemeCssVariables(theme)` on the scene root. SVG palette assignments refer
to `var(--map-theme-*)`; geometry, route tiers, point sizing, and line widths
use the shared 2D helpers. Use one shared gradient and hatch definition per SVG
scene, vector-effect non-scaling coastline strokes, and transparent wide hit
targets. Respect reduced motion; transition only small state changes otherwise.

The Canvas renderer consumes tokens resolved from the registry without
`getComputedStyle`. It uses `buildMapScene` and `traceSegments` for the shared
fictional network geometry, while the offline poster-map helpers provide the
world frame. Keep canvas dimensions at the artboard multiplied by export scale,
use layered strokes instead of shadows, and keep specimen names and statistics
fictional. The bundled Barlow and IBM Plex Latin WOFF2 files are used when
available; CSS and Canvas stacks retain Inter/system and monospace fallbacks.

### Performance and verification

The capture tool records navigation-to-ready time, SVG node/filter counts, and a
three-second wheel-zoom animation-frame sample for each case in
`artifacts/neon-lab/report.json`. Detail/passport captures use a same-viewport
sparse-world companion for the wheel sample because those prototypes do not
contain a zoomable camera. Values below are added only after capture completes.

| Check                          | Result                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| Format, CSS lint/token, docs   | Passed; 18 stylesheets, 0 unresolved tokens; documentation checks cover 40 files.                   |
| Web unit and contrast tests    | Passed; 55 files and 794 tests.                                                                     |
| Typecheck                      | Passed across all four workspace packages.                                                          |
| Production build and dist grep | Passed; no `neon-lab` or `NeonLab` references in `apps/web/dist`.                                   |
| Chromium e2e                   | Passed; 2 tests.                                                                                    |
| Chromium capture               | 36 scenarios, 39 PNGs; ready 481.92–2409.01 ms (mean 1466.85 ms); 0–643 SVG nodes, 0 filters.       |
| Wheel sample                   | 36 samples; mean average frame time 16.64 ms; per-sample averages 16.49–17.37 ms, p95 16.7–16.8 ms. |
| Security headers               | Not re-run in this round; previous static check passed, runtime check skipped (Caddy unavailable).  |
| Firefox                        | Not tested.                                                                                         |
| WebKit                         | Not tested.                                                                                         |
| Real hardware 4K display       | Not tested.                                                                                         |

### Shared 2D map architecture

The shared scene, geometry, theme registry, and SVG/Canvas path adapters are
implemented in [`map-2d-architecture.md`](map-2d-architecture.md). They keep
identity and route ordering independent of the drawing adapter without
introducing a renderer class hierarchy. Later map redesign changes moved the
production Passport map, Flight Detail maps and poster renderer onto them and
removed the Globe.

## 简体中文

### 设计方向与范围

本方案以深靛蓝海洋、克制的陆地纹理、轻量地理线条和浅色航线构成视觉层次。
参考图仅提供布局与配色方向；示例使用 Keepraw Fly 命名及原创样本装饰，不复用参考图
中的品牌文字、霓虹塔楼/天际线插画、旗帜贴纸或头像。

`/neon-lab` 仅在 Vite 开发模式下懒加载，并跳过档案启动流程。页面包含三个隔离样例：
SVG 世界航线图、以 TPE–LAX 跨日期变更线航线为中心的 SVG 详情图，以及可导出的
1080 × 1350 Canvas 虚构护照样本；护照主标题、持有人行、三列统计与全宽 MRZ 均使用
同一画布规格。它们不会替换正式地图或护照输出。

### Token、状态与纹理

上方英文表格是所有最终 token 的唯一数值清单；RGBA 顺序为红、绿、蓝、透明度。
`mapThemeCssVariables(theme)` 为 SVG/CSS 提供作用域变量，Canvas 从主题注册表显式读取
token。
基础/高频航线按重复次数分层；悬停进入高亮状态，选中状态增加内外描边光晕，其他航线降低
透明度。空闲光晕受 token 预算限制，不使用 SVG filter、CSS filter 或 Canvas `shadowBlur`。

`deviceSnap` 将间距与线宽对齐到整设备像素，至少为一个设备像素。`hatchTile` 随相机缩放
调整并在 SVG 中反向缩放图案，以保持屏幕密度。陆地使用一个共享 hatch pattern 和一个
clip；Canvas 使用设备像素倍率绘制图案后裁切。请检查 zoom-four 截图中的摩尔纹，不要为
单张截图再叠加纹理或缩小间距。

### SVG、Canvas 与共享 2D 架构

SVG 样例必须限定在 `.neon-aviation` 下，颜色使用 `var(--map-theme-*)`；Canvas 不读
`getComputedStyle`，并通过共享场景与 Canvas 路径适配器绘制样例航线。已打包的 Barlow 与 IBM Plex Latin
WOFF2 可用时优先使用；CSS/Canvas 字体栈保留 Inter、系统字体和等宽字体回退。

共享的 `MapScene`、几何、主题注册表以及 SVG/Canvas 路径适配器已在
[2D 地图架构指南](map-2d-architecture.md)中定义，不引入渲染器类层级。
后续地图改版已将正式 Passport 地图、航班详情地图与海报渲染器迁移到这套实现，并删除了 Globe。

### 验证记录

验证表只填写本机真实测量结果。Firefox、WebKit 和真实硬件 4K 显示器未测试。

| 指标                   | 实测结果                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium 截图覆盖      | 4 种 viewport/DPR × 9 种样本状态 = 36 个场景；另有 2 个 Canvas 导出和 1 个 zoom-4 裁图，共 39 张 PNG。                                                           |
| Viewport/DPR           | 3840×2160@1、1920×1080@2、1440×900@1、390×844@3。                                                                                                                |
| 页面 ready 时间        | 36 个场景：481.92–2409.01 ms，平均 1466.85 ms。                                                                                                                  |
| SVG 节点 / filter      | 0–643 个 SVG 子节点；36 个场景均为 0 个 SVG filter。                                                                                                             |
| 3 秒 wheel zoom 帧时间 | 36 个样本的平均帧时间均值 16.64 ms；各样本平均值 16.49–17.37 ms，p95 为 16.7–16.8 ms。详情图与护照图使用相同 viewport 的 sparse/normal 世界地图 companion 测量。 |
| 单元与交互测试         | Web Vitest：794 项通过；指定 Chromium e2e：2 项通过。                                                                                                            |
| Build / dist           | 生产 build 通过，dist 中未发现 `neon-lab` 或 `NeonLab`。                                                                                                         |
| 安全头                 | 本轮未重跑；此前静态检查通过，runtime 检查因环境未安装 Caddy 而跳过。                                                                                            |
