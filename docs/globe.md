# Current Globe implementation

This is the maintained entry point for the production Globe. Start with
[architecture](architecture.md) for data and package boundaries and
[testing](testing.md#flight-detail-3d-globe) for renderer regression expectations.
The original prototype and cinematic experiments are [historical design records](archive/README.md#obsolete-documentation--archived-design-history).

## Production surfaces

Desktop Passport lazily loads `PassportGlobe` at widths of at least 761px. It
receives the current Passport routes, flights, appearance, solar mode and
selection; route and airport choices remain connected to the archive. Rendering
failure exposes a localized retry and the existing interactive SVG
`PassportRouteMap` fallback. Mobile Passport does not mount this Globe.

Desktop Flight Detail lazily loads `DetailGlobe` for the current flight at the
same 761px boundary. It builds a single route through core `buildRouteSegments`,
using the diversion airport when applicable. Cancelled flights or unavailable
route coordinates show localized explanations. Detail failures expose localized
retry without an SVG fallback. Mobile Detail creates no Globe context or imagery
requests.

The renderer is shared, but Detail has an independent route-fit camera and Home
composition. Detail appearance, language and solar updates preserve its renderer
and the user's camera; changing route semantics clears the prior selection.
Passport retains its own data-dependent composition and interaction behavior.

## Rendering and lifecycle

Three.js renders the surface, atmosphere, routes and airport markers. Daytime
Blue Marble and nighttime Black Marble textures are bundled local assets with
pinned provenance; no external map tiles or live flight-status service are used.
The production wrappers select 4096px textures and `defaultLighting`; inspect the
source values before changing them rather than copying an old experiment table.

Fixed solar mode restores the canonical world-space direction. Realtime mode
uses UTC with the existing minute/visibility updates. Rendering is scheduled on
demand and respects hidden-page and reduced-motion behavior. `GlobeMap` disposes
controls before React detaches the canvas, and the renderer releases listeners,
geometry, materials and textures, including textures that finish loading late.

Globe UI text uses the regular locale resources. The DEV-only `/globe-lab` remains
a diagnostic surface; Three.js and the production Globe are also shipped in the
released application's lazy modules.

## Source entry points

| Source                                                                                                                                        | Responsibility                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [PassportPage](../apps/web/src/pages/PassportPage.tsx) / [PassportGlobe](../apps/web/src/globe/PassportGlobe.tsx)                             | Desktop loading and Passport selection integration            |
| [FlightDetailPage](../apps/web/src/pages/FlightDetailPage.tsx) / [DetailGlobe](../apps/web/src/globe/DetailGlobe.tsx)                         | Desktop single-route composition and unavailable-route states |
| [GlobeMap](../apps/web/src/globe/GlobeMap.tsx)                                                                                                | React lifecycle, updates, retry and variant-specific fallback |
| [Renderer](../apps/web/src/globe/globe-renderer.ts) / [math](../apps/web/src/globe/globe-math.ts)                                             | Scene ownership, picking, camera and route geometry           |
| [Lighting](../apps/web/src/globe/globe-lighting.ts) / [solar](../apps/web/src/globe/globe-solar.ts)                                           | Current material defaults and fixed/realtime solar model      |
| [Day provenance](../apps/web/src/globe/globe-texture.source.json) / [night provenance](../apps/web/src/globe/globe-night-texture.source.json) | Texture origin, hashes and reproducible generation            |

The [approved Control record](visual-review/task-1b-7b2/README.md) preserves the
owner-approved design baseline; its camera dimensions and test counts are
historical. The [retained evidence index](visual-review/README.md) explains which
numerical records are still inputs to current tests. Recapture the current
product for layout review instead of treating a historical PNG as current geometry.
