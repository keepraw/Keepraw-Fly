# Flight Detail — content-led Hero review assets

Compressed Before/After comparisons for `fix(detail): refine content-driven flight hero`.
These files are review material only; nothing here is shipped or imported by the app.

- **Before**: `main` at `e5bea4a92ffe910e857f1c5c256c1b6045ca3eab`
- **After**: branch `fix/detail-content-led-hero`
- Same archive (`e2e/fixtures/detail-content-hero.keepraw-fly.json`), English, DPR 1,
  reduced motion, `document.fonts.ready`, and — wherever a Globe is mounted — a real
  WebGL scene reporting `data-ready="true"` (Chromium headless, ANGLE/SwiftShader).
- Reproduce: start a dev server for each checkout, then
  `BASE_URL=… LABEL=before|after OUT=… node docs/review/detail-content-led-hero/capture.mjs`.
  Raw geometry: `before.json`, `after.json`.

## Geometry (CSS px, viewport scrolled to top)

Globe = Globe frame / real WebGL canvas. Title = top of the route heading.

| Shot                     | Title top     | Hero height    | Globe                                      | Shelf top      | Vertical scroll | Horizontal overflow |
| ------------------------ | ------------- | -------------- | ------------------------------------------ | -------------- | --------------- | ------------------- |
| standard-dark-1440x900   | 285 → **101** | 799 → **575**  | 543x685 / 543x468 → **543x543 / 543x543**  | 932 → **708**  | yes → yes       | 0 → 0               |
| standard-dark-1920x1080  | 375 → **101** | 979 → **575**  | 543x827 / 543x560 → **543x543 / 543x543**  | 1112 → **708** | yes → no        | 0 → 0               |
| standard-dark-1366x768   | 219 → **101** | 667 → **575**  | 543x619 / 543x399 → **543x543 / 543x543**  | 800 → **708**  | yes → yes       | 0 → 0               |
| standard-dark-1280x720   | 170 → **101** | 619 → **558**  | 526x571 / 526x374 → **526x526 / 526x526**  | 752 → **691**  | yes → yes       | 0 → 0               |
| standard-dark-3840x2160  | 915 → **101** | 2059 → **575** | 543x1907 / 543x560 → **543x543 / 543x543** | 2192 → **708** | yes → no        | 0 → 0               |
| standard-dark-2560x1440  | 555 → **101** | 1339 → **575** | 543x1187 / 543x560 → **543x543 / 543x543** | 1472 → **708** | yes → no        | 0 → 0               |
| standard-dark-1200x900   | 260 → **101** | 799 → **525**  | 493x685 / 493x468 → **493x493 / 493x493**  | 932 → **658**  | yes → no        | 0 → 0               |
| standard-dark-1200x390   | 125 → **101** | 529 → **525**  | 493x481 / 493x360 → **493x493 / 493x493**  | 662 → **658**  | yes → yes       | 0 → 0               |
| standard-dark-1199x900   | 73 → **73**   | 603 → **603**  | — / — → **— / —**                          | 700 → **700**  | yes → yes       | 0 → 0               |
| standard-dark-390x844    | 73 → **73**   | 683 → **683**  | — / — → **— / —**                          | 780 → **780**  | yes → yes       | 0 → 0               |
| standard-light-1440x900  | 285 → **101** | 799 → **575**  | 543x685 / 543x468 → **543x543 / 543x543**  | 932 → **708**  | yes → yes       | 0 → 0               |
| standard-light-1920x1080 | 375 → **101** | 979 → **575**  | 543x827 / 543x560 → **543x543 / 543x543**  | 1112 → **708** | yes → no        | 0 → 0               |
| zh9911-dark-1440x900     | 287 → **101** | 799 → **575**  | 543x685 / 543x468 → **543x543 / 543x543**  | 932 → **708**  | yes → yes       | 0 → 0               |
| sparse-dark-1440x900     | 314 → **101** | 799 → **575**  | 543x685 / 543x468 → **543x543 / 543x543**  | — → **—**      | yes → no        | 0 → 0               |
| rich-light-1440x900      | 272 → **101** | 799 → **575**  | 543x685 / 543x468 → **543x543 / 543x543**  | 932 → **708**  | yes → yes       | 0 → 0               |
| cancelled-dark-1440x900  | 101 → **101** | 430 → **430**  | 543x430 / — → **543x56 / —**               | 563 → **563**  | no → no         | 0 → 0               |

Below 1200px (1199×900, 390×844) the layout is unchanged and no Detail Globe mounts.
