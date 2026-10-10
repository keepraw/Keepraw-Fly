# Task 1B-7B2 — Approved Lighting, Composition Candidates & Specular Refinement

**Branch:** `codex/globe-cinematic-7b` — do not modify PR #34, official Desktop Passport, statistics, or merge. Stop after candidates; await owner visual approval. No Task 2/3.

Reference: original KEEPRAW FLY board Panel 01 (Desktop Dark) + Panel 04 (Desktop Light). Old defaults 2.2/1.0/0.65 are superseded; do not compare against them as preferred.

## 1. Approved defaults (separate commit)

`0915a38` — `apps/web/src/globe/globe-lighting.ts`:
`sunIntensity 0.7`, `nightIntensity 2.0`, `atmosphereIntensity 2.0`, `twilightWidth 0.18`.

Same in Light/Dark. Initial Lab rendering, Reset Lighting, debug sliders, Fixed/Real-time modes, theme switching all preserve these. `e2e/globe-lighting.pw.ts` updated to assert all four after Reset (0.7/2.0/2.0/0.18), not weakened.

## 2. New visual baseline (approved settings)

Script `scripts/capture-task-1b-7b2.mjs`, 1440×900 DPR1, Demo all-years, Home unmoved, Fixed sun `[-0.2926,0.2901,0.9111]`, art A, exposure 1. No errors/external.

- `baseline-approved-fixed-dark/light.png` — Home, Fixed sun
- `baseline-approved-realtime-dark/light.png` — same Home, Real-time sun (wall-clock differs by design)
- `baseline-approved-passport-dark/light.png` — official Desktop Passport allocation remeasured live (outer 998×576, client 996×574), Home recomputed for aspect
- `baseline-approved-selected-SFO-HKG-dark/light.png` — real long-haul focal point (selectedRouteView, Pacific)
- `baseline-approved-selected-PEK-PVG-dark.png` — real short domestic focal point, closest to concept SZX–TAO shape (no fabrication; SZX/TAO absent from Demo)

Manifest: `baseline-approved-manifest.json`. All lighting fields record 0.7/0.18/2.0/2.0.

Hotspot at approved defaults: obvious localized white in mid-Pacific (SFO-HKG view) and right limb (Home view), Dark + Light. Documented, not solved by intensities.

## 3. Ocean specular refinement (separate commit)

`5f37310` — only `globe-lighting.ts` ocean glitter, intensities/texture untouched, no bloom/overlays:

- `pow(NdotH,220)*0.38` → `pow(...,60.0)*0.16`
- Gate by `facing=max(dot(n,view),0)` and `0.25+0.75*diffuse` so limb/low-sun oceans don't blow out
- Sky sheen (`0.28`), `oceanReflection`, `day`, balances, city/atmosphere kernels unchanged

`specular-fixed-*.png` (same cameras as baseline) show the Pacific blob reduced from glaring white to distributed sheen, limb hotspot controlled, land texture/routes/cities preserved. Fixed sun, Real-time astronomy, night kernels byte-identical.

## 4. Camera composition candidates (no default change)

Control retained. Fixed sun/lighting frozen. Applied via DEV-only `globeReviewView` (no `defaultGlobeView` edit, no hardcode, manual orbit/zoom/Home intact).

- **Control (current Home):** dir `[-0.5458,0.2387,-0.8031]` (≈13.8N,124E), dist 2.1, offset `(-0.045,-0.50)`. Asia/Pacific concentrated, China triangle + HND/ICN large, transpacific arcs dominate right edge, Europe off-screen.
- **B-europe-asia:** `spherePoint(30N,85E)`, dist 2.45, offset `(0,-0.50)`. LHR/FRA/CDG on left limb, Caspian/Central Asia/Siberia central, PEK/PVG small on right. Europe-to-Asia coverage achieved; cost is farther crop, Siberian emptiness, small Asian detail, transpacific hidden. Selected `LHR-SIN` (real) gives a dramatic trans-Eurasian coral focal point (`comp-clean-B-...-selected-LHR-SIN-dark.png`).
- **C-close-asia:** `spherePoint(24N,112E)`, dist 1.75, offset `(0,-0.45)`. Tight crop on PEK/PVG/CAN/CTU/ICN/HND, night cities most expressive, domestic triangle clear, transpacific as leading diagonals, no empty space, no Europe. Selected `PEK-PVG` (real short domestic) is the closest concept analogue: central coral segment, enlarged endpoints (`comp-clean-C-...-selected-PEK-PVG-dark.png`).

