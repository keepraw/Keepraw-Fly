# Current Globe implementation

The Globe is no longer a production surface. Since the 2D map migration
([map architecture](map-2d-architecture.md#production-map-surfaces-pr-3)),
Passport and Flight Detail render the shared 2D SVG map and no production page
mounts a WebGL canvas. This document describes the retained Globe source, which
is reachable only through the DEV-only `/globe-lab` and is scheduled for removal.
The original prototype and cinematic experiments are [historical design records](archive/README.md#design-rationale).

## Retained surfaces

`PassportGlobe` and `DetailGlobe` remain in the source tree without a production
importer. `GlobeMap` and the renderer are exercised by Globe Lab; a non-detail
`GlobeMap` failure still falls back to the unthemed `PassportRouteMap`.

## Rendering and lifecycle

Three.js renders the surface, atmosphere, routes and airport markers. Daytime
Blue Marble and nighttime Black Marble textures are bundled local assets with
pinned provenance; no external map tiles or live flight-status service are used.
The daytime color texture uses sRGB decoding; the night map uses `NoColorSpace`
because its grayscale visualization signal is not calibrated radiance. Shading
uses linear values before ACES Filmic and sRGB output, avoiding a second gamma
conversion. Fixed world-space sunlight keeps geographic illumination independent
of camera rotation; the earlier lighting experiment is available in Git history.
The production wrappers select 4096px textures and `defaultLighting`; inspect the
source values before changing them rather than copying an old experiment table.

Fixed solar mode restores the canonical world-space direction. Realtime mode
uses UTC with the existing minute/visibility updates. Rendering is scheduled on
demand and respects hidden-page and reduced-motion behavior. `GlobeMap` disposes
controls before React detaches the canvas, and the renderer releases listeners,
geometry, materials and textures, including textures that finish loading late.

Globe UI text uses the regular locale resources. The DEV-only `/globe-lab` is the
only surface that loads Three.js and the Globe.

## Source entry points

| Source                                                                                                                                        | Responsibility                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [PassportGlobe](../apps/web/src/globe/PassportGlobe.tsx)                                                                                      | Retained Passport wrapper (no production importer)            |
| [DetailGlobe](../apps/web/src/globe/DetailGlobe.tsx)                                                                                          | Retained single-route wrapper (no production importer)        |
| [GlobeMap](../apps/web/src/globe/GlobeMap.tsx)                                                                                                | React lifecycle, updates, retry and variant-specific fallback |
| [Renderer](../apps/web/src/globe/globe-renderer.ts) / [math](../apps/web/src/globe/globe-math.ts)                                             | Scene ownership, picking, camera and route geometry           |
| [Lighting](../apps/web/src/globe/globe-lighting.ts) / [solar](../apps/web/src/globe/globe-solar.ts)                                           | Current material defaults and fixed/realtime solar model      |
| [Day provenance](../apps/web/src/globe/globe-texture.source.json) / [night provenance](../apps/web/src/globe/globe-night-texture.source.json) | Texture origin, hashes and reproducible generation            |

The [approved Control record](archive/visual-review/task-1b-7b2/README.md) preserves the
owner-approved design baseline; its camera dimensions and test counts are
historical. The [historical archive](archive/README.md) explains which
numerical records are still inputs to current tests. Recapture the current
product for layout review instead of treating a historical PNG as current geometry.
