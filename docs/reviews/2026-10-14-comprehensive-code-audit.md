# 《Keepraw-Fly 全面代码审计与技术债评估报告》

Author: keepraw

审计日期：2026-10-14

审计基线：默认分支 `main`，提交 [`97c4956c6a97fc2e7e58e050e0e2b3f71a91487f`](https://github.com/keepraw/Keepraw-Fly/commit/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f)。审计结束前再次核对，远端默认分支未变化。

审计阶段仅执行只读检查，没有修改、新增、删除或格式化受版本控制文件，没有创建分支、提交或 PR，没有推送。测试、构建及临时复现探针均在 `/tmp` 副本运行；原仓库 **1,306 个受控文件的前后 SHA-256 全部一致，工作区保持干净**。

本报告于 2026-10-15 按项目所有者的后续指示提交到独立分支供 PR 审查。此次报告提交仅新增本文件，不实施任何修复、重构或删除；以下测量、问题状态和代码位置均对应上述审计基线。

证据等级统一如下：

- **A：已复现或已通过测试确认。**
- **B：静态分析高度可信，但尚未动态验证。**
- **C：仅属于潜在风险或优化假设。**

## 1. 总体结论

**明确判断：仅做局部清理；优先实施数据可靠性修复，不开展大规模重构。**

项目已具备较好的工程基础，适合长期维护。`schema → core / validator → web` 的职责划分总体清楚；核心计算不依赖 React；档案事实与派生统计分离；持久化失败、恢复模式、导入预检、地图降级、多语言加载和 CI 部署保护都有实际实现及测试支撑。

近期清理也确实取得了成果。没有证据支持再次全面清理 Globe、重写多语言系统、迁移技术栈，或仅因文件较大而拆分组件。

当前最重要的问题集中在少数数据边界：

1. 初次读取失败后仍允许创建档案，可能覆盖已有全部记录。
2. 多标签页之间没有写入冲突检测，旧快照可以覆盖已经保存的修改。
3. 编辑器存在状态转换及无关字段保留缺陷。
4. CSV 预检有可测量的主线程阻塞。

这些问题值得修复，但修复范围明确，不要求推翻现有架构。确定可删除的内容主要是少量历史 CSS，删除收益明显小于数据保护修复收益。

### 本次验证结果

| 验证                                     | 结果                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm typecheck`                         | 通过                                                                                                                                             |
| `pnpm test`                              | **563 项通过**：脚本 9、core 114、validator 31、web 409                                                                                          |
| 多语言资源检查                           | 上述 web 测试包含 **67 项资源检查**                                                                                                              |
| `pnpm format:check`                      | 通过                                                                                                                                             |
| `pnpm check:docs`                        | 26 个 Markdown 文件检查通过                                                                                                                      |
| `pnpm lint:css`、`pnpm check:css-tokens` | 通过；无未解析 token                                                                                                                             |
| `pnpm build`                             | 通过；保留现有大于 500 kB 的 chunk 提示                                                                                                          |
| 现有持久化、恢复、国际化 Chromium 用例   | **46/46 通过，无跳过、失败或重试通过**                                                                                                           |
| 现有 Globe 生命周期及挂载后更新用例      | **2/2 通过**                                                                                                                                     |
| 历史 Globe 偶发用例                      | 连续执行 **5 次通过**，不能据此认定偶发问题消失                                                                                                  |
| 现有 Playwright 用例发现                 | 407 项；不代表本次本地全部执行                                                                                                                   |
| 生产构建浏览器检查                       | 390px、1440px 均无页面异常；懒加载符合实际实现                                                                                                   |
| 远端基线 CI                              | [main CI](https://github.com/keepraw/Keepraw-Fly/actions/runs/38505741033) 的 checks、六个 Chromium 分片、Firefox、WebKit、verify、deploy 均成功 |

本地使用 Node 24.19.0、仓库指定的 pnpm 10.14.0、Chromium 154。WebGL 为真实 WebGL2 API，但底层使用 **SwiftShader 软件渲染**。本地没有安装 Firefox/WebKit，未重新执行其完整矩阵；远端 CI 成功与本地验证分别记录。没有进行物理 GPU/显存、真实移动设备、长期驻留内存或专业母语审校。

## 2. 确认的问题

### P0：初次读取失败后可以覆盖已有完整档案

**证据：A，浏览器故障注入复现。**

位置：

- [App.tsx:155](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/App.tsx#L155)：启动读取失败只设置 `storageError`，随后仍设置 `loaded=true`。
- [App.tsx:308](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/App.tsx#L308)：普通写入没有“初始档案尚未成功读取”的保护。
- [App.tsx:353](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/App.tsx#L353)：创建档案立即保存空档案。
- [browser.ts:142](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/storage/browser.ts#L142)：覆盖固定的 `active` 记录。

**触发条件与复现：**

1. IndexedDB 已存有合法、非空档案。
2. 首次 `loadDocument()` 拒绝，但后续写入可以成功。
3. 页面显示存储警告，同时仍显示“Create my archive”。
4. 点击创建，原生 IndexedDB 读取结果变为：

```json
{
  "key": "active",
  "document": {
    "format": "keepraw-fly",
    "formatVersion": "0.1.0",
    "profile": {},
    "flights": []
  }
}
```

根因是**“未能确定是否存在档案”与“确认没有档案”共用了空档案 UI 分支**。现有恢复模式覆盖“读取成功但内容无效”，没有覆盖初始读取本身失败。

影响可以达到整个本地档案被替换，因此按本任务对严重数据损失的定义列为 P0。**它需要特定失败与用户操作组合，不是正常启动必现故障。**

**修复方向：**增加明确的初始读取失败状态；在成功确认空存储前，禁止普通创建、Demo 或导入流程直接覆盖 `active`。提供重试，确需替换时进入明确的恢复确认流程。

收益高，修改范围小至中等；必须回归空存储首次使用、设置读取失败、档案读取失败后恢复和显式替换。

### P1-1：多标签页写入会静默丢失已保存修改

**证据：A，两个真实页面及独立存储适配器均复现。**

位置：

- [persistence.ts:8](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/storage/persistence.ts#L8)：队列只在当前页面实例内串行化。
- [browser.ts:138](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/storage/browser.ts#L138)：写入整份快照，没有版本比较。
- [App.tsx:153](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/App.tsx#L153)：启动读取后没有跨页面冲突协调。

**复现：**

两个标签页同时加载包含 `UA123`、`UA124` 的档案：

- 页面 A 将 `UA123` 改为 `UA125`，等待保存成功。
- 页面 B 将另一条 `UA124` 改为 `UA126`，等待保存成功。
- 最终数据库为 `["UA123", "UA126"]`，A 已保存的修改消失。

这不是两个用户争改同一个字段，而是**互不相关的编辑被整份旧快照覆盖**。删除、导入及自动迁移也使用同一存储边界，修复时应一并考虑。

**修复方向：**在本地记录中增加修订标识，在 IndexedDB 事务内比较期望版本后写入；冲突时保留当前未保存内容并提示重新加载或解决冲突。跨页通知可辅助刷新，但通知本身不能替代原子版本检查。

收益高，复杂度中等，回归风险中等。无需修改可移植 JSON 格式，也无需引入服务器或完整同步系统。

### P1-2：“取消”改为“备降”会保存无效档案

**证据：A，函数级及完整浏览器流程复现。**

位置：

- [flight-editor.ts:252](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L252)：先展开旧记录。
- [flight-editor.ts:280](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L280)：仅在“未取消且没有备降机场”时删除旧 `cancelled`。
- [FlightEditor.tsx:165](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/components/FlightEditor.tsx#L165)：提交转换结果后直接调用保存。
- [validator/index.ts:197](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/packages/validator/src/index.ts#L197)：明确禁止取消与备降并存。

**复现：**

打开一个已取消航班，取消勾选 Canceled，选择 JFK 为备降机场，保存。数据库保留：

```json
{
  "cancelled": true,
  "divertedTo": { "iata": "JFK" }
}
```

页面保存成功，但刷新后整份档案进入恢复页；校验错误为 `cancelledDivertedConflict`。原始记录仍被恢复机制保留，因此与上一项完整覆盖风险不同。

**修复方向：**

- `cancelled` 应只由当前草稿状态决定，不能依赖是否备降。
- 在编辑结果进入持久化边界前执行必要的不变量检查，避免 UI 内存状态合法性与加载校验标准分离。
- 失败时保留旧数据库和用户草稿。

复杂度低，收益高。无需改变取消、备降的既有定义。

### P1-3：普通编辑会改写未操作的历史事实

**证据：A，实际转换函数复现。**

涉及两个独立字段保留问题：

| 问题                       | 位置                                                                                                                                                 | 已复现行为                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 历史会员等级被当前等级补写 | [flight-editor.ts:160](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L160) | 航班 `tierAtFlight:null`、会员当前等级为 `Gold`，打开并保存后，历史等级变为 `Gold` |
| 备降机场附加信息丢失       | [flight-editor.ts:270](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L270) | `{iata:"JFK",terminal:"4",gate:"B12"}` 保存后变为 `{iata:"JFK"}`                   |

前者把“历史未记录”转成了未经确认的历史事实，且与 [schema.md:120](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/docs/schema.md#L120) 对历史等级的约定不符。后者丢失 Schema 明确允许的机场字段。两者仍可能通过最终 Schema 校验，属于更容易遗漏的静默数据变化。

**修复方向：**

- 编辑既有航班时保留历史等级的空值语义；当前会员等级仅用于新记录、复制记录或用户明确重新选择会员的场景。
- 备降机场未改变时保留其已有附加字段。
- 用“只修改一个字段，其余事实保持不变”的断言验证转换。

复杂度低至中等，长期价值高；应特别覆盖 JSON 导入后再编辑的记录。

### P2-1：CSV 时间错误被错误报告为航班号错误

**证据：A，实际 CSV 预检函数复现。**

位置：

- [csv-import.ts:325](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/csv-import.ts#L325)：读取带偏移时间。
- [csv-import.ts:339](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/csv-import.ts#L339)：转为机场本地表单字段。
- [csv-import.ts:393](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/csv-import.ts#L393)：重新通过编辑器转换。
- [csv-import.ts:399](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/csv-import.ts#L399)：未识别错误统一降为 `invalid-flight-number`。

复现输入：

```csv
flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival
UA123,2026-11-01,JFK,LAX,2026-11-01T01:30:00-04:00,2026-11-01T04:30:00-08:00
```

结果为 `canImport:false`，错误却是 `invalid-flight-number`。实际失败发生在纽约夏令时结束的重叠时刻：明确偏移被转成不带偏移的本地时间后，再次解析产生歧义。

**确定的缺陷是诊断归因错误。**是否扩大对已显式消歧时间的支持，应在修复中明确约定，不能顺带改变所有时间输入规则。Flighty 复用该转换链，具有同类影响。

**不列为缺陷：**CSV 秒数归零。当前 [schema.md:175](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/docs/schema.md#L175) 已明确约定导入后按分钟精度保存；不能把这个既定行为包装成新发现。

### P2-2：CSV 预检存在可测量的主线程阻塞

**证据：A，Node 与浏览器均测量。**

位置：

- [flight-editor.ts:372](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L372)：每次转换遍历 113 个候选偏移。
- [flight-editor.ts:414](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/data/flight-editor.ts#L414)：候选循环中反复创建 `Intl.DateTimeFormat`。
- [CsvImportControl.tsx:58](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/components/CsvImportControl.tsx#L58)：同步预检直接在 `useMemo` 中执行。
- [FlightyImportControl.tsx:36](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/components/FlightyImportControl.tsx#L36)：同样同步执行。

使用合法、不同航班号、两个计划时间且没有实际时间的 CSV：

| 行数 |   Node 预检 | Chromium 主线程预检 |
| ---: | ----------: | ------------------: |
|  100 |   约 957 ms |     **约 1,075 ms** |
|  500 | 约 3,868 ms |     **约 5,336 ms** |

浏览器测量的是同步函数执行时间，这段时间主线程无法正常处理输入与渲染。500 行具有实际档案规模意义。

**修复方向：**先复用按时区配置的 formatter，减少重复时间转换，再测量。仍存在明显阻塞时再考虑分批执行；目前没有必要直接引入 Worker 架构。必须保留 DST 歧义和不存在时间的校验。

### P2-3：依赖存在需要处理的安全维护债

**证据：A，npm 审计确认版本命中；实际攻击可达性为 B/C。**

本次 `pnpm audit --json` 返回 **11 条记录，对应 10 个不同 GHSA**：2 critical、6 high、3 moderate。不能将这些上游评级直接等同于 Keepraw-Fly 的产品风险。

| 依赖链与当前版本                        | 实际使用边界                                                                   | 建议                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `validator → ajv → fast-uri@3.1.5`      | Ajv 编译仓库内固定 Schema；未发现用户提供 Schema 或使用其进行出站 URL 安全决策 | 在兼容性验证后更新至覆盖相关修复的版本，例如 3.1.8 或更高 |
| `vitest@3.2.7 → @vitest/mocker`         | 当前运行普通 `vitest run`；未发现公开暴露对应 mocker 插件接口                  | 单独评估维护版本升级，勿直接混入业务修复                  |
| `vitest → tinypool@1.1.1`               | 开发/测试依赖；两项 critical 公告依赖额外的原型污染等前提                      | 随兼容的测试工具升级解决，避免盲目强制跨主版本 override   |
| `stylelint → micromatch → braces@3.0.3` | 当前 glob 来自可信脚本常量                                                     | 跟踪上游修复；审计端未提供可直接采用的修复版本            |

相关公告包括：

- [Vitest mocker 文件读取](https://github.com/advisories/GHSA-82fw-gwwq-j7x9)
- [Tinypool worker options](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3)
- [Tinypool run options](https://github.com/advisories/GHSA-85c8-ppgw-ccpr)
- [braces 栈耗尽](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [fast-uri 最新相关修复](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj)

**未确认生产浏览器端存在相应的 RCE、SSRF 或任意文件读取链。**当前也未发现把导入内容直接送入 `innerHTML`、`eval` 等执行入口的产品代码。依赖维护值得安排，但不应据扫描级别宣称线上存在已证实的严重攻击漏洞。

### P2：既有待办，未包装为新发现

**历史测试资源与生成器边界仍未整理——证据 B。**

[docs/visual-review/README.md](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/docs/visual-review/README.md) 已明确记录：

- 夜景 JSON 位于 docs，却被正式单元/E2E 测试消费。
- [audit-globe-night.mjs:203](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/scripts/audit-globe-night.mjs#L203) 直接写回被测试消费的 `texture-audit.json`。
- [capture-task-2c.mjs:14](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/scripts/capture-task-2c.mjs#L14) 默认生成到历史 docs 路径。
- [B.8 capture.mjs:4](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/docs/reviews/task-b8/capture.mjs#L4) 默认输出到脚本旁的截图目录。

风险是生成证据与回归基准边界不清，容易误覆盖或重新积累历史产物。应按 #59 已提出的方向迁移输入、调整默认输出，保留字节和断言；不是删除这些资源。

**Globe 偶发测试仍需定因——历史发生为 A，根因为 C。**

[globe-solar-mode.pw.ts:79](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/e2e/globe-solar-mode.pw.ts#L79) 等待“相机有变化”，随后保存快照并立即比较主题切换后的相机。#58 记录过一次失败后重试成功。

本次：

- 当前 main 对应 Chromium 分片报告 46 expected、0 flaky。
- 本地该用例连续 5 次通过。
- 没有复现其根因，也不能宣称已解决。

后续应区分输入运动尚未结束与主题切换重置相机，保留原有相机不变量；不要通过放宽相等断言或增加固定等待掩盖问题。

### P3：低优先级维护项

| 项目                           | 证据            | 判断                                                                                                                                                                                                                                |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Detail 断点文档过时            | B               | 源码 [FlightDetailPage.tsx:51](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/pages/FlightDetailPage.tsx#L51) 与现有测试使用 **1200px**，architecture/globe/testing 仍描述 761px |
| 语言缓存没有旧 hash 保留策略   | B；用户影响为 C | 代码确实不清理旧 hash；没有测得当前配额或性能事故                                                                                                                                                                                   |
| 预热不检查 `saveData`/连接质量 | B；影响为 C     | 已知限制；不能仅凭可能竞争就立即取消预热                                                                                                                                                                                            |
| 少量历史 CSS                   | B               | 可做小范围删除，详见下一节；不是性能专项的理由                                                                                                                                                                                      |

## 3. 可安全删除的代码

本次没有证明某个生产 TypeScript 模块、运行时依赖、迁移逻辑或历史数据资源可以整块安全删除。确定候选仅限以下 CSS 片段。

| 路径与范围                                                                                                                                                                                                                                                        | 原始用途、当前引用及删除依据                                                                     | 收益、风险与验证                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| [passport.css:741](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/styles/passport.css#L741) 的 `.flight-row-secondary`；1435、1460、1621 附近同名选择器分支                                                    | 原航班列表第二行布局。历史提交 `5079e06`（#41）已替换对应 DOM；当前 FlightRow 无该类及动态构造者 | 删除孤立规则及同名分支。**共享规则中的 `.flight-row-primary` 等必须保留**。运行现有 flight-list、responsive 行几何检查 |
| [passport.css:917](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/styles/passport.css#L917) 的 `.passport-spotlight-copy`、其 `strong` 子规则，以及 `.passport-spotlight-arrow`、`.passport-spotlight-context` | 旧 Highlights/spotlight 展示结构。`b54f1b0` 已删除对应 JSX；没有当前生产或测试调用者             | 减少历史样式干扰。保留仍使用的 spotlight label、value、item 等规则。回归 Passport statistics/highlights                |
| [settings.css:528](https://github.com/keepraw/Keepraw-Fly/blob/97c4956c6a97fc2e7e58e050e0e2b3f71a91487f/apps/web/src/styles/settings.css#L528) 与 928 附近的 `.settings-toggle-row`                                                                               | 旧 Settings 开关行。`c32ef48` 已替换组件结构；剩余测试引用是一个组合查询分支，不负责创建 DOM     | 两个规则可删除。现有 Settings 布局、键盘操作检查即可；不应顺带删掉整个组合测试                                         |

**证据等级：B。**依据包含当前 JSX、动态类名来源、全仓引用和历史删除记录，尚未实际删除后做视觉差异验证。

上述候选共涉及 **7 个完整规则块，规则文本约 657 字节，另有 3 个共享选择器分支**。收益主要是减少阅读误导，不能宣称会带来可感知的加载或渲染提升。

现有 CSS 分析器找到的 30 个“没有源码字面量引用”的类不能全部删除，其中包含动态生成的状态、导入 disposition、地图等级等。

## 4. 不建议删除的代码和资源

- **Passport SVG 降级链、`d3-geo`、MapRelief 和地图数据。**它们仍承担 WebGL 失败时的可用性职责；root 与 web 中的 d3 声明分别有脚本和运行时用途。
- **`rawfly`、`0.1`、旧会员/票号/行李扩展迁移。**当前存储和导入仍调用这些逻辑，不能只因主格式已稳定而移除。
- **保存队列、失败提示、重试、退出保护与原始数据恢复导出。**其价值已由故障测试证明。跨页缺口不否定现有单页队列。
- **六张批准的 Globe 基准、夜景数值输入、来源 bundle、许可证和来源记录。**部分是直接测试输入，部分保留不可替代的来源证据。
- **2048 与 4096 Globe 纹理、DEV Globe Lab、测量工具。**生产使用 4096 不代表诊断路径使用的 2048 可以删除。
- **航空公司资产的源目录和 public 副本。**当前生成脚本明确复制并生成映射，构建又依赖 public 文件。可以评估未来单一来源流程，但现在不能直接删掉任一侧。
- **按航班身份去重而忽略补充字段差异的规则。**现有测试明确保护这一策略，导入流程也展示跳过数量。本次未将它认定为“错误丢弃不同记录”。

仅有测试引用的存储接口、包导出的工具函数，以及缺乏直接静态引用的手工诊断脚本，均未列为确定删除项。

## 5. 架构优化建议

只建议与已确认问题直接对应的调整：

1. **明确档案启动状态。**区分加载中、确认空、有效、无效、版本不支持和读取失败，避免用 `document === null` 表达多种互不等价状态。
2. **统一写入不变量与冲突检查。**编辑、导入、删除和迁移应遵守一致的数据保护约束；可以保留现有 adapter 与队列，不必引入全局状态框架。
3. **减少 CSV 对编辑器表单重建的依赖。**共享时间解析、航班身份和校验能力即可，不必让已解析的时间反复经过用于 UI 的无偏移草稿。
4. **分开测试输入与生成输出。**共享确定性输入归测试目录，采集结果默认写 ignored artifacts，基准更新必须是主动操作。

`App.tsx`、`PassportPage.tsx`、Globe renderer 较大，但本次没有证据表明全面拆分它们会取得与成本相称的收益。修复时可以提取明确的状态处理边界，不应展开全仓组件重组。

这些调整也更适合长期 AI 辅助开发：让关键不变量和失败状态可见，比增加抽象层、缩短文件或新增大量审计文档更有价值。

## 6. 性能评估

### 已测量结果

生产构建主要产物如下，gzip 为构建工具报告值：

| 产物                        |  原始大小 |      gzip |
| --------------------------- | --------: | --------: |
| 入口 JS                     | 556.84 kB | 164.91 kB |
| 首屏同时请求的共享 `src` JS | 471.11 kB | 153.26 kB |
| 动态加载的另一 `src` JS     | 150.88 kB |  43.00 kB |
| 共享 Globe JS               | 897.15 kB | 260.76 kB |
| 主 CSS                      | 138.87 kB |  22.53 kB |
| 机场目录 JSON               | 683.39 kB | 237.78 kB |

**不能仅用入口的 164.91 kB gzip 代表完整首屏成本。**实际空档案启动同时请求入口、共享 JS、CSS 和机场目录。

生产浏览器观察：

- **390px：**导入档案后没有 Globe chunk、地球纹理请求，没有 canvas。
- **1440px：**进入有档案的 Passport 后加载 Globe 及 4096 纹理，并得到 ready canvas。
- 两种宽度均无页面异常。
- 包含 `globe-lab` 名称的共享产物不等于 DEV 实验页面被错误开放，不能据文件名删除。

### 大档案计算

| 测量                  | 结果与优先级                                                           |
| --------------------- | ---------------------------------------------------------------------- |
| 500 行 CSV 同步预检   | 浏览器约 **5.34 秒**，P2，当前最明确的性能修复对象                     |
| 10,000 条候选航班去重 | 独立 Node 三轮约 **422–433 ms**；双重线性查找带来平方增长，P2          |
| 10,000 条同年统计     | Node 约 **58–73 ms**；逐条复制年份数组有额外成本，P3                   |
| 10,000 条航班文本搜索 | Node 约 **31–34 ms**；不是浏览器完整渲染耗时，暂不足以要求搜索架构重写 |

去重可考虑按现有身份规则建立索引，但必须保持当前顺序、匹配优先级以及“新/可能/完全重复”的行为。

### 尚待验证的机会

- 更大档案下航班列表渲染、重复统计与 Globe 标签成本。
- renderer 每帧诊断信息序列化的成本。
- 移动设备、弱网、物理 GPU 与长期内存表现。
- 语言预热在 `saveData` 和低带宽环境下的影响。

以上均为 **C**。不建议在没有进一步测量前引入虚拟列表、Worker、重写渲染器或取消缓存预热。

## 7. 测试和可靠性评估

现有测试总体有效。它们不仅检查界面存在，还覆盖：

- 真实 IndexedDB 往返、失败重试和写入顺序；
- 原始损坏档案保留、迁移失败及未来版本恢复；
- 未保存提示不被其他成功操作掩盖；
- WebGL 生命周期、迟到纹理、相机与 canvas 保持；
- 多语言资源结构、回退、加载失败、缓存损坏及窄屏布局；
- CI 汇总门禁和同一次运行的生产构建部署。

本次发现的缺口是**测试场景边界**，不是单纯数量不足：

1. 初始档案读取失败与“确实没有档案”的区别。
2. 两个真实页面对不同航班的交错编辑。
3. 取消、正常、备降之间的状态转换。
4. 编辑既有记录时未操作字段的保留。
5. CSV 时间异常到用户诊断的准确映射。
6. 中等规模 CSV 对主线程的阻塞。

修复时优先扩展现有 persistence、recovery、flight-editor、CSV 测试文件；仅跨页冲突和真实恢复后果需要少量浏览器回归。不需要再建立十种语言乘多浏览器乘全部断点的新矩阵。

文档检查通过不代表文档语义全部正确，Detail 断点错误就是实例。Playwright 的成功也不代表完全没有 flaky：现有报告器允许重试后通过并保留诊断，这属于已知政策，本次没有修改它。

初始沙箱的 Node 子进程限制、工具版本差异以及临时故障注入的缓存干扰，均已单独处理后重跑；没有通过修改正式测试、断言、超时或 CI 门禁取得通过结果。

## 8. 历史技术债状态

已阅读指定 PR，并结合当前源码核对：

| 历史工作                                                                                                                       | 当前状态                                                               |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| [#43](https://github.com/keepraw/Keepraw-Fly/pull/43)：Detail 复用 Globe                                                       | **已落实。**后续断点已改为 1200px，文档需同步；不建议恢复旧 Detail SVG |
| [#47](https://github.com/keepraw/Keepraw-Fly/pull/47)：卸载时键盘监听泄漏                                                      | **已解决证据充分。**保留 `useLayoutEffect` 清理；本次相关回归通过      |
| [#48](https://github.com/keepraw/Keepraw-Fly/pull/48)、[#49](https://github.com/keepraw/Keepraw-Fly/pull/49)：历史视觉产物清理 | **已完成。**没有理由重建或再次批量清理已移除内容                       |
| [#50](https://github.com/keepraw/Keepraw-Fly/pull/50)：成功截图和浏览器缓存产物减负                                            | **已落实。**失败截图、trace、报告仍保留                                |
| [#51](https://github.com/keepraw/Keepraw-Fly/pull/51)：部署保护                                                                | **已落实。**main push 必须经过完整 verify，部署消费同次构建产物        |
| [#52](https://github.com/keepraw/Keepraw-Fly/pull/52)：CI/部署文档同步                                                         | **主要内容一致。**本次没有发现部署绕过门禁                             |
| [#56](https://github.com/keepraw/Keepraw-Fly/pull/56)：多语言架构统一                                                          | **已落实。**注册表、HTML lang、稳定错误码和传统中文维护边界合理        |
| [#57](https://github.com/keepraw/Keepraw-Fly/pull/57)：十种界面选项与按需加载                                                  | **已落实。**资源、回退及独立实例加载机制保留                           |
| [#58](https://github.com/keepraw/Keepraw-Fly/pull/58)：缓存损坏与窄屏问题                                                      | **修复仍有效。**本次相关用例通过；Globe 偶发根因仍未确认               |
| [#59](https://github.com/keepraw/Keepraw-Fly/pull/59)：文档整理                                                                | **已完成。**测试资源路径迁移被明确留作后续，不应算作遗漏清理           |

仍然存在的既有待办：

- **旧语言 hash 保留、弱网预热策略：**代码现状与记录一致。
- **OKS/NFO/GDN/YMM 参考数据：**已直接核对两个 JSON。OKS/NFO 的中文机场/城市描述仍与机场目录中的美国、汤加机场不符；GDN/YMM 仍使用区域或自治市描述。应单独基于权威来源修正，不能改动持久化机场身份。
- **专业母语审核：**仍未完成，资源完整性测试不能替代语言准确性审核。
- **MiSans 子集/CDN 和航空公司图标权利：**现有许可证审查仍保留未核实事项。本次未发现新的授权证明，也没有把“未核实”认定为侵权。
- **历史来源 bundle：**仍应保留，未证明可由公开树完全替代。

## 9. 最小化 PR 实施计划

以下仅为后续修复建议；**此次报告归档 PR 不实施这些变更**。工作量是相对估计，不含外部授权、母语审校或 CI 排队。

| 顺序 | PR 目标与边界              | 验收标准                                                                                         | 收益 / 工作量 / 回归风险 |
| ---: | -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
|    1 | 初始读取失败时保护已有档案 | 故障期间创建/Demo/普通导入不能覆盖未知存储；重试恢复正常；确认空存储仍可首次使用                 | 极高 / 小至中 / 中       |
|    2 | 修复编辑器状态与事实保留   | 取消→备降保存后可刷新、导出；未知历史等级保持未知；未变更备降机场保留附加字段；无效编辑不落盘    | 高 / 小至中 / 中         |
|    3 | 跨标签页写入冲突保护       | 不同航班交错编辑不静默覆盖；过期删除、导入和迁移被检测；冲突时草稿可保留                         | 高 / 中 / 中至高         |
|    4 | CSV 时间诊断与预检成本     | 正确报告 DST/时间错误；明确带偏移输入语义；保持分钟精度约定；同环境重测 100/500 行且明显降低阻塞 | 高 / 中 / 中             |
|    5 | 依赖安全维护               | 逐链处理告警并记录仍不可达/无补丁项；完整类型、单元、构建和相关浏览器验证；不做无关升级          | 中至高 / 中 / 中         |
|    6 | 测试输入与生成输出分离     | 输入字节/hash 不变；更新所有读写路径；新产物默认 ignored；现有断言、标签和门禁不变               | 中 / 中 / 低至中         |
|    7 | 小范围 CSS 与断点文档修正  | 只删本报告确认的片段；保留共享选择器；现有布局检查通过；文档准确描述 1200px                      | 低 / 小 / 低             |

Globe 偶发问题先保留原始诊断。只有在复现并确认原因后，再提交独立修复；不应为完成清理计划而修改测试等待方式。

语言缓存清理、资产单一来源、年度统计微优化和组件进一步拆分，适合遇到相关需求或新增测量证据时再实施。

## 10. 无需修改的部分

以下设计当前足够合理：

- 本地优先、静态部署、无账号后端的技术路线。
- Schema、语义验证、核心计算与 React 展示的基本分层。
- 不持久化统计派生值，取消记录保留但不计入已飞统计。
- 原始损坏档案保留、未来格式拒绝猜测迁移、恢复导出。
- 单页串行保存队列及显式失败重试。
- US English 完整回退、UK English 区域覆盖、十种语言统一注册。
- 独立的距离单位、时间格式、语言设置。
- Globe 按需加载、Detail 与 Passport 不同失败策略、卸载前资源释放。
- 六个 Chromium 分片与有选择的 Firefox/WebKit 覆盖。
- CI verify 聚合门禁及同次构建部署。
- 当前精简的文档入口、设计决策归档与 Git 历史分工。

本次没有发现足以支持替换技术栈、引入新状态管理框架、重写 Globe 或重新设计整个数据格式的证据。

## 11. 最终决策

**1. 是否存在值得开展下一轮专项代码清理的实质性技术债？**

存在，但主要是**数据保护与转换边界的局部债务**，其次是 CSV 性能、依赖维护和测试资源路径。不是大面积废弃代码。

**2. 如果不清理，是否有实际负面影响？**

有。已复现的覆盖、跨页丢失修改、无效档案保存和历史字段变化，会影响真实数据可靠性；500 行 CSV 的数秒阻塞也有实际体验成本。保留几百字节历史 CSS 则几乎没有可感知影响。

**3. 清理能获得什么收益，又有哪些风险？**

主要收益是保护已有档案、避免静默事实变化、让异常可恢复、减少导入阻塞。主要风险在并发控制、时间语义和依赖兼容性；单纯减少文件或代码行数的收益很小。

**4. 哪些立即实施，哪些以后再做？**

立即实施初始读取保护、编辑器正确性修复和跨页冲突处理；随后处理 CSV 与依赖。历史资源迁移、小量 CSS、缓存策略和架构微调可排在后面。

**5. 是否有足以支持大规模重构的证据？**

**没有。**现有分层、测试、恢复机制和近期修复提供了可继续发展的基础，已确认问题都能以有限改动解决。

**6. 是否应停止周期性大规模清理，转向日常增量维护？**

**应该。**完成本轮明确的数据可靠性修复后，转向随功能和证据推进的小步维护；不要继续以审计轮次、删除数量或文件变小作为目标。

**最终建议：仅做局部清理，其中数据保护修复应立即实施。保持现有架构与工程门禁，等待项目所有者决定后续独立 PR。**
