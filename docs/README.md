# Documentation / 文档导航

Start with the maintained documents below to understand the current product.
Historical reviews live in [archive/](archive/README.md); their measurements,
test counts and approval/deployment status describe their recorded revisions.

先阅读下方长期维护文档，了解当前实现。历史审查见 [archive/](archive/README.md)；
其中的测量值、测试数量及验收/部署状态只对应报告记录的版本。

## Active Documentation — 长期维护

| Document                                                      | What to use it for                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Architecture](architecture.md)                               | Package boundaries, local storage, imports, calculations and localization                  |
| [Schema](schema.md)                                           | Portable JSON facts, compatibility, extensions and CSV columns                             |
| [Current product boundaries](not-implemented.md)              | Implemented-product scope limits; not a roadmap                                            |
| [Globe implementation](globe.md)                              | Current production Passport/Detail rendering, fallback and source entry points             |
| [Visual system](design-system.md)                             | Semantic tokens, CSS ownership, composition and accessibility                              |
| [Locale terminology](i18n-locales.md)                         | Released languages, terminology, loading and open translation review                       |
| [Testing](testing.md)                                         | Current browser layers, tagging policy, CI gates and test discovery                        |
| [Deployment](deployment.md)                                   | Static hosting and verified GitHub Pages deployment                                        |
| [License and provenance review](license-review-2026-10-10.md) | Dated evidence with unresolved font/logo permission questions; keep visible until resolved |

For a first read, follow **architecture → schema → product boundaries → Globe**,
then the document relevant to your change. Source entry points in these documents
lead to implementation and tests. Consult current test discovery and CI results
instead of counts in past audits.

首次接手建议按“架构 → 数据格式 → 功能边界 → Globe 实现”阅读，再查阅改动主题。
文档内的源码入口指向实现与测试；当前测试范围以实际发现结果和 CI 为准。

Project-wide [third-party notices](../THIRD_PARTY_NOTICES.md),
[license](../LICENSE) and [trademark notice](../TRADEMARK.md) remain at the
repository root. The dated license review is retained here because its open
permission questions still affect distribution decisions.

## Historical / Archive Documentation — 历史记录

The [archive index](archive/README.md) separates completed audits/task reviews
from obsolete prototype guidance and records their original paths. Use these
documents to recover the reason for a past decision, not as current setup,
release instructions or a new cleanup checklist.

Some historical evidence must remain outside `archive/` because active tests or
capture tools use its exact paths. The [retained evidence index](visual-review/README.md)
explains those exceptions. The [Detail capture helper](reviews/task-b8/capture.md)
is also retained at its original location. These are supporting evidence/tooling,
not the starting point for understanding the architecture.

归档保留设计演进、审查依据和复现信息。部分证据因测试或采集工具依赖原路径继续原地
保留，具体用途见[证据索引](visual-review/README.md)和 [Detail 采集工具](reviews/task-b8/capture.md)。

## Keeping documentation maintainable

- Update active guidance with the implementation it describes. Keep architecture,
  operational guidance and evidence roles distinct.
- Put a completed audit, investigation or task acceptance record in `archive/`
  with its date/revision and links to the maintained subject document.
- Keep unresolved decisions discoverable from active guidance; archiving a report
  does not resolve its follow-ups.
- Preserve original measurements and commit-pinned evidence links. Archive
  obsolete guidance when its design history is useful; label its scope explicitly.
- Before moving evidence, search implementation, tests and scripts for path
  consumers. Preserve those paths within a documentation-only change.
- Merge documents only when they cover the same maintained subject and separate
  copies would create conflicting guidance. Different experiment stages stay distinct.
- Update incoming and relative links, then run `pnpm check:docs` and formatting
  checks. The existing checker recursively includes archived Markdown.
