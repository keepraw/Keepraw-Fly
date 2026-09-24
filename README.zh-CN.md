# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**一个开源、本地优先的个人飞行记录与 Flight Passport，让你的旅行历史真正属于你。**

Keepraw Fly 将航班事实保存为可迁移的 JSON 档案，并据此提供可搜索的航班列表、航班详情、航线地图和飞行护照统计。它面向个人使用：不需要账号，默认构建也没有保存用户航班数据的后端。

> 数据比应用更长久。

## 你可以做什么

- 新增、编辑、复制和删除航班记录。
- 保存计划与实际当地时间、取消和备降信息，以及出发/到达航站楼和登机口。
- 记录客票号、订座编号、机型、注册号、座位、舱位、订座舱和常旅客会员。
- 按航班、机场、城市、航司、机型和年份搜索。
- 查看包含当地时间、运行状态、航线地图、距离和时长的航班详情。
- 使用 Flight Passport 查看终身或按年份统计，包括航班、距离、飞行时间、机场、航司、国家和航线。
- 使用英文、简体中文或繁體中文界面，并支持浅色、深色、跟随系统主题以及桌面/移动端布局。

## 导入现有航班

打开 **设置 → 数据**，在导入真正修改档案前先查看预检结果。

- **Flighty CSV：** 直接导入 Flighty 原生导出文件。Flighty 的航司代码与航班号会在本地规范化，支持的字段会映射到 Keepraw Fly canonical 数据模型。
- **Keepraw Fly CSV 批量导入：** 按正式 Keepraw Fly 字段批量导入航班，支持自动或手动列映射。
- **JSON 档案：** 导入或导出可迁移的 Keepraw Fly JSON，用于备份或在浏览器之间转移数据。

两种 CSV 流程都会先校验完整文件并展示预览，确认后才会写入。CSV 时间填写对应机场的当地时间，无需填写 offset；Keepraw Fly 会根据机场的 IANA 时区自动解析，并处理夏令时变化。旧 CSV 中带 offset 或 `Z` 的 RFC 3339 时间仍然兼容。

## 数据属于你

- 航班档案默认保存在浏览器 IndexedDB 中。
- 没有账号系统、云同步，也没有 Keepraw Fly 后端保存用户航班数据。
- 默认构建是静态网站，不会把航班记录上传到服务器，也不使用分析 SDK。
- 请定期导出 portable JSON 档案作为备份。清除浏览器数据可能会删除本地档案。
- 查看器偏好与可迁移的航班档案分开保存。

机场、航司和地图参考资源随应用一起打包。它们只提供参考信息，不是实时航班状态服务。来源和许可证见[第三方声明](THIRD_PARTY_NOTICES.md)。

## 快速开始

### 使用应用

当前仓库没有配置公开在线 Demo。你可以在本地运行应用，或按照[部署指南](docs/deployment.md)发布静态构建。

### 本地运行

环境要求：Node.js 20.19 或更高版本，以及 pnpm。

```bash
pnpm install
pnpm dev
```

打开 Vite 在终端输出的网址，通常是 <http://localhost:5173>。

要在本地检查生产构建：

```bash
pnpm build
pnpm preview
```

打开 Vite 输出的网址，通常是 <http://127.0.0.1:4173>。不要直接打开 `apps/web/dist/index.html`；生产构建需要通过 HTTP 服务访问，浏览器模块和 IndexedDB 才能正常工作。

## 数据格式

Keepraw Fly 档案使用可迁移的 `keepraw-fly` JSON 格式，当前格式版本为 `0.1.0`。在正常的导入、编辑和导出流程中，校验器会保留规范数据以及命名空间扩展字段。

数据契约请阅读[数据格式说明](docs/schema.md)和规范的 [JSON Schema](packages/schema/keepraw-fly.schema.json)；存储与导入边界见[架构说明](docs/architecture.md)。

## 0.1.0

Keepraw Fly 0.1.0 是第一个以可靠本地航班档案为重点的正式版本，包含引导式编辑、Flight Passport、portable JSON、Keepraw Fly CSV 与 Flighty 原生 CSV 导入、机场当地时间处理、取消/备降信息，以及响应式多语言查看体验。

后端账号、同步、实时航班服务、预订平台集成和原生应用有意不属于本版本范围，详见[明确推迟的范围](docs/not-implemented.md)。

## 文档

- [数据格式](docs/schema.md)
- [架构](docs/architecture.md)
- [部署](docs/deployment.md)
- [明确推迟的范围](docs/not-implemented.md)
- [实施状态](IMPLEMENTATION_STATUS.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称、Logo 或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
