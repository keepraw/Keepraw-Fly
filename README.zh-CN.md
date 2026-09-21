# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**一个开放的飞行历史数据格式，以及本地优先的 Web 查看与编辑器。**

Keepraw Fly 使用可读的 JSON 文档保存可迁移的飞行事实，并在查看器中派生搜索结果、延误、距离和飞行护照统计。

> 数据比应用更长久。

> Keepraw Fly 保存事实，查看器派生意义。

## 0.1 已实现功能

- Keepraw Fly 0.1 JSON Schema 与 Ajv 校验器，并提供清晰的错误路径
- 一份包含 24 段虚构航班、跨越多个国家与时区的演示档案
- 无需准备 JSON 文件的首次建档流程，以及带有明确标识的演示模式
- 可录入计划/实际当地时间、客票号、订座编号、行李转盘、常旅客、机场、机型和座位信息的引导表单；客票号与订座编号分别保存
- 最近机场建议和“复制为新航班”操作可加快重复录入，并且绝不会复用原记录 ID
- 内置超过 7,800 个 IATA 机场的离线目录，可按代码、城市和名称搜索，并包含坐标及时区；目录以可独立缓存的静态资源分发
- 内置英文、简体中文和繁体中文航司资料，以及来自 Wikidata CC0 的中文机场本地化覆盖层
- 支持多机场城市别名，展示城市下的具体候选机场，并始终保存明确的机场 IATA 代码
- 高级且可搜索的行程卡片，集中展示机场城市、当地时间和运行状态
- 与 Stitch 视觉参考对齐的响应式航班详情，同时保留真实航线地图、动态数据绑定、编辑和导航行为
- 航班详情文案、日期、航司与机场名称均按 locale 展示；简体/繁体中文使用明确的 UI 字体栈，拉丁字母代码、数字和时间继续使用 Inter
- 常旅客账户作为用户级实体保存，航班通过 `membershipId` 引用账户，并以 `tierAtFlight` 固化乘机时的历史等级
- 关联航司支持可搜索多选、轻量可删除标签和规范航司代码；默认航司只能来自已关联航司
- 终身及按年份统计的 Flight Passport（飞行护照）
- 使用 Natural Earth 底图、真实机场坐标、地图投影和大圆航线绘制的内置世界地图
- 通过存储适配器将档案持久化到浏览器 IndexedDB
- 带摘要预览和明确替换确认的 JSON 导入，以及可迁移的 JSON 导出
- CSV 批量导入，支持自动/手动列映射、前五行预览、严格时区校验和仅确认后追加
- 将早期 `rawfly` / `0.1` 档案以及旧版客票、行李和常旅客扩展明确迁移至规范的 Keepraw Fly 0.1.0，且不丢失航班事实
- 相互独立的语言、外观、距离单位和时间格式偏好
- 原文姓名与罗马字姓名，并可选择主要显示姓名
- 统一的高级视觉 token，以及可复用的机场代码、航班状态和航空图标组件
- 克制的纯 CSS 页面、卡片与航线过渡，并完整支持系统“减少动态效果”设置
- 跟随系统/浅色/深色主题、自动 WCAG 检查，以及支持焦点约束和 Escape 关闭的航班编辑器
- 无后端、不会上传用户数据的静态生产构建

## 在本地运行

环境要求：Node.js 20.19 或更高版本，以及 pnpm。

首先在仓库根目录安装一次依赖：

```bash
pnpm install
```

日常开发时，启动带热更新的 Vite 开发服务器：

```bash
pnpm dev
```

打开终端输出的网址，通常是 <http://localhost:5173>。

### 在本地打开生产构建

`pnpm build` 只负责生成静态文件，并不会自动打开网站。请依次运行：

```bash
pnpm build
pnpm preview
```

然后在浏览器打开 <http://127.0.0.1:4173>。如果 4173 端口被占用，请打开
Vite 在终端中显示的备用网址。查看结束后，在终端按 `Ctrl+C` 停止预览服务器。

