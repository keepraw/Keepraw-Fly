# Task 1B-1：Cinematic Globe 光影实验

**Visual approval pending。仅供实验审查，不代表正式视觉验收通过。**

本轮以 `04fb505` 的 Globe Lab 为视觉基线，重构地表光照、城市夜光与大气边缘。
实验仍只通过开发环境的 `/globe-lab` 进入。正式 Passport SVG、归档、统计、详情、
移动布局、Schema、存储与过滤逻辑未改变。未修改默认视角评分、航线几何或弧高。

## 技术方案

- 将太阳与地表法线统一到世界坐标。太阳根据既有默认机位构图设置一次，随后固定；
  旋转、选择和主题切换不再把太阳绑定到屏幕。Demo 太阳方向为
  `[0.7978800943, 0.5277711247, -0.2912816421]`。
- 用法线与太阳的点积区分日面、暮光与夜面，使用连续的 `smoothstep` 过渡；
  保留海底地形与真实地表明暗纹理，海洋低亮度深蓝，陆地进行冷蓝分级。
  海面加入低强度、窄范围的半程向量反射，避免大块白色反光。
- NASA Black Marble 2016 灰度夜光与 Blue Marble 使用同一等距经纬 UV。
  夜光按强度形成暖白/金色分布，由同一太阳方向在日面逐渐抑制。
  没有随机城市点、预渲染球体照片、屏幕贴图、bloom 或后处理合成器。
- 大气壳半径为 `1.026`，采用视线掠过球体的高度密度近似，加上太阳方向与
  Rayleigh 相函数近似；向日边缘更亮、背日边缘更暗。地表切线处加入同源散射，
  衔接外壳。这是轻量近似，并非完整物理散射积分或完整 Rayleigh/Mie 模型。
- Blue Marble 标记为 sRGB，由 GPU 转到线性采样；夜光是 `NoColorSpace`
  强度数据。着色在线性空间完成，经过 ACES Filmic、曝光 `1` 与 sRGB 输出。
- 调试区提供 Earth only、地表/夜光/大气开关，以及日照、暮光宽度、大气、夜光
  四个参数。默认值分别为 `2.2 / 0.18 / 1 / 1.6`。调试不写入档案或设置。
- 按需渲染、像素比上限、拖动/滚轮/触摸/键盘、选择、遮挡规则沿用既有实现。
  两张纹理都加载成功后才标记 ready；任何一张失败均可回退到本地 SVG 后重试。
  新纹理随场景释放，保持上下文丢失处理。

## 本轮修改文件

| 文件                                                               | 用途                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------- |
| `apps/web/src/globe/globe-lighting.ts`                             | 默认参数、世界坐标太阳、地表与大气 GLSL              |
| `apps/web/src/globe/globe-renderer.ts`                             | 双纹理、颜色管理、层可见性、参数更新、释放与证据状态 |
| `apps/web/src/globe/GlobeMap.tsx`                                  | 将光照状态传入渲染器，Earth only 隐藏图例            |
| `apps/web/src/globe/GlobeLab.tsx`                                  | 本地调试控件与夜光署名                               |
| `apps/web/src/globe/globe-lab.css`, `lab-locales.ts`               | 调试控件样式及英/简/繁标签                           |
| `apps/web/src/globe/assets/night-{2048,4096}.webp`                 | 本地真实夜光强度                                     |
| `apps/web/src/globe/globe-night-texture.source.json`               | 来源、条款、范围、尺寸、字节与 SHA-256               |
| `scripts/generate-globe-night-textures.py`                         | 有源校验的离线纹理生成                               |
| `scripts/capture-globe-lighting.mjs`, `measure-globe-lighting.mjs` | 真实浏览器截图与硬件/软件测量                        |
| `e2e/globe-lighting.pw.ts`                                         | 实际像素、层开关、太阳稳定性、新纹理回退测试         |
| `THIRD_PARTY_NOTICES.md`                                           | NASA 夜光使用与署名记录                              |
| 本报告与 `docs/visual-review/task-1b-1/`                           | 固定数据的前后截图与原始测量                         |

