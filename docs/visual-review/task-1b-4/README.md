> Historical checkpoint. Superseded PNGs were removed in Task 2; original numerical results remain below. See the [canonical review and cleanup inventory](../task-1b-7b2/README.md). Owner approval now selects Control; historical approval-pending statements describe this checkpoint only.

# Task 1B-4 Globe solar illumination and geographic surface review

**Visual approval pending. Keep Draft PR #34 and await the project owner's visual review.**

This iteration separates Geographic Surface, Solar Illumination, and Theme Color Grading. Light/Dark and A/B share the world sun, incidence angle, twilight and night masks; the surface retains NASA's geographic colors and texture. Rendered source commit: `2a7e67f8267ed9fce306d1315d374dd02aa65ac2`. Before: Task 1B-3 `38c61266915edc1252769c305623d56a1ffb563e`. Engineering checks are complete; visual quality still requires human approval. This English translation preserves the original Task 1B-4 evidence and conclusions.

[Screenshot provenance and complete scenes](manifest.json) · [GPU pixel validation](solar-pixels.json) · [Test results](test-results.json) · [Production isolation](production-isolation.json) · [Texture inspection](texture-inspection.json)

## Comparison with Task 1B-3

Before directly references existing Task 1B-3 artifacts. Each default and official-size After asserts that camera, FOV, ViewOffset, viewport, complete route metadata, sun and exposure match its corresponding Before. Each Light/Dark pair also asserts identical scenes.

| View                    | Task 1B-3 Before                                                     | Task 1B-4 After                                                      |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Light Earth only        | Historical capture: B3 Light Earth (superseded; PNG removed)         | Historical capture: B4 Light Earth (superseded; PNG removed)         |
| Dark Earth only         | Historical capture: B3 Dark Earth (superseded; PNG removed)          | Historical capture: B4 Dark Earth (superseded; PNG removed)          |
| Light full routes       | Historical capture: B3 Light routes (superseded; PNG removed)        | Historical capture: B4 Light routes (superseded; PNG removed)        |
| Dark full routes        | Historical capture: B3 Dark routes (superseded; PNG removed)         | Historical capture: B4 Dark routes (superseded; PNG removed)         |
| Light official map size | Historical capture: B3 Light official size (superseded; PNG removed) | Historical capture: B4 Light official size (superseded; PNG removed) |
| Dark official map size  | Historical capture: B3 Dark official size (superseded; PNG removed)  | Historical capture: B4 Dark official size (superseded; PNG removed)  |

## Identical twilight viewpoint

Twilight Review points the camera along the projection of the Home direction onto the plane perpendicular to the sun, at distance 3.6 with no ViewOffset. Only this review camera changes; the sun remains fixed. Home and selected-route views are not required to show the terminator.

| Light                                                                | Dark                                                                  |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Historical capture: Light twilight (superseded; PNG removed)         | Historical capture: Dark identical twilight (superseded; PNG removed) |
| Historical capture: Light solar diagnostic (superseded; PNG removed) | Historical capture: Dark solar diagnostic (superseded; PNG removed)   |

Green means Day, orange Twilight, and blue Night. Both themes have identical geographic regions; the background follows the UI theme. These categorical colors are development diagnostics, not the product Earth's illumination boundary.

## Model and materials

The sun retains the Task 1B-3 direction `[-0.2926889023874383, 0.290121517531001, 0.9111326530669097]`; exposure remains 1. The sun was not relocated and no textures were added or replaced.

Surface and atmosphere share `solarResponse`: Day uses `smoothstep(-width,width,solar)`, Twilight peaks at `abs(solar)=0`, and night emission fades toward strong daylight. Shared surface illumination is `.32 + sunIntensity * pow(max(solar,0),.65) * day`. Themes do not participate in solar region or illumination energy calculations; low indirect fill preserves backlit terrain.

The fixed Task 1B-3 `lightLand/land/sea` color intervals were removed. Linear RGB retains actual vegetation, deserts, plateaus, snow and bathymetry. A continuous luminance toe expands dark ocean/vegetation detail, followed by lighting and Light/Dark desaturation/cool balance. This is intentional reflectance grading, not a second gamma decode. Global exposure was not raised and no white veil was added.

The original texture was opened and eight geographic pixels inspected. Old ocean weights were 0 for the Sahara, Tarim, Tibet, Himalayas, Greenland and Amazon, 0.934 near Japan's coast and 1 for the Pacific. These samples did not prove widespread classification errors and are not a complete land/ocean validation. Blue dominance now controls only small ocean reflections rather than fixed material colors, so local classification errors cannot erase the source image; no new mask was added.

Local Three.js `WebGLTextures` was checked: surface `SRGBColorSpace` decodes once through the GPU sRGB internal format; night data retains `NoColorSpace`. Lighting and grading operate in linear space, followed by one ACES Filmic transform and one sRGB output. The Task 1B-3 linear-to-sRGB-and-back path used for fixed palettes was removed.

