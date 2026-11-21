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

### 3D consumer audit (grep-verified)

| Surface                         | Verified reachability and relationship to the 2D core                                                                                                                                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport page → `PassportGlobe` | `PassportPage.tsx` lazy-loads it only when `(min-width: 761px)` matches; mobile does not mount it. `PassportGlobe` delegates rendering to `GlobeMap`.                                                                                                          |
| Flight detail → `DetailGlobe`   | `FlightDetailPage.tsx` gates the lazy component on `(min-width: 1200px)`. It is a separate single-flight surface and is not migrated to the 2D core.                                                                                                           |
| Globe Lab                       | `App.tsx` creates the lazy import only under `import.meta.env.DEV`; `/globe-lab` also checks the path and write permission. This is a development diagnostic.                                                                                                  |
| Stored `SolarMode`              | `storage/types.ts` imports the type from `globe-solar.ts` and stores it in viewer settings. It configures Globe lighting, not 2D map geometry.                                                                                                                 |
| Share WebGL renderer            | `share-renderer.ts` defines `createShareRenderer` and requests WebGL2, but a source grep found no production callsite in `apps/web`; `share-verification-sample.ts` imports only the `ShareComposer` type. It is not a reachable production 3D consumer today. |
| Globe failure fallback          | `GlobeMap.tsx` renders `PassportRouteMap` when a non-detail Globe fails. `variant === "detail"` has no SVG fallback.                                                                                                                                           |
| Globe documentation             | [`docs/globe.md`](globe.md) records the current production Globe gates, behavior, and lifecycle; it is documentation, not a runtime consumer.                                                                                                                  |
| Canvas 2D poster                | `poster-render.ts` uses Canvas 2D and `poster-map.ts` route geometry. It is the 2D poster path, not a WebGL renderer.                                                                                                                                          |

### Scope

The Neon lab is the current integration of these shared utilities. The
production Passport map, Globe components, page gates, storage, CSS contracts,
and poster renderer remain outside this refactor. The poster-map route helper is
the sole conditional production-adjacent change and is retained only with
byte-identical parity for the required route matrix.

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

3D 消费者审计表已根据源码搜索核实：Passport Globe 仅在 761px 及以上挂载；Flight Detail
Globe 仅在 1200px 及以上挂载；`/globe-lab` 受 Vite DEV 与写入权限门控；`SolarMode` 是持久化
的 Globe 设置。`GlobeMap` 在非 detail 变体失败时回退到 `PassportRouteMap`。分享 WebGL
渲染器目前未发现生产调用点；正式海报路径使用 Canvas 2D。`docs/globe.md` 记录当前 Globe
行为与生命周期。

Neon lab 是共享工具的当前集成。正式 Passport 地图、Globe、页面门控、存储、CSS 契约和海报
渲染器不在此次重构范围内；唯一的条件性生产相邻改动是经过指定路线矩阵逐字节验证的
`poster-map.ts` 路线辅助函数。