## 本地资源与使用条件

使用 [NASA Earth at Night / Black Marble 2016 官方平面地图](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/)，
原始灰度 JPEG 为 `13500 × 6750`、3,064,569 字节。全球范围
`[-180, -90, 180, 90]`，左到右经度 -180 至 +180，上到下纬度 +90 至 -90。
源 SHA-256 为 `3fbc8aae3529dc1ebfcf3aa9361bd3dfc11d19950a6af6d8ed2df61bd8b0134d`。
Lanczos 降采样后以无损 WebP 保存：2K 为 125,466 字节，4K 为 401,034 字节。
其输出 SHA-256 与固定下载地址详见来源 JSON。

署名 NASA Earth Observatory / Joshua Stevens，Suomi NPP VIIRS 数据来自 Miguel Román,
NASA GSFC。遵循 [NASA 影像使用指南](https://www.nasa.gov/nasa-brand-center/images-and-media/)，
不暗示 NASA 背书。它是 2016 年历史合成影像，不是实时灯光或经过本应用标定的辐射值。
日间 Blue Marble 沿用既有来源。所有运行纹理在本地，运行时无外部影像请求。

## 验证

| 检查                                     | 结果                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm test`                              | 297 通过：Web 197、Core 66、Validator 31、CSS 3                                                |
| `pnpm typecheck`、`pnpm build`           | 通过                                                                                           |
| 既有 `e2e/globe-lab.pw.ts`               | Chromium 5 + WebKit 5，10 通过                                                                 |
| 新增 `e2e/globe-lighting.pw.ts`          | Chromium 2 + WebKit 2，4 通过，最终反射参数下复核                                              |
| 正式 `e2e/passport-desktop-design.pw.ts` | Chromium 3 + WebKit 1，4 通过                                                                  |
| Axe Light/Dark                           | Chromium/WebKit 各主题均 0 violations                                                          |
| 新增实际像素验证                         | Chromium 夜光暖色像素 3,124 → 0；全部层关闭后地球内部亮度 0；控制台/页面错误 0                 |
| 正式生产资源对比                         | 相对 `04fb505` 的 9 个资源文件名称、字节数、SHA-256 全部一致；实验 Three.js/纹理未进入正式产物 |
| 格式与 `git diff --check`                | 通过                                                                                           |
| Firefox                                  | 2 项在启动前失败：`browserType.launch: spawn UNKNOWN`，无法确认 Firefox 兼容性                 |

正式地图 WebKit 首次运行的 trace 目录被另一测试进程清理，产生 ENOENT；
使用独立输出目录重跑通过。这是测试产物冲突，不作为浏览器兼容性通过证据的替代。

## 性能与成本

固定 Windows、1440 × 900、DPR 1、Demo 全部年份、完整地球。每次先暖机 30 个
RAF，再记录 120 个旋转间隔。以下均为单次观测，存在调度和缓存波动。
RAF 节奏包含浏览器/驱动工作，不是原生 FPS 计数器；引擎 `lastFrameMs` 是 JS 提交时间，
不能拿来宣称 GPU 帧耗时。原始记录保存在审查目录的 JSON 中。

| 后端/质量             | 旋转 Hz 前 → 后 | 中位间隔 ms 前 → 后 | p95 ms 前 → 后 | 有纹理首帧 ms 前 → 后 |
| --------------------- | --------------- | ------------------- | -------------- | --------------------- |
| Intel UHD / D3D11，4K | 59.99 → 60.00   | 16.7 → 16.7         | 16.8 → 16.8    | 221.2 → 273.6         |
| Intel UHD / D3D11，2K | 60.00 → 60.01   | 16.7 → 16.7         | 16.8 → 16.8    | 103.2 → 122.2         |
| SwiftShader，4K       | 19.00 → 13.21   | 50.0 → 83.3         | 66.7 → 83.4    | 322.4 → 404.9         |
| SwiftShader，2K       | 19.25 → 11.80   | 50.0 → 83.3         | 66.7 → 100.0   | 259.7 → 320.4         |

Chrome 与 Edge 都成功读取到 `Intel(R) UHD Graphics ... Direct3D11`，正式硬件对比
使用 Chrome 的 `--use-angle=d3d11 --ignore-gpu-blocklist`。默认 Playwright Chromium
读取到 Vulkan SwiftShader；不把它当作实际 Intel GPU。两条路径所有质量在最后一次
待处理渲染结束后，静止 300 ms 都新增 0 帧。完整场景仍为 45 draw calls。

4K 首帧（未必已经有纹理）硬件 72.2 → 85.9 ms、软件 43.2 → 45.2 ms。
软件渲染明显退化，2K 在本次观测也没有改善旋转节奏；不以硬件约 60 Hz 掩盖该不足。
硬件约 60 Hz 受观测节奏限制，不能推断还剩多少 GPU 余量。

按 RGBA8 + 完整 mipmap 估算，两张 4K 纹理约 **85.3 MiB**，原来一张约 42.7 MiB；
2K 两张约 **21.3 MiB**，原来约 10.7 MiB。这仅是纹理估算，不是显存实测，
未计入 MSAA、帧缓冲、几何和驱动开销。4K 纹理下载总量 1,374,528 字节，
2K 为 442,264 字节。独立渲染器审计 JS 为 592,924 字节、gzip 148,804 字节，
相对前一轮增加 4,064 / 1,095 字节。正式生产包新增 0 字节。

## 截图与诚实视觉判断

全部为真实系统 Chrome/Intel D3D11 截图，未拼接、修图或生成替代画面。
见 [前后比较与全部图片](visual-review/task-1b-1/README.md)。截图 metadata 记录实际机位、
主题、质量、光照默认值与 GPU；前后默认机位完全一致，固定 Demo 24 航班/23 航线/20 机场。
基线是旧版本默认参数，新版本是本报告默认参数，比较时不为某张图临时调参。

已改善：地表出现连贯的昼夜分界；城市夜光与真实海岸、内陆城市分布吻合；
蓝色大气随太阳方向变亮而非均匀描边；浅色海陆和地形层次有所增加。

仍有不足：陆地仍带较强的冷蓝分级和地图质感，尚未达到参考图的完整照片感；
没有参考图中的云层和精细空间光散射，亮侧冰雪/大陆细节有压缩；大气为近似，部分
旋转角度仍能看出壳层边缘。浅色夜光较弱，不能期待与深色相同的戏剧效果。
当前默认北美取景、下缘裁切和密集跨太平洋航线仍沿用 Task 1，与参考图的亚洲构图
有明显差别，本轮不改动这些。后续可另行审查航线密度、弧线重叠、亚洲/北美机位与
取景裁切，但不包含在本轮实现内。

**Visual approval pending**：技术与交互验证通过不等于正式视觉验收；不应替换正式地图。
实验 PR 以 `codex/desktop-passport-redesign-checkpoint` 为 Base，
`codex/globe-prototype-experiment` 为 Head，保持 Draft，不合并、不自动合并、不修改 PR #33。

## 复现

先 `pnpm dev`，打开 `/globe-lab`。使用独立基线副本的服务器（本次为 5174）时：

```sh
node scripts/capture-globe-lighting.mjs before http://127.0.0.1:5174/globe-lab chrome
node scripts/capture-globe-lighting.mjs after http://127.0.0.1:5173/globe-lab chrome
node scripts/measure-globe-lighting.mjs http://127.0.0.1:5173/globe-lab after-hardware.json chrome
node scripts/measure-globe-lighting.mjs http://127.0.0.1:5173/globe-lab after-software.json software
pnpm exec playwright test e2e/globe-lab.pw.ts e2e/globe-lighting.pw.ts --project=chromium --project=webkit --workers=1
```

NASA 原始文件从来源 JSON 的固定 URL 下载后，可用带 Pillow 的 Python 运行
`scripts/generate-globe-night-textures.py` 重新生成；源哈希不匹配时脚本拒绝处理。
