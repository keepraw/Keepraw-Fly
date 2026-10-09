# Task 1B-2: cinematic scene composition and routes

**Visual approval pending. Draft experiment review only.**

The original KEEPRAW FLY design board (desktop dark 01 / light 04) was inspected alongside the four Task 1B-1 browser captures. This iteration changes the photographic composition, directional horizon light, and route presentation inside the existing DEV-only Globe Lab. It does not constitute visual acceptance against that concept.

Baseline: `45f92e9c78a118417803dc7f43f027a821f95c65`. Rendered implementation: `c814eb3779d69aa6037c154370913a62a13b7af1`.

## Composition

`representativeGlobeDirection` evaluates weighted airport visits and five great-circle samples per route, searches 192 spherical candidates, and refines deterministically. Interior regional activity and complete regional routes outweigh sparse global outliers. It never averages raw longitudes or assumes Asia. `composeGlobeView` separately projects actual airports/routes through a 34° perspective camera at the container's aspect ratio. It scores safe screen margins, activity balance, and an upper horizon, then chooses distance and fractional view offset from the evaluated candidates.

For the unchanged global Demo, the revised default is the Asian activity cluster: camera `[-1.1462179, 0.5012782, -1.6866845]`, distance `2.1`, offset `[-0.0459629, -0.5004981]` in a `1006×608` map at a `1440×900` viewport. B1 used distance `2.65`, offset `[0,-0.16]`, and a North American direction. PVG, HND, PEK, CAN, CTU and ICN labels are visible in the new default. Dense North American data independently chooses North America in repeatable tests; SFO's highest individual visit count does not automatically center the global Demo.

Home recomputes the composition for the current container. Resize updates an untouched Home view; manually rotated, zoomed or selected views retain camera ownership. Hover only changes route styling. Selected routes use their true great-circle midpoint and fit both endpoints using the current aspect and sphere occlusion. Arrow keys, orbit, zoom, reduced motion and backside selection remain available. A DEV-only capture seam locks historical cameras without changing the world sun; it is removed on disposal.

## Light and atmosphere

The initial sun uses the chosen Home camera basis: right `0.75`, up `0.42`, forward `-0.50`, normalized once into world coordinates. Demo world sun is `[-0.2926889, 0.2901215, 0.9111327]`. Selection, rotation, zoom, resize, Home and Light/Dark changes do not update it.

The surface and 1.026-radius atmosphere shell retain real NASA Black Marble nightlights and geographic day textures. Directional near-limb scattering adds a restrained cold-white/warm-white sunrise focus to the blue shell. Light mode has an independent illumination response and blue ocean/land range so the artistic night-side composition does not produce a large dark region or fully white land. ACES Filmic, exposure 1, sRGB output, texture resolution, sphere subdivisions and anisotropy are retained. No clouds, static sunrise photo, bloom, generated imagery or postprocessing compositor were added.

## Route geometry and interaction

The great-circle path is unchanged. Radial height is `0.004 + 0.030 × (1 − exp(−angle / 1.1))`, with a `sin(πt)^1.2` profile and radius `1.002` endpoints. Coincident airports have no raised loop. Demo SFO→LAX peaks at `0.00824`; NRT→DFW at `0.02912`; LAX→SYD at `0.03063`. Even an antipodal arc stays below `0.035`. This saturating profile lowers long arcs while preserving three-dimensional depth.

Line2 receives a continuous, interpolated world-normal/view-facing fade via its existing shader. Opacity falls toward the limb instead of abruptly hiding long routes; selected routes have a higher minimum. Ordinary strokes use subtle opacity frequency levels and widths approximately 0.93–1.09 CSS pixels; selected strokes are 1.65 pixels. Depth testing and sphere-based picking remain enabled.

Opposite/duplicate airport pairs share one physical stroke. Directed segments, counts, airport visits, selectors and flight rows remain intact. The Demo has 24 flights, 23 directed routes, 20 airports and 22 physical strokes; PEK→PVG and PVG→PEK remain separate choices with their own counts and selected endpoints. Direct picking retains the currently selected direction when that pair is selected; otherwise it chooses the deterministic first direction. This avoids coincident transparent strokes without inventing flight data.

## Verification