不要直接双击 `apps/web/dist/index.html`。Keepraw Fly 使用浏览器模块和
IndexedDB，因此生产文件应通过上面的本地 HTTP 服务器打开。

运行全部检查：

```bash
pnpm check:docs
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

GitHub Actions 会在每个 pull request 和每次推送到 `main` 时，使用冻结的
lockfile 重新安装依赖，并执行相同的文档一致性检查、类型检查、单元测试、Chromium
用户流程和生产构建。

静态网站会生成在 `apps/web/dist/`；可手动发布到静态托管服务，或通过仓库外部配置的托管流程部署。详见[部署指南](docs/deployment.md)。

## 仓库结构

```text
apps/
  web/                 React、Vite、IndexedDB 与用户交互
packages/
  schema/              Keepraw Fly 类型定义与 JSON Schema
  validator/           Ajv 数据校验与易读的问题提示
  core/                搜索、计算、统计与参考数据
examples/              小型、可迁移的示例文档
docs/                  架构、数据格式与部署说明
```

界面不会直接调用 Dexie，而是统一使用 `StorageAdapter`；首个实现是 `BrowserStorageAdapter`。查看器偏好与可迁移的飞行文档分开存储。

## 数据与隐私

默认构建是完全静态的。除非用户主动导出文件，否则飞行数据只保存在浏览器的 IndexedDB 中。Keepraw Fly 没有服务器、账户系统、分析 SDK 或实时航班状态 API。

机场参考数据由采用 MIT 许可证的
[airportsdata](https://github.com/mborsetti/airportsdata) 项目生成，并作为独立的本地静态资源随查看器分发。
它只提供机场参考信息，不是实时航班计划或状态服务。来源和许可证见
[第三方声明](THIRD_PARTY_NOTICES.md)；需要主动更新固定版本时可运行 `pnpm update:airports`。
航司中英文名称与机场中文名覆盖层来自 Wikidata CC0，并完整打包为离线资源；可分别运行
`pnpm update:airlines` 与 `pnpm update:airport-locales` 更新，查看器运行时不会请求网络。

飞行护照底图由固定版本、公共领域的 Natural Earth 矢量数据和采用 ISC 许可证的
`d3-geo` 投影库生成。优化后的 SVG 路径随应用离线打包，并仅在打开飞行护照时加载；
运行时不会请求地图瓦片或位置服务。
来源和许可证见[第三方声明](THIRD_PARTY_NOTICES.md)；只有主动更新固定数据源时才运行
`pnpm update:world-map`。

导入会先校验文件，并展示档案姓名、航班数量和日期范围；在用户明确确认前不会修改数据。替换已有档案时，同一流程会提供先导出备份的入口。

CSV 导入位于“设置 → 数据”。它会映射六个必填列（航班号、航班日期、出发机场
IATA、到达机场 IATA、计划出发和计划到达），预览最多五行，并仅在确认后追加。
计划时间必须包含明确的时区偏移。示例见 [`examples/flights.csv`](examples/flights.csv)。

更多细节请阅读[架构说明](docs/architecture.md)、[数据格式说明](docs/schema.md)、[视觉系统](docs/design-system.md)和[部署指南](docs/deployment.md)。

需要借助外部工具探索 UI 时，可使用 [Google Stitch 设计简报](docs/stitch-ui-brief.md)。
其中包含可直接粘贴的主提示词、分屏生成顺序、虚构样例数据、原创性与许可证约束，
以及整合验收标准。生成代码只作为视觉参考，不能替换应用已经通过测试的行为。

## 状态与范围

本仓库已经完成第一阶段的本地查看器。明确推迟的功能列在 [docs/not-implemented.md](docs/not-implemented.md) 中。

[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) 记录了已完成工作、验证结果和各阶段 commit。

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
