# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**一个开放的飞行历史数据格式，以及本地优先的 Web 查看器。**

Keepraw Fly 使用可读的 JSON 文档保存可迁移的飞行事实，并在查看器中派生搜索结果、延误、距离和飞行护照统计。

> 数据比应用更长久。

> Keepraw Fly 保存事实，查看器派生意义。

## 0.1 已实现功能

- Keepraw Fly 0.1 JSON Schema 与 Ajv 校验器，并提供清晰的错误路径
- 一份包含 24 段虚构航班、跨越多个国家与时区的演示档案
- 紧凑且可搜索的飞行历史，支持英文和简体中文名称
- 响应式航班详情时间线与按条件展示的航班信息
- 终身及按年份统计的 Flight Passport（飞行护照）
- 通过存储适配器将档案持久化到浏览器 IndexedDB
- 经过校验的 JSON 导入与导出，并保留未知扩展字段
- 相互独立的语言、外观、距离单位和时间格式偏好
- 原文姓名与罗马字姓名，并可选择主要显示姓名
- 无后端、不会上传用户数据的静态生产构建

## 本地启动

环境要求：Node.js 20.19 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

然后打开 Vite 输出的本地地址。运行全部检查：

```bash
pnpm typecheck
pnpm test
pnpm build
```

静态网站会生成在 `apps/web/dist/`。

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

当前的导入行为会先校验文件，再替换本地正在使用的档案。如需保留现有档案，请先导出备份。

更多细节请阅读[架构说明](docs/architecture.md)、[数据格式说明](docs/schema.md)和[部署指南](docs/deployment.md)。

## 状态与范围

本仓库已经完成第一阶段的本地查看器。明确推迟的功能列在 [docs/not-implemented.md](docs/not-implemented.md) 中。

[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) 记录了已完成工作、验证结果和各阶段 commit。

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