- `pnpm test`: 301 passed (Web 201, Core 66, Validator 31, CSS 3); four added math tests cover aspect-dependent safe framing, selected endpoint fit, bounded route height and reverse/duplicate grouping. Existing date-line, antipodal, occlusion and regional camera tests remain.
- `pnpm typecheck`, `pnpm build`, documentation consistency and changed-file formatting pass. The existing >500 kB production chunk warning remains.
- Globe browser suites: Chromium 8 and WebKit 8 final cases pass, covering real pixels, idle rendering, contexts/textures/retry, camera/hover/manual ownership, both reverse selections, backside routes, direct picking, keyboard/motion, accessibility and formal-page isolation. The unchanged formal Passport suite adds Chromium 3 and WebKit 1 passes.
- Light/Dark Axe reports from the direct-picking suite have zero violations. Real-pixel tests preserve the strict `<0.1` disabled-surface luminance threshold.
- Two test assumptions were corrected after observed failures: the old rectangular black-surface sample included exposed space in the cropped view, so it now intersects the analytic inner sphere disk; the new WebKit resize case initially read the pre-arrow diagnostic frame, so it now waits for the actual arrow render before saving the manual camera. Neither fix loosens a timeout, skips a test, or changes product behavior.
- Local Firefox could not launch: `browserType.launch: spawn UNKNOWN`, before loading the application. This is not a passing result or an established application regression. The B1 remote CI run `37896404248` already reports Firefox failure with Chromium verification and WebKit success; the previously reported flaky browser history is not treated as resolved by these local results. New remote CI status must be read separately.

## Performance and isolation

| Backend / quality    | Observed RAF Hz B1 → B2 | Median ms   | p95 ms      | First textured frame ms |
| -------------------- | ----------------------- | ----------- | ----------- | ----------------------- |
| Intel UHD / D3D11 4K | 60.00 → 60.00           | 16.7 → 16.7 | 16.8 → 16.8 | 270.5 → 320.1           |
| Intel UHD / D3D11 2K | 60.00 → 60.00           | 16.7 → 16.7 | 16.8 → 16.8 | 93.8 → 174.6            |
| SwiftShader 4K       | 12.61 → 15.93           | 83.3 → 66.6 | 83.4 → 66.7 | 396.1 → 427.0           |
| SwiftShader 2K       | 12.16 → 15.35           | 83.3 → 66.7 | 83.5 → 83.2 | 402.6 → 368.2           |

See [raw measurements](visual-review/task-1b-2/README.md#performance-and-audit) for the independent hardware/software before/after runs. They use the same unchanged Demo, 1440×900, DPR 1, both texture qualities, 30 warm-up RAFs and 120 measured rotation intervals. Camera and sun use each version's intended defaults, so these numbers include changed surface coverage. RAF cadence is not native display FPS; JS submission time is not GPU timing. Single-run timing is not a statistical benchmark.

The physical draw-call ceiling drops from 45 to 44; the revised default reports 42 because frustum culling also excludes two airport meshes. Texture download bytes and estimated texture memory are unchanged. Independent renderer bundle bytes and production isolation hashes are included in the audit. All nine formal production asset names, bytes and SHA-256 values match B1, with zero differences. No dependency, schema, IndexedDB, business calculation, formal SVG map, Archive, statistics, Highlights, detail or mobile changes were made.

## Visual evidence and remaining gaps

[Browser screenshot review](visual-review/task-1b-2/README.md) includes all nine requested views plus six locked-B1-camera views. Each PNG is an untouched browser screenshot, with dimensions/hash/provenance in the manifest. The two modes retain the same camera/data within each pair. Regional views select actual PVG/SFO airports while retaining all routes; the long-haul view selects existing NRT→DFW. Historical-camera comparisons hold camera/FOV/offset fixed but intentionally retain the new, initialized world sun; the sun direction change is documented rather than hidden.

The default has a clearer near-surface cap, directional blue/white horizon and visible city-night network. Long arcs are lower and more restrained. Remaining gaps against the concept include no cloud layer, cooler map-like land grading, subdued sunrise brilliance, a sometimes detectable atmosphere shell and faint residual elevated arcs at grazing angles. Light mode is more legible but remains flatter than the concept's photographic depth. Selecting North America after an Asian Home exposes the physical day side; the sun deliberately does not move to create an artificial night screenshot. The default prioritizes a representative region rather than showing every flight at once; all real routes remain explorable by rotation/selection.

PR #34 remains Draft with **Visual approval pending**. No merge, auto-merge, PR #33 modification or formal Passport replacement is part of this iteration. Large visual edits stop here pending human review.
