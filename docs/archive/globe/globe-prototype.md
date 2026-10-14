# Globe renderer selection

Historical decision from the 2026-10-09 prototype, starting at checkpoint `a6be5cc`.
The [original report](https://github.com/keepraw/Keepraw-Fly/blob/8090372ac6d02d2c4c9dec4c09c78c2444f4641b/docs/globe-prototype.md)
contains the full delivery and validation record. See [current Globe implementation](../../globe.md)
for production behavior.

## Context and choice

The existing projected map supplied local route geometry and interaction, but the
Globe design needed a real curved surface, texture-based illumination, raised
routes and depth occlusion. The prototype chose a directly controlled Three.js
renderer instead of another projection or an additional Globe wrapper.

| Alternative                | Recorded tradeoff                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Three.js + WebGL           | Direct control of materials, shaders, depth and composition; OrbitControls needed accompanying DOM labels and keyboard selection            |
| D3 orthographic Canvas/SVG | Lowest added dependency cost and useful native SVG semantics, but surface lighting, raised arcs and depth would require extra simulation    |
| Globe.gl                   | Convenient Three.js-based interaction, with an additional wrapper/dependency to maintain and penetrate for custom materials and camera work |

The prototype did not install Globe.gl or measure its bundle cost. These are
project-specific engineering tradeoffs, not a universal ranking of map libraries.
React Three Fiber was not adopted.

## Consequences

The scene reused the existing airport directory, archive filtering and core route
segments rather than defining another flight model. Cancelled/diverted flights
and directed counts retained core semantics; renderer interaction did not write
camera or selection state into portable flight data.

The existing Natural Earth relief was a grayscale supporting layer for the 2D
map. It could not supply the Globe's complete colored terrain/bathymetry material.
The prototype instead used a local geographic NASA Blue Marble UV texture;
provenance and generation were recorded separately from the visual design.

The choice incurred GPU, texture and lifecycle costs plus explicit DOM/keyboard
accessibility work. The original software-renderer observations were not enough
for production acceptance. Its startup timings, screenshot gallery and
approval-pending integration recommendations describe that prototype only and
remain in Git history. They are not current operational guidance.
