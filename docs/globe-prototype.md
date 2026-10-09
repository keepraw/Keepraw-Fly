# Desktop Passport Globe 实验交付说明

日期：2026-10-09。分支：`codex/globe-prototype-experiment`。
起点：PR #33 检查点 `a6be5cc`，原分支为
`codex/desktop-passport-redesign-checkpoint`。

已交付可运行、可交互、使用现有档案数据的独立原型。正式 Passport 地图没有被替换，
没有创建、合并或关闭 PR。视觉效果尚未由项目负责人验收；当前性能结果也不足以支持直接生产整合。

## 打开与代码范围

运行 `pnpm dev`，访问 [Globe Lab](http://127.0.0.1:5173/globe-lab)。
入口仅在 Vite 开发环境中存在；`pnpm build` / `pnpm preview` 不提供实验页面。
实验不会保存主题切换、机场选择、镜头或筛选状态，不会写入航班档案。

- `apps/web/src/globe/GlobeLab.tsx`：实验页面、年份与搜索、现有 FlightRow、键盘选择入口。
- `GlobeMap.tsx`：React 生命周期、主题与选择契约、错误降级和重试。
- `globe-renderer.ts`：Three.js 球体、材质、航线、遮挡、标签、点击与镜头运动。
- `globe-math.ts` / `globe-math.test.ts`：球面地理、大圆、独立三维镜头算法及可重复测试。
- `globe-lab.css` / `lab-locales.ts`：只作用于实验页面的样式和三语文案。
- `globe-texture.source.json` / `assets/` / `LICENSE.three`：本地纹理、来源与许可。
- `apps/web/src/App.tsx`：在现有机场目录、IndexedDB 档案和设置加载之后，增加 DEV 限定的懒加载入口。
- `e2e/globe-lab.pw.ts`：真实浏览器交互、截图、降级、无障碍与性能采样。
- `scripts/generate-globe-textures.py`、`scripts/measure-globe-bundle.mjs`：可重复的资源生成与独立构建测量。

没有修改 `PassportRouteMap`、二维相机、Flight Detail、Mobile Passport、统计区、
Flight Archive 的正式样式或业务规则。新增依赖为 Three.js 0.186.1 和开发类型包；未使用 React Three Fiber 或 Globe.gl。

## 技术选型

| 方案                         | 球面、材质与光照                                               | 交互与无障碍                           | 成本与结论                                                   |
| ---------------------------- | -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Three.js + WebGL             | 真正的三维球体、深度缓冲、纹理采样和可控 Shader                | OrbitControls；需补 DOM 标签与键盘选择 | 本实验渲染器 588,860 B JS；独立控制材质和构图，采用          |
| D3 Orthographic + Canvas/SVG | 球面投影适合地图；真实地表照明、悬浮弧线和深度遮挡需要额外模拟 | SVG 原生语义较好；现有 D3 已在仓库     | 新增依赖最少，但不适合本次核心视觉目标                       |
| Globe.gl                     | 基于 Three.js，具备地球和航线封装                              | 常用交互方便，仍需 DOM 可访问入口      | 增加封装依赖和版本维护；定制表面与镜头时需要穿透封装，未采用 |

Three.js 使用依据见[官方文档](https://threejs.org/docs/)。表中视觉与维护取舍是本原型的工程判断，
不是对所有地图任务的普遍结论。Globe.gl 未安装，因此没有声称其准确构建大小或性能。

## 数据与镜头

机场目录由正式 Bootstrap 的 `loadAirportDirectory` 加载。
档案与语言来自 App 的现有 `browserStorage.loadDocument/loadSettings`。
没有档案时只读使用仓库已有 Demo Archive；已有个人档案则使用个人档案。

年份及搜索复用 `passportVisibleFlights`，航线复用 `buildRouteSegments`。
取消航班排除、备降机场替代目的地、去程与回程分别计数的语义均由现有 core 决定。
截图使用原有 24 条 Demo 航班，生成 23 条有向航线、20 个机场。
**Demo 航班是项目原有的虚构示例行程，并非用户真实旅行史；机场位置是真实机场目录坐标。**
没有为了截图添加机场、航线或伪造行程。

默认镜头在球面上评分并逐步细化，不计算经纬度算术平均值。
机场访问频次采用指数权重，结合航线频次、五个大圆采样位置及两端可见性；
航线覆盖权重为机场密度的辅助项，避免分散长途航线把默认镜头推向空旷北极。
当前 Demo 因 SFO 访问最多，主视角面向北美。镜头有小幅南向构图偏移，球体可被容器裁切。

点击航班、机场或航线才会平滑转向；悬停只高亮。手动旋转会取消自动运动。
Home 恢复当前筛选数据的默认镜头；缩放可从近景退到完整球体。
`prefers-reduced-motion` 下直接定位，正常模式采用 650 ms 插值。
大圆弧线具有与角距离相关的克制高度，实体球体通过深度缓冲遮挡背面；
标签与点击拾取另外执行视线/球体相交检查，背面标签不会显示。

## 地表资源与视觉自检

现有 `map-relief.webp` 是 Natural Earth 灰度地形明暗，缺少彩色地表和海底层次，
因此继续留给正式二维地图，不强行承担 Globe 的全部视觉材质。

实验采用 [NASA Blue Marble 地形与海底影像](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/)
的 July 2004 云层剔除等距经纬纹理，并生成 2K/4K WebP。
来源、SHA-256、尺寸、生成器与 [NASA 使用说明](https://www.nasa.gov/nasa-brand-center/images-and-media/)
见 `globe-texture.source.json` 和 `THIRD_PARTY_NOTICES.md`。
这是球面 UV 地理数据，不是预渲染地球照片或参考概念图。
运行时资源全部来自本地；浏览器测试记录的外部请求数为 0。

Light 与 Dark 共用地理纹理，但 Shader 分别调校陆地、海洋、环境亮度、方向光、
海面反光、地平线色彩和航线亮度，没有通过 CSS 色相变换生成另一主题。
Light 保持浅蓝和冷色地形；Dark 使用深海军蓝、受光面与背光面层次。
选中路线为珊瑚红，其他路线依据频次分层。没有云层、城市灯光、Bloom 或粒子系统。

实际截图已经呈现放大的曲面、真实海岸与地形、地表明暗和三维航线遮挡，
这些维度比当前平面 SVG 更接近目标。仍有明显差距：概念图的摄影式地平线和夜航城市细节更丰富；
本实验的蓝色地表分级较偏地图风格，远程航线在边缘容易聚集，短视口裁切较明显。
不能据此宣称概念图视觉已经完全还原。

## 真实浏览器截图

以下均由实际 Playwright 浏览器页面或地图 DOM 元素截图产生，没有人工合成、修图或替换图片。
同一主题切换使用相同档案与相同默认镜头。

| 截图                      | 本机可访问文件                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark，1440×900，初始镜头  | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-1440x900.png)                                                                                             |
| Light，1440×900，初始镜头 | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-light-1440x900.png)                                                                                            |
| Dark，1280×720            | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-1280x720.png)                                                                                             |
| Light，1280×720           | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-light-1280x720.png)                                                                                            |
| Dark，选择背面 LHR → FRA  | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-selected-backside.png)                                                                                    |
| Dark，手动旋转            | [完整页面](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-manual-rotation.png)                                                                                      |
| Dark，1440 地图近景       | [地图截图](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-map.png)                                                                                                  |
| Light，1440 地图近景      | [地图截图](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-light-map.png)                                                                                                 |
| 1024×768，Dark / Light    | [Dark](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-1024x768.png) / [Light](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-light-1024x768.png) |
| 844×390，Dark / Light     | [Dark](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-dark-844x390.png) / [Light](C:/Users/forgo/Documents/Keepraw-Fly/artifacts/globe-lab/chromium-light-844x390.png)   |

