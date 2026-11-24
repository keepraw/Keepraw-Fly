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
| Theme         | The active [skin](views-and-skins.md) sets the map theme: `neon-aviation` for `aviation`, `daylight-chart` and `graphite-chart` for `minimal` in light and dark. It is not a setting of its own, and a `mapTheme` stored by an earlier version is not read. `resolveMapTheme` still renders the default theme for an unknown ID.                                                   |

A themed map sets `data-map-theme` and the `--map-theme-*` variables on its root.
Legacy Passport paint rules are scoped to `.route-map:not([data-map-theme])`, so
they style only the unthemed fallback. Glow is layered strokes; routes, glows and
airport points carry no CSS or SVG filter, and strokes use
`vector-effect: non-scaling-stroke` so they stay crisp at any zoom and pixel ratio.

### 3D code removal (PR 5)

PR 5 deleted the whole `globe/` directory (components, renderer, math,
lighting, textures, Globe Lab), the WebGL share renderer (`share-renderer.ts`,
`share-plan.ts`, `share-errors.ts`, `share-verification-sample.ts`), their unit
and e2e suites, scripts and fixtures, and the `three` / `@types/three`
dependencies. Kept on purpose:

- `share-png.ts`: the Canvas 2D export (`poster-export.ts`) validates its PNG
  output with it.
- The picker and status strings formerly under the `globe.*` locale namespace,
  now `routeMap.*`.

### Scope

PR 3 replaced the two production map entry points and added the theme setting
without changing the formal Flight Passport output, flight statistics or the
archive format.

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
地图主题由当前[皮肤](views-and-skins.md)决定：`aviation` 用 `neon-aviation`，`minimal` 浅色用
`daylight-chart`、深色用 `graphite-chart`。它不再是单独的设置，旧版本保存的 `mapTheme` 不再读取；
未知的 ID 仍经 `resolveMapTheme` 回退到默认主题。

主题地图在根节点设置 `data-map-theme` 与 `--map-theme-*` 变量；旧的 Passport 绘制规则限定在
`.route-map:not([data-map-theme])`，只作用于无主题的回退地图。光晕使用叠加描边，航线、光晕
和机场点均不使用滤镜。

3D 代码已在 PR 5 删除：整个 `globe/` 目录、WebGL 分享渲染器及其测试、脚本、测试数据和
`three` 依赖。有意保留：`share-png.ts`（Canvas 2D 导出用它校验 PNG），以及从 `globe.*` 改名为 `routeMap.*` 的选择器与状态文案。

## Flight Passport templates (PR 4)

The shared Flight Passport image is drawn by a **layout template**
(`share/poster-template.ts`) coloured by the active **map theme**. The two are
separate code, and the active [skin](views-and-skins.md) chooses both:

| Concern                                                      | Owner                                                                       | Chosen by                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------- |
| Composition: where map, statistics, holder fields and MRZ go | `PosterTemplate` (`neon` in `poster-neon.ts`, `book` in `poster-render.ts`) | The skin's `passportTemplate` |
| Map and ink colours, strokes, hatch, glow, airport dots      | `MapTheme` tokens from the Theme Registry                                   | The skin's `mapTheme`         |
| Numbers, labels, MRZ text                                    | `buildPosterModel` → `buildPosterCopy`, unchanged                           | —                             |
| Text measuring, fitting, MRZ rows                            | `poster-paint.ts`, shared by all templates                                  | —                             |

`neon` is the default: a 1080×1350 artboard exported at 2× (2160×2700 PNG).
It builds its routes with `buildMapScene` and strokes them with `routeStroke`,
so the frequency tiers, date-line splitting and glow budget are the same as the
on-screen map. `book` is the previous passport-book layout; it keeps its own
paper palette (`followsMapTheme: false`). No skin selects `book` until `archive`
is implemented. Adding a layout means adding one `PosterTemplate`; adding a theme
needs no passport change.

**Multilingual text.** No position depends on a string's length. Every string
is measured with the fonts that actually loaded (or the fallback stack):
captions wrap onto a second line above their baseline (at spaces, or between
graphemes for Chinese/Japanese/Korean), figures shrink together with their
unit, and the holder name shrinks, then wraps. `e2e/share-neon-passport.pw.ts`
renders all ten locales × two units × two themes × webfont/fallback and fails
on any overlap, overflow, or shortened text.

**Unchanged.** Export stays local Canvas 2D → PNG with header validation,
overflow rejection, font fallback and retry. The map shows unlabelled dots
only: no airport code, flight number or date of an individual flight.

**WebGL audit.** The share dialog imports no Globe, Three.js or WebGL module
(`poster-template.test.ts` walks the import graph). The legacy WebGL
share renderer was deleted in PR 5.

**飞行护照版式（PR 4）。** 分享图由“版式模板”绘制、由当前“地图主题”着色，两者是独立的
设置与代码：版式只决定地图、统计、持有人信息和机读码的位置，颜色、线宽、斜线和光晕全部
来自主题 Token。默认版式 `neon` 为 1080×1350 画板、2 倍导出（2160×2700 PNG），航线经
`buildMapScene` 生成；`book` 为原护照本版式。所有文字都按实际加载（或回退）字体测量：
标签过长时在基线上方换行（中日韩按字换行），数值与单位一起缩小，姓名先缩小再换行；
十种语言 × 两种单位 × 两套主题 × 字体回退均有自动测试，出现重叠、溢出或截断即失败。
导出仍为本地 Canvas 2D，不使用 WebGL；旧的 WebGL 分享渲染器已在 PR 5 删除。
