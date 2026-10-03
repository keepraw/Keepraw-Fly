# Keepraw Fly visual system / 视觉系统

[English](#english) | [简体中文](#简体中文)

## English

The visual system supports a local flight archive: flight facts, geographic
relationships and data ownership lead the interface. Shared tokens and components
live in the application; page CSS controls composition.

### Source of truth

| Source | Responsibility |
| --- | --- |
| [design-system.css](../apps/web/src/design-system.css) | Semantic colors, typography, spacing, shape, depth, motion and theme tokens |
| [styles.css](../apps/web/src/styles.css) | Page composition, responsive behavior and shared component styles |
| [PageShell](../apps/web/src/components/PageShell.tsx) | Main-content landmark and shared page shell |
| [AppHeader](../apps/web/src/components/AppHeader.tsx) | Passport/Settings navigation, mobile headings and flight-detail actions |
| [AviationPrimitives](../apps/web/src/components/AviationPrimitives.tsx) | Airport codes, status badges and aviation icons |
| [MapViewport](../apps/web/src/components/MapViewport.tsx) | Local SVG pan, zoom, reset and camera transitions |

### Tokens, language and themes

Use semantic `--color-*`, `--font-*`, `--type-*`, `--space-*`, `--radius-*` and
`--shadow-*` roles. Existing aliases such as `--ink` and `--green` remain compatible;
new UI should prefer semantic roles instead of adding another palette.

- Colors distinguish canvas, surfaces, text, borders, focus and operational
  meaning. Positive, attention, critical and information colors describe state.
  The map has its own shared semantic palette.
- UI, display, data and monospace families use locally available fonts. Data roles
  use tabular numerals; English, Simplified Chinese and Traditional Chinese share
  the same hierarchy with language-specific CJK fallbacks.
- Appearance defaults to **System**. Light and Dark are explicit user options.
  Both themes use the same semantic roles.
- The shared content maximum is 1,280 px with fluid 20–40 px gutters; flight-detail
  composition uses a 1,240 px maximum. The main mobile transition is 760 px.
  Mobile uses a page heading with settings/back actions in place of desktop
  navigation. Insets account for device safe areas.

### Composition

Each page needs one clear subject. Scale, alignment and whitespace establish
hierarchy before surfaces, shadows or decoration.

| Page or region | Primary subject | Supporting content |
| --- | --- | --- |
| Passport | Geographic footprint and the connected flight archive | Period/search controls, derived totals and selection details |
| Flight detail | Origin → destination and the relationship between local times | Date, flight identity, recorded status and optional travel facts |
| Settings | Data ownership and editable preferences | Section labels, import/export controls and storage information |

The chronological flight list is part of Passport, not a separate page. Desktop
can place the map and archive beside each other; mobile reorders the same content
into document flow. Flight detail omits its route map on mobile.

Prefer proximity, aligned rows and dividers for related facts. Use a surface for
an interaction or containment boundary and elevation for overlap or floating
layers. Avoid nested cards, one card per field, decorative metrics and competing
hero regions. Status badges and accent colors must communicate real state.
Demo data and destructive actions must be clearly identified.

### Components and interaction

- `AirportCode` supplies consistent code typography and compact/display sizes.
- `FlightStatusBadge` maps delayed/cancelled to critical, early/on-time to positive,
  scheduled to neutral and diverted to attention. Information styling is available
  in CSS; the badge does not imply live flight data.
- `AviationIcon` is a small inline SVG vocabulary. Add icons only when they clarify
  a fact or action.
- Use semantic controls and visible focus. Destructive actions need explicit text;
  modal dialogs must contain focus, support Escape and restore focus to their opener.
- Prefer shared control heights and allow long labels to wrap. Flight numbers,
  airport codes and key times remain readable and unbroken.
- Page and route entrance motion uses CSS. Map camera transitions use animation
  frames. Both respect reduced-motion preferences, and no action depends on motion
  or hover to be discoverable.

### Responsive and accessibility checks

Inspect 1,440 px desktop, 1,024 px tablet/narrow desktop and 390 px mobile layouts.
Exercise 760/761 px around the shared transition; use 320 px as an extra overflow
guard when changing dense content. These are verification widths, not separate
layouts to hard-code.

Check English, Simplified Chinese and Traditional Chinese, both themes, keyboard
navigation and reduced motion. The document must not overflow horizontally;
intentionally scrollable regions must contain their own overflow. Buttons and
modals must fit their containers and viewport, and fixed/sticky elements must
leave content and keyboard focus reachable. Supporting names may wrap without
displacing route identity or critical times.

[Browser tests](../e2e) cover representative layouts, interactions and Axe
accessibility checks. Run the relevant cases with `pnpm test:e2e`; code changes
also require `pnpm typecheck`, `pnpm test` and `pnpm build`. Automated checks support
visual and keyboard review; they do not establish that every screen is accessible.
Screenshots and Playwright reports are local test outputs, not product assets.

## 简体中文

视觉系统服务于本地飞行档案：界面优先表达航班事实、地理关系和数据归属。共享 token
与组件保存在应用中，页面 CSS 负责具体构图。

### 实现入口

| 源文件 | 职责 |
| --- | --- |
| [design-system.css](../apps/web/src/design-system.css) | 语义颜色、字体、间距、形状、纵深、动效与主题 token |
| [styles.css](../apps/web/src/styles.css) | 页面构图、响应式行为与共享组件样式 |
| [PageShell](../apps/web/src/components/PageShell.tsx) | 主内容 landmark 和共享页面骨架 |
| [AppHeader](../apps/web/src/components/AppHeader.tsx) | Passport/设置导航、移动端标题和航班详情操作 |
| [AviationPrimitives](../apps/web/src/components/AviationPrimitives.tsx) | 机场代码、状态徽标和航空图标 |
| [MapViewport](../apps/web/src/components/MapViewport.tsx) | 本地 SVG 地图拖动、缩放、复位与视角过渡 |

### Token、语言与主题

使用 `--color-*`、`--font-*`、`--type-*`、`--space-*`、`--radius-*` 和 `--shadow-*`
语义角色。`--ink`、`--green` 等旧别名继续兼容；新增界面优先使用语义角色，不另建色板。

- 颜色区分画布、表面、文字、边框、焦点和运行状态。正向、关注、严重与信息颜色必须
  表达状态。地图使用独立的共享语义色板。
- 界面、展示、数据和等宽字体均使用本地可用字体。数据角色使用等宽数字；英文、
  简体中文与繁体中文共享信息层级，并使用各自的 CJK 回退字体。
- 外观默认**跟随系统**，用户可明确选择浅色或深色。两种主题使用同一套语义角色。
- 共享内容最大宽度为 1,280 px，水平间距在 20–40 px 之间变化；航班详情采用
  1,240 px 最大宽度。主要移动端切换点为 760 px。移动端使用页面标题及设置/返回
  操作替代桌面导航；容器间距包含设备安全区域。

### 构图

每页只有一个清晰主题。先用尺度、对齐和留白建立层级，再考虑表面、阴影或装饰。

| 页面或区域 | 主要对象 | 支撑内容 |
| --- | --- | --- |
| Passport | 地理飞行足迹及相互关联的航班档案 | 时间范围/搜索控件、派生统计和选中内容的详情 |
| 航班详情 | 起点 → 终点及两地当地时间的关系 | 日期、航班身份、已记录状态和可选出行事实 |
| 设置 | 数据归属与可编辑偏好 | 章节标签、导入/导出控件和存储信息 |

按时间组织的航班列表属于 Passport，不再是独立页面。桌面端可以并排展示地图与档案，
移动端将同样的内容重排为文档流。航班详情在移动端不展示航线地图。

相关事实优先通过邻近关系、对齐行和分隔线组织。表面用于表达交互或内容边界，纵深
用于表达重叠或浮层。避免嵌套卡片、一字段一卡片、装饰性指标和相互竞争的主视觉。
状态徽标与强调色必须表达真实状态。演示数据和破坏性操作必须清楚标识。

### 组件与交互

- `AirportCode` 统一机场代码字体，并提供紧凑/展示两种尺寸。
- `FlightStatusBadge` 将延误/取消映射为严重、提前/准点映射为正向、计划中映射为
  中性、备降映射为关注。CSS 另有信息样式；徽标不表示应用接入了实时航班数据。
- `AviationIcon` 提供一套小型内联 SVG 图标。只有能帮助理解事实或操作时才添加图标。
- 使用语义控件和可见焦点。破坏性操作需要明确文案；弹窗必须约束焦点、支持 Escape
  关闭，并把焦点还给触发控件。
- 优先使用共享控件高度，允许长标签换行。航班号、机场代码和关键时间应完整可读。
- 页面与航线入场动效使用 CSS，地图视角过渡使用动画帧。两者均遵守减少动态效果
  偏好；任何操作都不能依赖动效或悬停才能被发现。

### 响应式与可访问性检查

检查 1,440 px 桌面、1,024 px 平板/窄桌面与 390 px 移动端布局。覆盖共享切换点附近的
760/761 px；修改密集内容时，可增加 320 px 溢出检查。这些是验收宽度，不是需要
硬编码的独立布局。

覆盖英文、简体中文和繁体中文、两种主题、键盘导航及减少动态效果。整个文档不得横向
溢出；有意滚动的区域必须在内部约束溢出。按钮与弹窗必须适应容器和视口，固定或粘性
元素不得遮挡可操作内容与键盘焦点。辅助名称可以换行，但不能挤走航线身份或关键时间。

[浏览器测试](../e2e)覆盖代表性布局、交互和 Axe 可访问性检查。使用 `pnpm test:e2e`
运行相关用例；代码改动还需要通过 `pnpm typecheck`、`pnpm test` 和 `pnpm build`。
自动化检查辅助视觉和键盘审查，不代表所有界面都已满足可访问性要求。截图与 Playwright
报告属于本地测试产物，不是产品资源。
