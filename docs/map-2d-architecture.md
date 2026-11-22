# Unified 2D map core and theme registry / 统一 2D 地图核心与主题注册表

## English

This guide describes the shared 2D map utilities and theme contracts. They
share route geometry, physical identity, scene ordering, and token-driven style
between callers without introducing a second map engine or renderer hierarchy.
SVG and Canvas remain separate drawing adapters; production map components are
not migrated by this change.

### Modules

| Module                                                                                                                    | Responsibility                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| [`packages/core/src/routes.ts`](../packages/core/src/routes.ts)                                                           | `RouteSegment`, `buildRouteSegments`, and physical route/point identity keys.                    |
| [`map2d/theme.ts`](../apps/web/src/map2d/theme.ts)                                                                        | `Rgba`, `MapThemeTokens`, and `MapTheme` contracts.                                              |
| [`map2d/themes/neon-aviation.ts`](../apps/web/src/map2d/themes/neon-aviation.ts)                                          | Neon Aviation theme descriptor and shared token values.                                          |
| [`map2d/theme-registry.ts`](../apps/web/src/map2d/theme-registry.ts)                                                      | Theme registry, ID type guard, default, lookup fallback, and listing.                            |
| [`map2d/theme-style.ts`](../apps/web/src/map2d/theme-style.ts)                                                            | Explicit-token color, pixel-snap, hatch, route, airport, and contrast helpers.                   |
| [`map2d/theme-css.ts`](../apps/web/src/map2d/theme-css.ts)                                                                | Literal, theme-neutral CSS custom-property mapping for every token leaf.                         |
| [`map2d/geometry.ts`](../apps/web/src/map2d/geometry.ts)                                                                  | Existing geographic projection helpers composed into route segments, frames, and seam detection. |
| [`map2d/scene.ts`](../apps/web/src/map2d/scene.ts)                                                                        | Identity-keyed route and airport aggregation, ranking, tiers, hubs, and bounds.                  |
| [`map2d/svg-path.ts`](../apps/web/src/map2d/svg-path.ts) / [`map2d/canvas-path.ts`](../apps/web/src/map2d/canvas-path.ts) | Separate SVG path serialization and Canvas path tracing adapters.                                |
| [`map2d/index.ts`](../apps/web/src/map2d/index.ts)                                                                        | Public barrel for the shared 2D APIs.                                                            |

### Data flow and identity

For archive flights, callers first use core `buildRouteSegments`; the scene
builder accepts its `RouteSegment[]` output rather than interpreting raw
flights. `buildRouteSegments` skips cancelled flights and uses
`arrivalIdentity` for a diverted flight's actual endpoint. `buildMapScene`
consumes `routeIdentityKey` and `routePointIdentityKey` from core. It skips a
route whose endpoints have the same physical identity, aggregates duplicate
route counts, and aggregates airport endpoint appearances weighted by route
flight count. Identity is defined only by those core helpers, not by
ad-hoc IATA matching; when historical airports reused an IATA, their distinct
identity keys keep them separate. IATA is retained for display.

Rank zero is the busiest route. Routes are returned for drawing from least to
most frequent, with a stable identity-key tie-break; each receives the `base`
or `frequent` tier. Hubs default to the top five weighted airports with a
stable identity-key tie-break. An omitted center uses the existing
`regionalCenterLongitude`; an empty scene has `bounds: null`.

The shared geometry module uses `projectionAt`, `sampleGreatCircle`,
`greatCircleMidpoint`, `regionalCenterLongitude`, and the existing world
dimensions from `data/map-geometry.ts`. `projectedRoute` splits a sampled route
when adjacent projected x coordinates jump more than 40% of the world width.
The SVG and Canvas adapters consume the same projected segments, but retain
independent drawing code. The poster map's shared-route refactor preserves its
dynamic sample count and is guarded by a parity test over TPE–LAX, JFK–HKG,
SYD–SCL, HKG–MFM, and a same-point case.

### Theme registration and CSS contract

`MapTheme` binds a stable ID and label to typed `MapThemeTokens`. Add a theme by
defining its token object and descriptor, adding it to `MAP_THEMES`, and adding
literal CSS-property mappings for every token leaf in `theme-css.ts`. Update
the theme registry tests for ID resolution, invalid-ID fallback, leaf coverage,
and contrast. Change `DEFAULT_MAP_THEME_ID` only when the product default is
intentionally changing.

Use `resolveMapTheme` at the call site and pass its tokens explicitly to
theme-dependent style helpers. Unknown IDs fall back to the registered default.
The CSS adapter uses literal `--map-theme-*` keys so CSS tooling can audit them;
it does not alter the existing production `--color-map-*` contract. Do not add
a theme-specific default to a shared style helper.

### Production map surfaces (PR 3)

Both production map entry points now render the shared 2D SVG map. No production
page mounts a WebGL canvas or requests Globe code or imagery.

| Surface       | Implementation                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport      | `PassportPage` mounts `PassportMap` at every width (the map is new on mobile). It wraps the themed `PassportRouteMap` and adds the route/airport pickers. Selection, row focus, keyboard activation, pan, zoom and reset are unchanged; frequency tiers and hubs come from `buildMapScene`.                                                                                        |
| Flight Detail | `FlightDetailPage` mounts `FlightRouteMap` at every width; narrow layouts lead with it at the content width, capped at `min(52svh, 480px)`. `flightRouteScene` models flown, diverted (flown leg plus a dashed planned leg), cancelled and unavailable flights; `flightRouteCamera` fits the sampled great-circle arc, recentred on the route so date-line routes stay one stroke. |
| Theme setting | `ViewerSettings.mapTheme` is chosen in Settings, stored with the other viewer settings and resolved through `resolveMapTheme`, so a missing or retired ID renders the default theme. `neon-aviation` and `daylight-chart` are registered.                                                                                                                                          |