同目录也包含对应的 `webkit-*.png`、背面航线近景和测量 JSON。
截图和测量产物在仓库忽略的 `artifacts/globe-lab/`，源码与测试会保存在实验分支中。

## 构建与性能实测

正式生产构建的所有输出资源文件名与大小与基线一致，包括主包
`index-CKTmc0M9.js` 585.47 KB / gzip 171.59 KB、CSS 127.20 KB。
实验、Three.js 和新纹理被 DEV 条件移除，当前正式包增加量为 0 B。
原有 >500 KB chunk 警告仍存在，本任务没有重构正式包。

独立实验渲染器审计：

| 资源                                       | 文件大小                       | 说明                                                             |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------------------- |
| Three.js + controls + Line2 + 实验渲染算法 | 588,860 B；gzip 147,709 B      | 包含本次渲染器；不是仅 Three.js 单独大小                         |
| 4096×2048 地理纹理                         | 973,494 B                      | 默认选择，保留地形清晰度                                         |
| 2048×1024 地理纹理                         | 316,798 B                      | 可在界面切换；两个纹理都本地打包，每次只加载所选档               |
| GPU 纹理估算                               | 4K 约 42.7 MiB，2K 约 10.7 MiB | RGBA8 + 完整 mipmap 数学估算，不是显存探针测量；不含 framebuffer |

