# Keepraw Fly

**开源、本地优先的个人航班档案与飞行护照。**

[开发者 Demo](https://fly.keepraw.com) · [English](README.md)

> 数据比应用更长久。

## 开发者 Demo

**[https://fly.keepraw.com](https://fly.keepraw.com) 是开发者提供的 Demo**，用于在浏览器中体验 Keepraw Fly。可选择演示模式浏览虚构的示例航班，也可以创建个人档案。航班记录保存在当前浏览器中；Demo 不提供账号或云端同步。

你也可以[本地运行](#本地运行)或[自行部署](docs/deployment.md)。Demo 与其他站点的数据按来源（origin）隔离；迁移前请导出 JSON 备份。

## 主要功能

- **飞行护照：** 浏览全部或指定年份的航班、距离、空中时间、延误、机场、航司、机型与航线亮点。
- **航班档案与详情：** 搜索、筛选、新增、编辑、复制航班，并查看完整记录。
- **航线可视化：** 在桌面端飞行护照和航班详情地图中浏览已记录航线。
- **可迁移数据：** 导出及迁移经过验证的 Keepraw Fly JSON 档案；写入前预览 JSON、Keepraw Fly CSV 和 Flighty CSV。
- **常旅客资料：** 将常旅客计划关联至多个航司及航班记录。
- **本地优先：** 航班历史保存在浏览器中；无需账号，也没有保存航班历史的云端后端。
- **跨设备设计：** 适配桌面与移动端，支持英文、简体中文和繁體中文。

## 本地数据与隐私

航班记录默认保存在当前来源（origin）的 IndexedDB 中。Keepraw Fly 没有账号系统，也没有保存用户航班历史的云端后端。默认静态构建不会上传航班记录，也不包含分析 SDK。

持久存储是浏览器提供的可选能力。浏览器支持并授予时，可降低因存储空间压力自动清理本站数据的概率；它不能防止手动清除网站数据，不保证永久保存，也不能替代 JSON 备份。申请持久存储无需安装为应用，安装也不代表浏览器已授予持久存储。

JSON 导出是主要的备份与迁移手段。建议定期导出 Keepraw Fly JSON 档案，并在更换浏览器、设备或清除网站数据前备份。

机场、航司和地图资源是随应用提供的参考数据，并非实时航班状态服务。来源与许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

## 导入与备份

打开**设置 → 数据与备份**，在导入修改档案之前查看预检结果。

- **Keepraw Fly JSON：** 导入或导出完整、可迁移的档案，用于备份及迁移。
- **Keepraw Fly CSV 批量导入：** 映射并验证文档定义的字段，再添加记录。
- **Flighty CSV：** 从 Flighty 导出文件导入受支持字段；这是单向导入，不是同步，也不代表完全兼容 Flighty 格式。

导入到现有档案时会追加航班，保留当前个人资料和已有记录。完全重复的记录会跳过，可能重复的记录可在导入前检查；两种 CSV 流程都会在写入前验证每一行。没有现有档案时，JSON 导入会保留源文件的个人资料与文档元数据。参见[格式与 CSV 字段说明](docs/schema.md)和[示例文件](examples/)。

机场当地时间使用内置 IANA 时区数据解析；也支持带 offset 或 `Z` 的 RFC 3339 时间。

## 本地运行

环境要求：Node.js 20.19 或更高版本，以及 pnpm 10.14.0。CI 使用 Node.js 24。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

打开 <http://localhost:5173>。开发服务固定使用此端口，端口被占用时会退出。

通过 HTTP 检查生产构建：

```bash
pnpm build
pnpm preview
```

打开 <http://127.0.0.1:4173>（默认预览地址）。构建产物需通过 HTTP 服务访问，不支持直接打开 `apps/web/dist/index.html`。

## 开发

```bash
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e --project=chromium
```

需要时先运行 `pnpm exec playwright install chromium`。Chromium 运行完整 E2E 回归；Firefox 和 WebKit 仅运行带标记的兼容性 smoke，命令为 `pnpm test:e2e --project=firefox --project=webkit`（先安装对应浏览器）。分层和新增测试规则见[测试说明](docs/testing.md)。`pnpm check:docs` 会检查功能说明、Demo 标注及文档中的本地链接。GitHub Actions 会针对 Pull Request 和 `main` 运行仓库检查，并在 `main` 检查通过后部署到 GitHub Pages。配置方式见[部署说明](docs/deployment.md)。

## 数据格式

Keepraw Fly 使用可迁移的 `keepraw-fly` JSON 格式，并执行结构与语义校验。命名空间扩展随所属记录保留；向现有档案追加航班时，保留当前档案的文档级元数据。参见[数据格式说明](docs/schema.md)、[JSON Schema](packages/schema/keepraw-fly.schema.json)和[架构说明](docs/architecture.md)。

## 文档

- [架构](docs/architecture.md)
- [视觉系统](docs/design-system.md)
- [部署](docs/deployment.md)
- [数据格式](docs/schema.md)
- [当前功能边界](docs/not-implemented.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称、Logo 或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
