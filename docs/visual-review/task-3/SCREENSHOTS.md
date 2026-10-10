# Task 3 — retained formal Passport screenshots

Task 3 captured **63** unedited screenshots on the actual `/#passport` page: three languages, Dark/Light, five physical sizes, native 100%/125% browser zoom, and three long-city cases. This matrix was visually approved by the Owner and the implementation was merged in PR #35.

During [Task 4 evidence cleanup](../CLEANUP-2026-10-10.md), 51 redundant PNGs were removed from the current tree and the 12 representative captures below were retained **without modifying their image bytes**. The [complete pre-cleanup 63-image set](https://github.com/keepraw/Keepraw-Fly/tree/0bb6660d41605dbeb1da3bc3f15df5b56798aba8/docs/visual-review/task-3/screenshots) is recoverable from Git history. The unchanged [browser measurements, label positions and SHA-256 manifest](browser-evidence.json) retains all 63 historical records.

## Retained representative captures

- [English Dark — Standard 1440×900, 100%](screenshots/passport-en-dark-1440x900-zoom100.png)
- [English Light — Standard 1440×900, 100%](screenshots/passport-en-light-1440x900-zoom100.png)
- [简体中文 Dark — Standard 1440×900, 100%](screenshots/passport-zh-CN-dark-1440x900-zoom100.png)
- [简体中文 Light — Standard 1440×900, 100%](screenshots/passport-zh-CN-light-1440x900-zoom100.png)
- [繁體中文 Dark — Standard 1440×900, 100%](screenshots/passport-zh-TW-dark-1440x900-zoom100.png)
- [繁體中文 Light — Standard 1440×900, 100%](screenshots/passport-zh-TW-light-1440x900-zoom100.png)
- [English Dark · small desktop — 1280×720 native 125%](screenshots/passport-en-dark-1280x720-zoom125.png)
- [简体中文 Dark · narrow desktop — 1024×768 native 125%](screenshots/passport-zh-CN-dark-1024x768-zoom125.png)
- [繁體中文 Light · narrow desktop — 1024×768 native 125%](screenshots/passport-zh-TW-light-1024x768-zoom125.png)
- [简体中文 Dark · desktop threshold — 761×900, 100%](screenshots/passport-zh-CN-dark-761x900-zoom100.png)
- [简体中文 Dark · Mobile threshold — 761×900 native 125%, Mobile](screenshots/passport-zh-CN-dark-761x900-zoom125.png)
- [简体中文 Dark · long city names — 1280×720 long-city archive](screenshots/passport-zh-CN-dark-long-cities-1280x720.png)

Native 125% zoom of the physical 761px viewport yields approximately 609 CSS px and correctly switches to the existing Mobile view. Other retained captures exercise production WebGL 3D. Collision-suppressed airport labels remain accessible through the picker.

[Approved frozen reference checks](frozen-evidence.json) · [Detailed Task 3 validation](VALIDATION.md)