最终自动化样本，DPR 1，页面 1440×900：

| 指标                          | Chromium                          | WebKit                           |
| ----------------------------- | --------------------------------- | -------------------------------- |
| 首次提交帧                    | 42.5 ms                           | 288 ms                           |
| 4K 纹理解码完成回调           | 201.1 ms                          | 30 ms                            |
| 首个带纹理的提交帧            | 327.2 ms                          | 288 ms                           |
| 2K 首个带纹理的提交帧         | 297.2 ms                          | 212 ms                           |
| 连续键盘旋转，120 个 rAF 间隔 | 19.41 Hz；中位 50 ms，P95 66.7 ms | 9.47 Hz；中位 104 ms，P95 140 ms |

初始化时间从 `createGlobe` 开始，不包含 App 模块及机场目录下载。
它们记录 JavaScript 提交帧和资源回调，不代表 GPU 完成时刻或通用首屏性能。
2K/4K 是不同缓存状态下的单次样本，不能断言降低纹理分辨率必然更快。
静止 300 ms 的帧数不变已经由浏览器断言验证；连续运动测量也没有混用闲置帧。

Chromium 的实际后端是 ANGLE / SwiftShader 软件渲染。
WebKit 返回 `Apple GPU` 标识，但本次是在 Windows Playwright 环境中运行，不能以此认定真实硬件后端。
当前连续旋转实测偏慢，**尚未满足流畅性的验收依据**。
保留 4K 默认是为了避免在未完成硬件 GPU 诊断前牺牲核心地表品质。
目前只有 DPR 上限 1.75、按需渲染、ResizeObserver 和资源释放；大档案没有做压力验证。

原始证据：`chromium/webkit-measurements.json`、`*-rotation-cadence.json`、
`browser-gpu.json`、`bundle-audit.json`。构建日志为
`artifacts/globe-baseline-build.log`、`globe-final-build.log`。

## 已执行验证

- `pnpm test`：297 项通过（Web 197、core 66、validator 31、CSS 检查器 3）。
  Web 中新增 10 项球面算法测试，覆盖亚洲/北美密集、全球分散、日界线、南半球、单航班、空数据、极区、反向与重合端点。
- `pnpm typecheck`、`pnpm build`、变更文件 Prettier 检查、`git diff --check` 通过。
- 最终 Globe Lab：Chromium 5 项、WebKit 5 项，共 10 项通过。
  覆盖直接航线点击、机场标签、键盘/鼠标操作、主题、筛选与真实档案加载、Home、Resize、
  减少动态效果、正常平滑转向、本地资源、空闲停帧、纹理失败、Context Lost、WebGL 禁用与重试。
- Globe Light/Dark 的 axe 扫描，Chromium 与 WebKit 均为 0 个 violations。
- 正式 Passport 的既有测试：Chromium Light/Dark 布局 2 项、区域/亚洲镜头 1 项，
  WebKit 区域/亚洲镜头 1 项通过；原 SVG 地图依然可操作。没有运行全部业务 E2E 矩阵。
- Firefox 实际尝试 3 项，均在启动阶段失败，`browserType.launch: spawn UNKNOWN`；
  没有报告 Firefox 通过。详情见 `artifacts/globe-cross-browser.log`。
- 短横屏允许纵向滚动；四个要求视口均无水平溢出或组件崩溃。
  真实触摸设备、长时间 GPU 压力及大档案性能尚未验证。

复现命令：

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm exec playwright test e2e/globe-lab.pw.ts --project=chromium --project=webkit --workers=1
pnpm exec playwright test e2e/passport-desktop-design.pw.ts --project=chromium --project=webkit --workers=1
node scripts/measure-globe-bundle.mjs
```

## 整合建议

可以进入项目负责人的 Light/Dark 视觉审查，暂不建议直接替换正式地图。
先确认球面构图、地表调色和航线密度是否符合方向；随后在真实硬件 GPU 上重复连续旋转测量，
定位 WebKit/软件渲染成本并测试大档案，必要时调整网格、弧线批处理和材质采样。
视觉和性能都获得明确确认后，再作为后续整合任务接入正式 Desktop Passport。
