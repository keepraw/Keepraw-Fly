# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**一个开源、本地优先的个人航班档案与飞行护照。**

Keepraw Fly 将飞行历史保存在可迁移的 JSON 档案中。移动端以飞行护照为主要入口，可继续探索航班记录和详情。使用时无需账号，默认构建也没有保存用户航班数据的后端。

> 数据比应用更长久。

## 飞行护照

飞行护照汇总全部或选定年份的航班数、距离、空中时间和已记录的延误时间，也统计国家、机场、航空公司和机型。移动端首先展示概要、延误及航线网络面板，然后是航班亮点和可搜索的航班历史。选择机场、航司或航线亮点可以查看相关航班；护照航线地图也可以用于探索记录。

## 航班档案与详情

- 搜索航班历史并按年份筛选；新增、编辑、复制或删除航班。
- 保存计划与实际当地时间、取消和备降信息、出发和到达的登机口与航站楼，以及可选的行李转盘信息。
- 查看抵达晚点或提前、飞行时间和距离，以及已记录的机型、座位、舱位、客票号、订座编号（PNR）、注册号和常旅客信息。
- 桌面端的航班详情将行程、航线地图和档案字段组合展示；移动端使用紧凑的行程和档案布局，不展示详情页地图。

## 导入与备份

打开 **设置 → 数据**，在导入真正修改档案前先查看预检结果。

- **Flighty CSV：** 从 Flighty CSV 导出文件导入受支持的字段，并在本地规范化航司代码和航班号。这是单向导入，不代表完全兼容 Flighty 格式或支持同步。
- **Keepraw Fly CSV 批量导入：** 按正式 Keepraw Fly 字段批量导入航班，支持自动或手动列映射。
- **JSON 档案：** 导入或导出可迁移的 Keepraw Fly JSON，用于备份或在浏览器之间转移数据。

导入前会展示预览，确认后将新航班加入现有档案；完全重复的记录会跳过，可能重复的记录可在导入前检查并决定是否纳入。两种 CSV 流程都会在写入前校验文件。CSV 时间可以填写无时区偏移的机场当地时间，Keepraw Fly 会根据机场的 IANA 时区解析并处理夏令时变化；带 offset 或 `Z` 的 RFC 3339 时间也受支持。

## 本地数据、语言与外观

- 航班档案默认保存在浏览器 IndexedDB 中。
- 没有账号系统、云同步，也没有 Keepraw Fly 后端保存用户航班数据。
- 默认构建是静态网站，不会把航班记录上传到服务器，也不使用分析 SDK。
- 请定期导出 portable JSON 档案作为备份。清除浏览器数据可能会删除本地档案。
- 查看器偏好与可迁移的航班档案分开保存。
- 界面支持英文、简体中文和繁體中文，支持浅色、深色及跟随系统的外观，并适配桌面与移动端。

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

## 开发与验证

仓库提供文档一致性检查、TypeScript 检查、单元测试、生产构建和 Playwright 端到端测试，其中包含响应式流程检查。GitHub Actions 会针对 Pull Request 和主分支运行这些检查。

```bash
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

在本地运行端到端测试前，可执行 `pnpm exec playwright install chromium` 安装 Playwright 浏览器。

## 数据格式

Keepraw Fly 档案使用可迁移的 `keepraw-fly` JSON 格式，当前格式版本为 `0.1.0`。在正常的导入、编辑和导出流程中，校验器会保留规范数据以及命名空间扩展字段。

数据契约请阅读[数据格式说明](docs/schema.md)和规范的 [JSON Schema](packages/schema/keepraw-fly.schema.json)；存储与导入边界见[架构说明](docs/architecture.md)。

## 文档

- [数据格式](docs/schema.md)
- [架构](docs/architecture.md)
- [部署](docs/deployment.md)
- [明确推迟的范围](docs/not-implemented.md)
- [实施状态](IMPLEMENTATION_STATUS.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称、Logo 或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
