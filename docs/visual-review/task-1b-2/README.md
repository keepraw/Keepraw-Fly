# Task 1B-2 browser review

**Visual approval pending.** These PNGs are real system Chrome / Intel UHD D3D11 browser screenshots, captured at DPR 1 and 4K textures. They are not generated, retouched or composited. The unchanged Demo contains 24 flights / 23 directed routes / 20 airports; the new renderer draws 22 physical airport-pair strokes.

Baseline: `45f92e9c78a118417803dc7f43f027a821f95c65`. Implementation: `c814eb3779d69aa6037c154370913a62a13b7af1`. [Technical report](../../globe-cinematic-scene.md).

## Default composition before / after

The data is identical; each implementation uses its own intended camera and initial world sun. Dark/Light within each version retain exactly the same camera. These comparisons include the camera improvement.

| Mode / viewport  | B1 before                                          | B2 new default                                    |
| ---------------- | -------------------------------------------------- | ------------------------------------------------- |
| Dark, 1440×900   | ![B1 dark](before-dark-default-1440.png)           | ![B2 dark](after-dark-default-1440.png)           |
| Light, 1440×900  | ![B1 light](before-light-default-1440.png)         | ![B2 light](after-light-default-1440.png)         |
| Dark Earth only  | ![B1 dark earth](before-dark-earth-1440.png)       | ![B2 dark earth](after-dark-earth-1440.png)       |
| Light Earth only | ![B1 light earth](before-light-earth-1440.png)     | ![B2 light earth](after-light-earth-1440.png)     |
| Dark, 1280×720   | ![B1 dark compact](before-dark-default-1280.png)   | ![B2 dark compact](after-dark-default-1280.png)   |
| Light, 1280×720  | ![B1 light compact](before-light-default-1280.png) | ![B2 light compact](after-light-default-1280.png) |

## Regional and selected views

All flights remain present. Asia selects actual PVG; North America selects actual SFO. Camera fitting differs between versions, and the new world sun stays fixed during selections.

| View             | B1 before                                                | B2 after                                                |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Asia             | ![B1 Asia](before-dark-asia-1440.png)                    | ![B2 Asia](after-dark-asia-1440.png)                    |
| North America    | ![B1 NA](before-dark-north-america-1440.png)             | ![B2 NA](after-dark-north-america-1440.png)             |
| Selected NRT→DFW | ![B1 long haul](before-dark-selected-long-haul-1440.png) | ![B2 long haul](after-dark-selected-long-haul-1440.png) |

## Same historical camera

These six additional views lock the camera vector, FOV and fractional view offset to B1. This isolates the material, lighting and stroke changes from the new camera placement. The new artistic sun is still initialized from the new Home view and is not moved for the screenshot: the comparisons intentionally include its changed geographical direction. They do not imply an identical sun between B1 and B2.

| View             | B1 camera retained in B2                                  |
| ---------------- | --------------------------------------------------------- |
| Dark complete    | ![Fixed dark](after-dark-fixed-b1-default-1440.png)       |
| Light complete   | ![Fixed light](after-light-fixed-b1-default-1440.png)     |
| Dark Earth only  | ![Fixed dark earth](after-dark-fixed-b1-earth-1440.png)   |
| Light Earth only | ![Fixed light earth](after-light-fixed-b1-earth-1440.png) |
| Asia             | ![Fixed Asia](after-dark-fixed-b1-asia-1440.png)          |
| North America    | ![Fixed NA](after-dark-fixed-b1-north-america-1440.png)   |

## Performance and audit

| Backend / quality    | Observed RAF Hz B1 → B2 | Median ms   | p95 ms      | First textured frame ms |
| -------------------- | ----------------------- | ----------- | ----------- | ----------------------- |
| Intel UHD / D3D11 4K | 60.00 → 60.00           | 16.7 → 16.7 | 16.8 → 16.8 | 270.5 → 320.1           |
| Intel UHD / D3D11 2K | 60.00 → 60.00           | 16.7 → 16.7 | 16.8 → 16.8 | 93.8 → 174.6            |
| SwiftShader 4K       | 12.61 → 15.93           | 83.3 → 66.6 | 83.4 → 66.7 | 396.1 → 427.0           |
| SwiftShader 2K       | 12.16 → 15.35           | 83.3 → 66.7 | 83.5 → 83.2 | 402.6 → 368.2           |

[Capture manifest / PNG dimensions and hashes](manifest.json) · [B1 camera / lighting / visible labels](before-scenes.json) · [B2 camera / lighting / route heights / visible labels](after-scenes.json) · [Test results](test-results.json)

[Intel before](before-hardware.json) · [Intel after](after-hardware.json) · [SwiftShader before](before-software.json) · [SwiftShader after](after-software.json) · [Bundle sizes](bundle-audit.json) · [Production hashes](production-isolation.json)

The software runs are independent of other browser verification. A contended preliminary run was excluded. Renderer timing is recorded as observed RAF cadence and JS submission time, not native GPU frame timing. Static scenes add zero frames after the pending render drains. Performance remains sensitive to software rasterization; texture/material quality was retained.

Capture reproduction: run baseline commit in an isolated checkout on port 5174 and the experiment on 5173, then run `node scripts/capture-globe-scene.mjs before http://127.0.0.1:5174/globe-lab` followed by `node scripts/capture-globe-scene.mjs after`. The 1280 views reload the Demo so no earlier route selection leaks into the default screenshot. The fixed-camera views use the DEV-only capture seam and recorded B1 projection parameters.

All measured static scenes add 0 frames after 300 ms. Independent renderer JS: 592,924 → 596,933 B (+4,009); gzip 148,804 → 150,174 B (+1,370). Texture memory estimate remains 85.3 MiB at 4K / 21.3 MiB at 2K (RGBA8 + mipmaps, not measured VRAM; framebuffers/geometry excluded). Textures and their bytes are unchanged. Nine production assets have zero hash differences.

[Derived camera / arc / sphere-occlusion analysis](scene-analysis.json) · [Pre-existing B1 remote CI](b1-remote-ci.json)
