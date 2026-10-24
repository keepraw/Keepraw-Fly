<a id="documentation"></a>

# Documentation / 文档索引

Start with your task below. English and Chinese navigation share one index;
linked technical references are in English unless marked otherwise.

按使用目的选择入口。中英文导航共用此索引；未标注中文的技术文档以英文为主。

<a id="maintained-entry-points"></a>

## Users / 普通用户

| Task / 任务                                             | Entry / 入口                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Quick start / 快速开始                                  | [English](../README.md#use-online) / [简体中文](../README.zh-CN.md#在线使用)                  |
| Import, export and backup / 导入、导出与备份            | [English](../README.md#import-and-backup) / [简体中文](../README.zh-CN.md#导入与备份)         |
| Local data and privacy / 本地数据与隐私                 | [English](../README.md#data-and-privacy) / [简体中文](../README.zh-CN.md#本地数据与隐私)      |
| Common questions / 常见问题                             | [English](../README.md#common-questions) / [简体中文](../README.zh-CN.md#常见问题)            |
| Import samples and accepted fields / 导入示例与支持字段 | [Examples / 示例](../examples/README.md), [format reference / 格式规范](schema.md#csv-import) |
| Current scope limits / 当前功能边界                     | [Product boundaries / 尚未实现的能力](not-implemented.md) — not a roadmap / 不代表开发路线图  |

## Self-hosting / 自托管用户

| Task / 任务                                          | Entry / 入口                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GitHub Pages, prebuilt release / Pages 预构建部署    | [English](deployment.md#github-pages-no-build-required) / [简体中文](deployment.zh-CN.md#github-pages无需编译)           |
| Docker/VPS and HTTPS / Docker、VPS 与 HTTPS          | [English](deployment.md#vps-docker-and-automatic-https) / [简体中文](deployment.zh-CN.md#vpsdocker-与自动-https)         |
| Maintenance, upgrade and rollback / 维护、升级与回滚 | [English](deployment.md#maintenance-upgrade-rollback-and-uninstall) / [简体中文](deployment.zh-CN.md#维护升级回滚与卸载) |
| Other static hosts / 其他静态托管                    | [English](deployment.md#downloadable-static-files) / [简体中文](deployment.zh-CN.md#静态文件下载)                        |
| Deployment troubleshooting / 部署排障                | [English](deployment.md#troubleshooting) / [简体中文](deployment.zh-CN.md#常见问题)                                      |

Use the notes for your selected release: current `main` and the Demo may include
features absent from that release. Self-hosting still stores flight archives in
the browser; it does not add server backup or cloud synchronization.

请以所选版本的发布说明为准：当前 `main` 和 Demo 可能包含该发行版没有的功能。
自托管仍将航班档案保存在浏览器中，不会增加服务器备份或云同步。

## Developers / 开发者

| Topic / 主题                                                                                            | Authoritative entry / 权威入口                                                                                 |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Local setup, contribution rules, commit identity and quality gates / 本地开发、贡献、提交身份与质量门禁 | [Engineering standards / 工程规范](engineering-standards.md)                                                   |
| Packages, storage, imports, statistics and localization / 包、存储、导入、统计与本地化                  | [Architecture / 架构](architecture.md)                                                                         |
| Portable archive, compatibility and CSV contracts / 档案格式、兼容性与 CSV 契约                         | [Schema / 数据规范](schema.md)                                                                                 |
| UI, typography, themes, tokens and interaction / 界面、字体、主题与交互                                 | [Design system / 视觉系统（双语）](design-system.md)                                                           |
| Test layers, fixtures, captures and CI / 测试分层、输入、截图与 CI                                      | [Testing / 测试](testing.md)                                                                                   |
| CSP, privacy, dependencies and release provenance / 安全、隐私、依赖与发行来源                          | [Security / 安全模型](security.md)                                                                             |
| Globe rendering and lifecycle / 地球渲染与生命周期                                                      | [Globe / 地球实现](globe.md)                                                                                   |
| Passport image, TD3 specimen policy and migration / 护照图片、TD3 示例策略与迁移                        | [Flight Passport journal / 飞行护照](flight-passport-journal.md)                                               |
| Language resources and open translation questions / 语言资源与待审术语                                  | [Locale notes / 本地化说明](i18n-locales.md)                                                                   |
| Source builds and official publishing (maintainers only) / 源码构建与官方发布（仅维护者）               | [English](deployment.md#developers-and-official-publishing) / [简体中文](deployment.zh-CN.md#开发者与官方发布) |

Executable configurations and source code are linked from their owning guides;
do not maintain parallel copies of their values in task reports. Keep technical
specifications in this repository so changes can be reviewed with the code.

各专题文档链接到对应配置与源码；不要在任务报告中重复维护配置值。
技术规范继续保存在仓库中，与代码一起审查和追溯。

<a id="release-legal-and-historical-records"></a>

## History, releases and legal records / 历史、发布与法律记录

- [v0.1.1](releases/v0.1.1.md) and [v0.1.0](releases/v0.1.0.md): bilingual release
  notes describe their published versions, not current `main`.
  双语发布说明记录对应发行版，不代表当前 `main`。
- [Third-party notices / 第三方声明](../THIRD_PARTY_NOTICES.md),
  [license / 许可证](../LICENSE), [trademark / 商标](../TRADEMARK.md) and
  [permission review / 许可审查](license-review-2026-10-10.md) retain distribution
  requirements and unresolved owner decisions. 保留分发要求及待所有者确认的问题。
- [Historical archive / 历史归档](archive/README.md) preserves selected decisions,
  approved Globe references and source provenance with explicit status.
  保留有明确状态的设计决策、批准版参考及来源证明；历史参数和测试数量不能覆盖当前指南。

Routine task reports and obsolete captures remain available through Git history.
New generated evidence belongs in ignored `artifacts/`; formal regression inputs
remain with tests. Follow [retention rules](engineering-standards.md#documentation-and-evidence).

常规任务报告和过时截图可通过 Git 历史追溯；新生成证据写入忽略的 `artifacts/`，
正式回归输入保留在测试目录中。遵循工程规范中的保留规则。
