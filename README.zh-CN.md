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
- 可录入计划/实际当地时间、机场信息、机型和座位的引导表单
- 内置超过 7,800 个 IATA 机场的离线目录，可按代码、城市和名称搜索，并包含坐标及时区
- 紧凑且可搜索的飞行历史，支持英文和简体中文名称
- 响应式航班详情时间线与按条件展示的航班信息
- 终身及按年份统计的 Flight Passport（飞行护照）
- 使用真实机场坐标和大圆航线绘制的内置世界地图
- 通过存储适配器将档案持久化到浏览器 IndexedDB
- 带摘要预览和明确替换确认的 JSON 导入，以及可迁移的 JSON 导出
- 相互独立的语言、外观、距离单位和时间格式偏好
- 原文姓名与罗马字姓名，并可选择主要显示姓名
- 统一颜色、字体、间距、控件、焦点和减少动效规则的视觉 token
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
pnpm typecheck
pnpm test
pnpm build
```

静态网站会生成在 `apps/web/dist/`；部署到静态托管服务时也应发布这个目录。

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
[airportsdata](https://github.com/mborsetti/airportsdata) 项目生成，并随静态查看器一同分发。
它只提供机场参考信息，不是实时航班计划或状态服务。来源和许可证见
[第三方声明](THIRD_PARTY_NOTICES.md)；需要主动更新固定版本时可运行 `pnpm update:airports`。

导入会先校验文件，并展示档案姓名、航班数量和日期范围；在用户明确确认前不会修改数据。替换已有档案时，同一流程会提供先导出备份的入口。

更多细节请阅读[架构说明](docs/architecture.md)、[数据格式说明](docs/schema.md)、[视觉系统](docs/design-system.md)和[部署指南](docs/deployment.md)。

## 状态与范围

本仓库已经完成第一阶段的本地查看器。明确推迟的功能列在 [docs/not-implemented.md](docs/not-implemented.md) 中。

[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) 记录了已完成工作、验证结果和各阶段 commit。

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
