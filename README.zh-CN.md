# Keepraw Fly

**开源、本地优先的个人航班档案与飞行护照。**

[开发者 Demo](https://fly.keepraw.com) · [English](README.md)

> 数据比应用更长久。

## 开发者 Demo

**[https://fly.keepraw.com](https://fly.keepraw.com) 是开发者提供的 Demo**，用于在浏览器中体验 Keepraw Fly。可选择演示模式浏览虚构的示例航班，也可以创建个人档案。航班记录保存在当前浏览器中；Demo 不提供账号或云端同步。

普通用户无需安装 Node.js、pnpm 或自行编译。Demo 与其他站点的数据按来源（origin）隔离；迁移前请导出 JSON 备份。

## GitHub Pages 自托管（零编译）

Fork 本仓库 → 在 Actions 启用工作流 → Settings → Pages 选择 GitHub Actions → 手动运行 **Deploy official release to Fork Pages**，选择 **v0.1.0**。它下载并校验官方发行包，不执行依赖安装、编译或完整 E2E，支持项目子目录和自定义域名。升级由你明确选择。

**预构建模式不会运行 Fork 自己修改的源码。** 详见[中文部署指南](docs/deployment.zh-CN.md)。

## VPS 自托管（Docker）

安装 Docker 与 Compose v2 → 下载、校验并检查官方固定版本安装器 → 配置域名 → 使用 HTTPS 访问。只运行一个 Caddy 静态服务容器，无需 JavaScript 工具链。支持 amd64/arm64、digest 固定镜像、重复安装、升级与回滚。

从 [v0.1.0 Release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0) 获取安装器或直接可部署的 ZIP/tar.gz，按[中文 VPS 安装说明](docs/deployment.zh-CN.md#vpsdocker-与自动-https)执行。官方发布者与镜像作者为 **keepraw**。

## 主要功能

- **飞行护照：** 浏览全部或指定年份的航班、距离、空中时间、延误、机场、航司、机型与航线亮点。
- **航班档案与详情：** 搜索、筛选、新增、编辑、复制航班，并查看完整记录。
- **航线可视化：** 在桌面端飞行护照和航班详情地图中浏览已记录航线。
- **可迁移数据：** 导出及迁移经过验证的 Keepraw Fly JSON 档案；写入前预览 JSON、Keepraw Fly CSV 和 Flighty CSV。
- **常旅客资料：** 将常旅客计划关联至多个航司及航班记录。
- **本地优先：** 航班历史保存在浏览器中；无需账号，也没有保存航班历史的云端后端。
- **跨设备设计：** 适配桌面与移动端，支持简体中文、繁体中文（台湾）、美式英语、英式英语、日语、法语、德语、西班牙语、巴西葡萄牙语和韩语。

## 本地数据与隐私

航班记录默认保存在当前来源（origin）的 IndexedDB 中。Keepraw Fly 没有账号系统，也没有保存用户航班历史的云端后端。默认静态构建不会上传航班记录，也不包含分析 SDK。

持久存储是浏览器提供的可选能力。浏览器支持并授予时，可降低因存储空间压力自动清理本站数据的概率；它不能防止手动清除网站数据，不保证永久保存，也不能替代 JSON 备份。申请持久存储无需安装为应用，安装也不代表浏览器已授予持久存储。

不同域名、浏览器和设备的数据彼此独立；同一来源的项目路径不提供存储隔离。部署新版本不会主动清除档案；Docker 升级不等于个人数据备份或迁移。VPS 只托管网页，不保存航班档案。

JSON 导出是主要的备份与迁移手段。建议定期导出 Keepraw Fly JSON 档案，并在更换浏览器、设备或清除网站数据前备份。

机场、航司和地图资源是随应用提供的参考数据，并非实时航班状态服务。来源与许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

中文 UI 字体沿用固定版本 `misans-webfont@4.3.1` 的 jsDelivr MiSans / MiSans TC；仅中文语言加载相应 CSS 和 WOFF2 子集，拉丁语言使用 Inter/系统字体，日语和韩语使用系统字体。第三方服务接收正常资源请求元数据，不接收航班档案；失败时回退系统字体。

## 导入与备份

打开**设置 → 数据与备份**，在导入修改档案之前查看预检结果。

- **Keepraw Fly JSON：** 导入或导出完整、可迁移的档案，用于备份及迁移。
- **Keepraw Fly CSV 批量导入：** 映射并验证文档定义的字段，再添加记录。
- **Flighty CSV：** 从 Flighty 导出文件导入受支持字段；这是单向导入，不是同步，也不代表完全兼容 Flighty 格式。

导入到现有档案时会追加航班，保留当前个人资料和已有记录。完全重复的记录会跳过，可能重复的记录可在导入前检查；两种 CSV 流程都会在写入前验证每一行。没有现有档案时，JSON 导入会保留源文件的个人资料与文档元数据。参见[格式与 CSV 字段说明](docs/schema.md)和[示例文件](examples/)。

机场当地时间使用内置 IANA 时区数据解析；也支持带 offset 或 `Z` 的 RFC 3339 时间。

## 开发者：本地运行

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

## 开发者：验证

```bash
pnpm format
pnpm format:check
pnpm lint:css
pnpm check:css-tokens
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e --project=chromium
```

需要时先运行 `pnpm exec playwright install chromium`。Chromium 运行完整 E2E 回归；Firefox 和 WebKit 仅运行带标记的兼容性 smoke，命令为 `pnpm test:e2e --project=firefox --project=webkit`（先安装对应浏览器）。分层和新增测试规则见[测试说明](docs/testing.md)。`pnpm check:docs` 会检查功能说明、Demo 标注及文档中的本地链接。官方 GitHub Actions 会针对 Pull Request 和 `main` 运行完整仓库检查；Fork 跳过这些官方作业，使用独立预构建部署流程，并在 `main` 检查通过后部署到 GitHub Pages。配置方式见[部署说明](docs/deployment.md)。

Dependabot 每周检查 pnpm workspace 依赖和 GitHub Actions 的新版本。minor/patch 版本更新按生态分组，major 更新单独提交 PR。更新 PR 由现有 CI 验证，再由维护者人工审查并决定是否 squash merge；依赖更新不会自动合并。继续提交 `pnpm-lock.yaml`，并使用 `pnpm install --frozen-lockfile` 安装依赖。

## 数据格式

Keepraw Fly 使用可迁移的 `keepraw-fly` JSON 格式，并执行结构与语义校验。命名空间扩展随所属记录保留；向现有档案追加航班时，保留当前档案的文档级元数据。参见[数据格式说明](docs/schema.md)、[JSON Schema](packages/schema/keepraw-fly.schema.json)和[架构说明](docs/architecture.md)。

## 文档

先阅读[文档索引](docs/README.md)中的当前指南；有长期参考价值的设计决策与源码溯源
单独收录在[历史归档](docs/archive/README.md)。

- [架构](docs/architecture.md)
- [视觉系统](docs/design-system.md)
- [部署（中文）](docs/deployment.zh-CN.md) / [English](docs/deployment.md)
- [数据格式](docs/schema.md)
- [当前功能边界](docs/not-implemented.md)
- [第三方声明](THIRD_PARTY_NOTICES.md)

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称、Logo 或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。