Night emission retains the Task 1B-3 `.012` threshold, toe, power 1.25 midtones and bounded shoulder. Theme strengths are Light 0.45 / Dark 1, both multiplied by the same geographic Night mask. Restrained, low-saturation real lights remain; white-gold LED peaks were not restored. Twilight responds around the actual local horizon and night-side atmosphere fades. B enhances only local twilight and the existing shell's narrow scattering skirt; A/B cannot move solar regions.

Light ordinary routes and airports use brighter cool blue, and labels gain dark shadows for darker real surfaces. Changes affect only color and bounded opacity; great-circle geometry, altitude, width, sphere occlusion and selected coral routes remain intact.

## Comparison with concept panels 01 and 04

The owner's original design board and the seven requested Task 1B-3 screenshots were opened and inspected.

Against panel 04, real deserts, plateaus, vegetation, snow and bathymetry replace uniform pale blue-gray. Solar incidence determines sphere brightness. However, the original Home center lies on the night hemisphere, so Light Home remains darker than panel 04's daytime composition: a light UI cannot make this geography permanently daytime. The twilight view checks the same material's day/night response. Bathymetric contrast is pronounced and some ocean areas are cobalt blue; the soft, transparent photographic daytime appearance is not fully achieved. Plastic appearance and visual acceptance cannot be declared fully resolved.

Against panel 01, Dark retains navy surroundings, restrained city lights and fine routes, with clearer terrain and upper-right illumination. The concept spans Europe, the Middle East and Asia; actual Demo data and camera algorithms were not changed to chase that composition. The concept has richer clouds, horizon and photographic depth. This iteration adds no clouds, Bloom, lens flares, light columns or particles. Real long-haul routes still converge near the horizon; geometry is outside this task's scope.

## Browser and test evidence

All ten PNGs are unedited Chrome 154.0.8037.58 / WebGL 2 / Intel UHD / ANGLE D3D11 screenshots at 1440×900, DPR 1, 4K: eight main images and two categorical diagnostics. All Demo years retain 24 flights, 23 directed routes, 22 physical strokes and 20 airports, with no selected route. Earth-only hides overlays alone.

The official Desktop Passport outer box was remeasured as **998×576.0625 CSS px**, client **996×574**. Only the Lab previews that size; official Passport retains its original SVG.

Automation independently reconstructs perspective rays and world sphere normals from screenshots and compares actual GPU classification. Each Light/Dark, A/B scene covers **54,677** non-grazing samples with **0** misclassifications and identical region signatures. City toggles do not change regions or camera. A neutral reflectance probe in the same shader removes terrain differences and validates actual GPU illumination.

| Theme     | Neutral Day luminance | Twilight | Night | Changed night city samples |
| --------- | --------------------: | -------: | ----: | -------------------------: |
| Light A/B |                160.03 |    78.07 | 57.02 |                        869 |
| Dark A/B  |                128.39 |    55.73 | 38.90 |                       1060 |

Luminance is screenshot-weighted sRGB, 0–255. City change means any channel difference >2. Both themes have zero daylight city increments. Real surfaces also have higher mean Day than Night brightness and retain nonblack detail in each region; twilight deep ocean may be darker than nighttime land. Full raw means remain in solar-pixels.json.

Final Chromium: **13/13 passed** (nine existing Globe tests, one new solar GPU test, three official Passport tests). Existing Canvas identity, world sun, texture requests, on-demand rendering, rotation/zoom, airport/route selection, Home, geographic occlusion, fallback/retry and accessibility checks remain. The full Firefox/WebKit matrix was not rerun; new lighting acceptance is not claimed for those engines.

All **304** workspace unit tests, typecheck, build, documentation consistency, CSS lint/tokens, changed-file Prettier and diff checks passed. Nine official production assets retain identical names, byte sizes and SHA-256 hashes against Task 1B-3. There is no added production cost. No new performance matrix was run; the idle on-demand check passed. No new textures, passes or geometry were added.

New test development corrections: wait for the actual twilight camera frame; add the same-shader neutral material probe to exclude reflectance differences; exclude transparent Canvas/theme background from sphere-region comparisons. Existing regression assertions, timeouts, retries and CI were not modified.

The first existing regression run passed 10/12, with Passport Light/Dark `heightFits` failures. A concurrent Playwright process also caused shared-output attachment errors. A complete Task 1B-3 snapshot including public later passed 2/2, and the final sequential rerun passed 13/13. The initial height failure cause remains undetermined; it was not proven to be a pre-existing defect.

## Existing remote CI

Task 1B-3 [CI 37908031801](https://github.com/keepraw/Keepraw-Fly/actions/runs/37908031801) was verified: Chromium 108 passed / one existing motion-camera assertion failed; Firefox 17 passed / eight Globe readiness or related failures; WebKit succeeded. This task did not expand into interaction or CI fixes. Local success does not establish resolution of remote failures. New-commit CI status is recorded separately in the PR.

[Task 1B-1](../task-1b-1/README.md) · [Task 1B-2](../task-1b-2/README.md) · [Task 1B-3](../task-1b-3/README.md). **Further development stopped; Visual approval pending.**
