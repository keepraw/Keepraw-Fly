# Task 3 — Production Desktop Globe integration (WIP)

Status: **Draft implementation, not visually accepted or released.**

Base: PR #34 (`codex/globe-prototype-experiment`) at approved Task 2C commit `2b9378d0a27146a8650508c0a54f04b709b9d976`.

Task 2C was visually accepted by the Owner on 2026-10-10. Task 3 is separately authorized for development only; neither PR #33 nor PR #34 may be merged, and Task 3 must remain Draft until separately approved.

## Integration implemented

- A lazy Desktop-only `PassportGlobe` mounts the existing `GlobeMap`/Three renderer in the official Passport's map cell, leaving the independently designed Mobile branch unchanged.
- Passes actual scoped flights and `buildRouteSegments` data from the existing Lifetime/Year/Search/selection flow. No hardcoded demo routes.
- Reuses approved `defaultLighting`, existing `defaultGlobeView`, Fixed Sun / Real-time Sun, 4096 imagery and native resource disposal without modifying shaders, rendering/camera/solar algorithms, assets or pixel assertions.
- Receives production theme and IndexedDB-backed solar preference from `App`; resolves system theme using `prefers-color-scheme`.
- Globe airport/route selections link to Passport's existing exploration state, identify corresponding real flights and scroll/focus the Archive. Keyboard-accessible select controls offer route and airport choices. The existing `GlobeMap` already includes drag, zoom, keyboard navigation and SVG fallback on WebGL/texture/context failure.
- Adds a scoped production Globe stylesheet without changing the Globe Lab visual stylesheet rules or Mobile-specific CSS.

## Must validate before Owner review

- **No CI pass is claimed yet.** Run documentation/format/CSS/typecheck/unit/build and Chromium/Firefox/WebKit regression against the exact new head; the Lab CSS is reused and the initial integration requires browser layout verification.
- Capture actual Desktop Globe screenshots for Dark/Light, English/Simplified/Traditional, and 1646x928, 1440x900, 1366x768, 1280x720, 1024x768, 761x900 at 100% and relevant 125% native zoom. Verify no right scrolling, six KPI and three Highlights, existing <=540px exception.
- Exercise real multi-route/reverse-route/overlap, Lifetime/Year/Search scope, click/keyboard route and airport filtering, Archive focus/scroll, selected states, no-selection and absent-flight cases. Check that map updates preserve expected view behavior.
- Test disabled WebGL, context loss and failed textures with operational SVG selection fallback; check runtime memory, resource disposal and tab-hidden solar updates.
- Prove Mobile design remains unchanged and screenshots/control interactions are intact. Inspect app bundle size and impact of shipping Three.js only in the lazily-loaded desktop chunk.
- Add dedicated Task 3 E2E for integration behavior and screenshots. Do not change approved Globe visual, camera/light parameter sources or existing reference pixel hash.
- Owner must separately review visuals and authorize any merge/deployment.

## Known environment limitation

The remote GitHub connector can write code and start CI through this PR, but the current execution environment cannot reach github.com from the container to clone the project; therefore no local pnpm, real browser or screenshot run has been performed in this session. Treat this as unverified WIP, even if GitHub accepts the commits.
