# Keepraw Fly

**开源、本地优先的个人航班档案与飞行护照。**

[开发者 Demo](https://fly.keepraw.com) · [English](README.md)

> 数据比应用更长久。

## 在线使用

**[https://fly.keepraw.com](https://fly.keepraw.com) 是开发者提供的 Demo**，用于在浏览器中体验 Keepraw Fly。可选择演示模式浏览虚构的示例航班，也可以创建个人档案。航班记录保存在当前浏览器中；Demo 不提供账号或云端同步。

首次使用时选择**创建我的档案**，再**添加航班**；也可以在欢迎页导入已有的 Keepraw Fly JSON。后续导入与导出位于**设置 → 数据与备份**。无需安装 Node.js、pnpm 或自行编译。

**请定期导出 JSON 备份，并在更换站点、浏览器或设备前备份。** Demo 与自托管站点之间不会同步数据。

## 主要功能

- **飞行护照：** 浏览全部或指定年份的航班、距离、空中时间、延误、机场、航司、机型与航线亮点；可保存上下双页的旅行纪念护照，使用档案姓名与保存在当前浏览器的纪念编号。
- **航班档案与详情：** 搜索、筛选、新增、编辑、复制航班，并查看完整记录。
- **航线可视化：** 在桌面端飞行护照和航班详情地图中浏览已记录航线。
- **可迁移数据：** 导出及迁移经过验证的 Keepraw Fly JSON 档案；写入前预览 JSON、Keepraw Fly CSV、Flighty CSV 和航旅纵横 XLS。
- **常旅客资料：** 将常旅客计划关联至多个航司及航班记录。
- **本地优先：** 航班历史保存在浏览器中；无需账号，也没有保存航班历史的云端后端。
- **跨设备设计：** 适配桌面与移动端，支持简体中文、繁体中文（台湾）、美式英语、英式英语、日语、法语、德语、西班牙语、巴西葡萄牙语和韩语。

本 README 描述当前 `main`。Demo 随成功的 `main` 部署更新，固定发行版的功能可能较少。[v0.2.0 — Flight Passport Journal](docs/releases/v0.2.0.md#简体中文) 包含双页护照图片生成器和 Passport/航班详情显示优化。[历史发行说明](docs/README.md#release-legal-and-historical-records)保留各版本的功能范围。[当前功能边界](docs/not-implemented.md)说明尚未实现的能力，不代表开发路线图。

## 本地数据与隐私

航班记录默认保存在当前来源（origin）的 IndexedDB 中。Keepraw Fly 没有账号系统，也没有保存用户航班历史的云端后端。默认静态构建不会上传航班记录，也不包含分析 SDK。[旅行纪念护照](docs/flight-passport-journal.md)使用档案姓名，以及单独保存在 localStorage 中的纪念编号。编号不包含在 JSON 备份中；保存的图片包含姓名和编号，不是真实旅行证件。

持久存储是浏览器提供的可选能力。浏览器支持并授予时，可降低因存储空间压力自动清理本站数据的概率；它不能防止手动清除网站数据，不保证永久保存，也不能替代 JSON 备份。申请持久存储无需安装为应用，安装也不代表浏览器已授予持久存储。

不同来源（协议、主机、端口）、浏览器配置和设备的数据彼此独立；同一来源的项目路径不提供存储隔离。部署新版本不会主动清除档案；Docker 升级不等于个人数据备份或迁移。VPS 只托管网页，不保存航班档案。

**清除网站数据或浏览器自动清理，可能删除唯一的档案副本。** 请在清除数据或升级前导出完整 Keepraw Fly JSON，并妥善保存下载文件。

机场、航司和地图资源是随应用提供的参考数据，并非实时航班状态服务。来源与许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

中文 UI 字体，以及护照图片按需使用的 CJK 字体，会从固定版本的 jsDelivr 资源加载。该第三方服务接收正常资源请求元数据，不接收航班记录或档案内容；请求失败时回退系统字体。详见[字体来源与隐私说明](THIRD_PARTY_NOTICES.md)。

## 导入与备份

在**设置 → 数据与备份**选择**导出 Keepraw Fly JSON**，保存完整档案备份。迁移时，在目标站点选择 JSON 导入，打开下载文件，检查预览后确认。界面偏好和纪念编号仅保存在当前浏览器，不属于可迁移档案。

- **Keepraw Fly JSON：** 导入或导出完整、可迁移的档案，用于备份及迁移。
- **Keepraw Fly CSV 批量导入：** 映射并验证文档定义的字段，再添加记录。
- **Flighty CSV：** 从 Flighty 导出文件导入受支持字段；这是单向导入，不是同步，也不代表完全兼容 Flighty 格式。
- **航旅纵横 XLS：** 从受支持的二进制 Excel 导出文件中预览并追加客票状态明确为“已使用”的历史航班；未使用、OPEN、已退票、已换开和无效票会排除。参见[支持的布局和限制](docs/schema.md#umetrip-xls-import)。目前仅用一份真实导出文件验证兼容性，不代表支持所有版本。

导入到现有档案时会追加航班，保留当前个人资料和已有记录。完全重复的记录会跳过；可能重复的记录需要明确选择，无效记录会阻止导入。没有现有档案时，JSON 导入会保留源文件的个人资料与文档元数据。参见[格式与 CSV 字段说明](docs/schema.md)和[示例文件](examples/README.md)。

**完整备份包含个人信息**，如姓名、PNR、客票号和常旅客会员号，请谨慎保存和分享。**导出去除个人信息的版本**用于分享，不能作为备份：精确日期、航线和座位仍会保留，因此并非完全匿名。详见[导出隐私说明](docs/security.md#personal-data-in-exports)。

## 常见问题

- **更换网址或浏览器后找不到记录？** 返回原来源和浏览器配置导出 JSON，再在目标导入。没有账号或服务器副本可供恢复。
- **可以离线使用吗？** 缓存资源有时可用，但不保证离线启动。本地存储不等于完整离线应用。
- **为什么导入被阻止？** 检查预览中的验证问题，并参照[支持的字段和示例](docs/schema.md#csv-import)。Flighty 仅支持部分 CSV 字段，不代表完整兼容。

## GitHub Pages 自托管（零编译）

按[Pages 指南](docs/deployment.zh-CN.md#github-pages无需编译)在 Fork 部署经过校验的官方发行版，支持项目子目录和自定义域名，无需本地编译。**这种模式不会运行 Fork 修改的源码。** 升级与回滚均由你明确选择版本。

## VPS 自托管（Docker）

按[VPS 指南](docs/deployment.zh-CN.md#vpsdocker-与自动-https)配置 Docker/Compose、校验安装器、启用 HTTPS 并维护部署。单个 Caddy 容器在 amd64/arm64 上提供静态网页；VPS 不保存航班档案。官方发布者与镜像作者为 **keepraw**。

[v0.2.0 Release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.2.0) 提供安装器和预构建 ZIP/tar.gz；安装前请按指南检查前提条件并完成校验。

## 开发者：本地运行

先阅读[本地开发说明](docs/engineering-standards.md#local-development)，获取所需工具链、依赖安装、开发服务和构建命令，再阅读[架构说明](docs/architecture.md)。

## 开发者：验证

遵循[质量门禁与贡献规范](docs/engineering-standards.md#quality-gates)和[浏览器测试说明](docs/testing.md)。校验、CI 和依赖维护要求在这些文档中统一维护。

## 数据格式

可迁移的 `keepraw-fly` 档案执行结构与语义校验。参见[格式与兼容性指南](docs/schema.md)和[JSON Schema](packages/schema/keepraw-fly.schema.json)。

## 文档

[双语文档索引](docs/README.md)按读者分类提供用户帮助、自托管、开发指南、发布说明和历史记录入口。

## 许可证

源代码采用 [MIT License](LICENSE)。该许可证不授予项目名称、Logo 或识别性标志的使用权，详见 [TRADEMARK.md](TRADEMARK.md)。字体、数据集、图像和航司标志的独立条款见[第三方声明](THIRD_PARTY_NOTICES.md)。