A themed map sets `data-map-theme` and the `--map-theme-*` variables on its root.
Legacy Passport paint rules are scoped to `.route-map:not([data-map-theme])`, so
they style only the unthemed fallback. Glow is layered strokes; routes, glows and
airport points carry no CSS or SVG filter, and strokes use
`vector-effect: non-scaling-stroke` so they stay crisp at any zoom and pixel ratio.

### Remaining 3D code (grep-verified after PR 3)

| Code                                       | Status                                                                                                                                                                        | Removed in |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `globe/PassportGlobe`, `globe/DetailGlobe` | No importer in production pages. Kept as source only.                                                                                                                         | PR 5       |
| `globe/GlobeMap`, renderer, math, textures | Reached only through the DEV-only Globe Lab. `GlobeMap` still falls back to the unthemed `PassportRouteMap`.                                                                  | PR 5       |
| Globe Lab                                  | `App.tsx` creates the lazy import only under `import.meta.env.DEV`.                                                                                                           | PR 5       |
| Stored `SolarMode`                         | `storage/types.ts` still imports the type and keeps the stored field for compatibility. Settings no longer shows it and no production surface reads it.                       | PR 5       |
| Share WebGL renderer (`share-renderer.ts`) | Imports Globe textures, lighting and math and requests WebGL2. No production callsite; `share-plan.ts` imports Globe math and the fixed sun direction. Audited again in PR 4. | PR 4 / 5   |
| Canvas 2D poster                           | `poster-render.ts` and `poster-map.ts` are already 2D. The formal Flight Passport moves to the Neon layout and the selected map theme in PR 4.                                | PR 4       |

### Scope

PR 3 replaces the two production map entry points and adds the theme setting. It
deletes no Globe, Three.js or WebGL source, and does not change the formal Flight
Passport output, flight statistics or the archive format.

## 简体中文

本指南记录共享 2D 地图工具与主题契约。它们统一航线几何、物理身份、场景排序和
Token 样式；SVG 与 Canvas 仍使用独立绘制适配器。本次不引入第二套地图引擎或渲染器
继承体系，也不迁移正式地图组件。

归档航班先由 core 的 `buildRouteSegments` 生成 `RouteSegment[]`，场景构建器不解释原始
航班。该 core 函数跳过已取消航班，并在改降时使用 `arrivalIdentity` 作为实际终点。
`buildMapScene` 使用 core 的 `routeIdentityKey` 和 `routePointIdentityKey`；相同物理身份的
端点不会形成航线，重复航线会聚合计数，机场端点计数按航线航班数加权。IATA 仅用于显示，
场景逻辑仅通过 core 身份辅助函数匹配，不自行按 IATA 匹配；历史上复用同一 IATA 的机场因
身份键不同而保持独立。

`rank: 0` 表示最繁忙航线；返回顺序按低频到高频绘制，并以稳定身份键打破平局。航线分为
`base` 与 `frequent` 两级，默认取加权计数最高的五个枢纽。未指定中心时使用现有
`regionalCenterLongitude`；空场景的 `bounds` 为 `null`。共享几何继续使用
`data/map-geometry.ts` 的投影、球面采样、中点、区域中心及世界尺寸。相邻投影 x 坐标跳变
超过世界宽度的 40% 时，`projectedRoute` 会拆分航线段。

新增主题时，定义 token 对象与 `MapTheme`，加入 `MAP_THEMES`，并在 `theme-css.ts` 为每个
token 叶节点添加字面量 CSS 属性映射；同时测试 ID 解析、无效 ID 回退、叶节点覆盖和对比度。
共享样式函数必须显式接收主题 Token。CSS 变量使用 `--map-theme-*`，不改变正式
`--color-map-*` 契约。

PR 3 之后，两个正式地图入口都使用共享 2D SVG 地图，正式页面不再挂载 WebGL 画布，也不再
请求 Globe 代码或贴图。Passport 在所有宽度下挂载 `PassportMap`（移动端为新增地图），保留
航线/机场选择、行聚焦、键盘操作、平移、缩放和复位。Flight Detail 在所有宽度下挂载
`FlightRouteMap`（窄屏置于页面顶部，宽度随屏幕自适应，高度不超过约半屏）：`flightRouteScene` 区分已飞、备降（实飞航段加虚线计划航段）、取消和不可用
四种状态，`flightRouteCamera` 以航线为中心自动取景，跨日期变更线的航线保持为一条连续线。
设置中的 `mapTheme` 随查看设置保存，并经 `resolveMapTheme` 解析，缺失或已下线的 ID 回退到
默认主题；目前注册了 `neon-aviation` 与 `daylight-chart`。

主题地图在根节点设置 `data-map-theme` 与 `--map-theme-*` 变量；旧的 Passport 绘制规则限定在
`.route-map:not([data-map-theme])`，只作用于无主题的回退地图。光晕使用叠加描边，航线、光晕
和机场点均不使用滤镜。

仍保留的 3D 代码：`PassportGlobe`、`DetailGlobe` 已无正式页面引用；`GlobeMap`、渲染器和贴图
只经由仅 DEV 可用的 Globe Lab 访问；`SolarMode` 字段为兼容而保留，设置页不再显示；分享
WebGL 渲染器没有正式调用点，将在 PR 4 再次审计。以上代码在 PR 5 删除。PR 3 不删除任何
Globe、Three.js 或 WebGL 源码，也不改变正式飞行护照输出、统计或档案格式。