Captures (all 0.7/2.0/2.0, Fixed sun):
- Lab: `comp-control-fixed-dark/light.png`, `comp-clean-B/C-fixed-dark/light.png`
- Passport-size (996×574 stage): `comp-control-passport-dark.png`, `comp-B/C-europe/close-passport-dark.png`
- Selected: control `SFO-HKG`, B `LHR-SIN`, C `PEK-PVG` (all Dark, real data, great-circle/picking/markers/filtering preserved; default selection unchanged in code)

Algorithm assessment: `representativeGlobeDirection` (airport `flightCount^0.9` + route `flightCount^0.85`, whole-route bonus ×0.8, 192 Fibonacci + hill-climb) correctly faces Demo Asia; it would face Europe for Europe-heavy users (responsive, permutation-invariant, tested). `composeGlobeView` searches latShift `[-12,-18,-24,-30]`, lonShift `[-7,0,7]`, distances `1.68–4.4`, scores safe-region `0.06–0.92×0.16–0.90`, horizon→0.06, distance>2.1 penalty. B/C are reachable by widening lonShift (e.g. ±20 for Europe) and softening the far-distance penalty vs close-crop reward — data-dependent tuning, not a Demo-only hardcode. Manual navigation preserved (`atHome=false` on orbit, resize keeps manual camera, Home restores).

## 5. Route hierarchy

Unselected vs selected pairs above use real Demo routes only (23 directed, 22 physical, 20 airports). Coral-red selected (`#ff8172` Dark / `#e85d52` Light, width 1.65, opacity 0.92) vs blue unselected, airport markers enlarge, limb fade/picking intact. No SZX–TAO fabrication. No permanent default-selection change.

## 6. Verification

- Real-time deterministic: `e2e/globe-solar-mode.pw.ts` uses `page.clock` fixed times (2026-06-21/12-21) and `expectSunCloseTo`; `af7c298` reorders sampling to wait for RAF-rendered `data-lighting` before asserting (test-only, no solar impl change).
- Preserved: 1B-6 `cityLightResponse` + `darkCityEmission` byte-identical; Fixed/Real-time solar math unchanged; shared terminator; orbit/zoom/Home/keyboard; SVG fallback; `/globe-lab` DEV-only; production Passport isolated (9/9 assets unchanged in prior pass; this pass touches no Passport files).
- Tests: `pnpm -r typecheck` pass; `pnpm -r test` 216 web + 66 core + 31 validator pass (+ CSS tokens); `pnpm -r build` pass.
- Browser (system Chrome, 1 worker, reuse dev server): 12/12 globe pass — lighting 2/2, solar-mode 5/5, solar 1/1, art 1/1, scene 1/1, night-response 1/1, night-style 1/1. `globe-solar` and `globe-night-style` thresholds recalibrated for approved 0.7/2.0/2.0 in `672cc46`/`3467744` (neutral-probe 1.3x/1.15x solar architecture unchanged; with-cities day>night kept at 1.05x; accent compactness <0.08, mean <before×1.15, nearWhite/clipped 0). No product-code loosening; justification in test comments.
- One retry observed: initial `globe-solar` run failed at old 1.3x (expected — approved art compresses day/night); passed after recalibration. No other retries.

## 7. Remaining differences vs concept board

- Concept 01/04 show photographic softness/cloud depth; this pass has no clouds/bloom/post (per scope). Light oceans cleaner but still map-like.
- Concept selected SZX–TAO absent from Demo; PEK–PVG used as real analogue (short domestic red), SFO–HKG/LHR–SIN for long-haul drama.
- B gives Europe but loses closeness; C gives closeness but loses Europe; control balances but over-weights Pacific. No single Home yet satisfies all five composition priorities simultaneously.
- Atmosphere concentrated, no night halo; shell edge can still read at grazing angles.

## 8. Recommendation (await approval — do not merge)

**C-close-asia** best matches the brief's cinematic close crop, expressive routes/cities, hierarchy and concept framing for the Demo-heavy Asia case, with the smallest deviation from current Home (same region, tighter). For Europe-heavy archives, B's westward logic (wider lon search, not a fixed point) should inform algorithm tuning, not a fixed Demo camera. Proposed next step upon approval: implement responsive tuning (expand lonShift, retune distance/horizon weights) behind `defaultGlobeView`, keep manual/selected/filter behavior, recapture all viewports/filters.

Cloud strategy (not implemented): single analytic shell layer with terminator-gated density + forward-scatter, no postprocessing, preserving solar/terminator/kernels; evaluate after composition approval.

## Files

- Baseline: `baseline-approved-*.png/json`
- Post-specular Home: `specular-fixed-*.png/json`
- Candidates: `comp-control-*.png`, `comp-clean-B/C-*.png`, `comp-*-passport-dark.png`, `comp-manifest.json`, `comp-clean-manifest.json`
- Scripts: `scripts/capture-task-1b-7b2.mjs`, `...-candidates.mjs`, `...-clean.mjs`
