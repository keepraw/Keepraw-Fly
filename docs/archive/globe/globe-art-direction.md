# Globe material alternatives and route hierarchy

Historical Task 1B-3 decision. Rendered source:
`2efd89b6bb6ea87a832ca6eecc1359e6c709a4d1`; baseline:
`b9d32b3be9b6791a5a2861846d220c96ca0d59f0`.
The [original report](https://github.com/keepraw/Keepraw-Fly/blob/8090372ac6d02d2c4c9dec4c09c78c2444f4641b/docs/globe-art-direction.md)
contains the complete A/B review. Current behavior lives in [Globe implementation](../../globe.md);
the later [approved Control](../visual-review/task-1b-7b2/README.md) records acceptance.

## Problem and alternatives

The earlier bright orange/cream city treatment drew attention to population density
before the owner's routes. Broad atmospheric glow and uniformly bright Light land
also weakened surface separation. The refinement kept the geographic data,
composition and camera fixed to compare material choices without changing flights.

| Candidate                                       | Recorded tradeoff                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A: restrained blue atmospheric core             | Quiet surface and route hierarchy; less dramatic horizon separation                                               |
| B: localized cold-white tangent and outer skirt | More focal atmospheric depth, with a more noticeable synthetic rim and possible route-contrast loss near the limb |

Both used the same camera, route geometry, world sun, exposure and city intensity.
B did not gain brightness through a different flight set or stronger city emission.
The later owner-approved Control used art direction A; this comparison itself was
not the acceptance record.

## Lasting rationale

Selected routes/endpoints should lead, followed by ordinary routes and airport
labels, with city lights and terrain supporting them. The response used real
geographic grayscale signals rather than regional masks, invented cities or
random removal. Neutral warm color and bounded highlights addressed the old
white-gold peaks; the subsequent [night-response diagnosis](../visual-review/task-1b-5/diagnosis.md)
explains recovery of weak urban signals that this treatment suppressed.

Day textures decode from sRGB once; display-authored palettes convert to linear
values before lighting, ACES Filmic and sRGB output. Night visualization data are
not calibrated radiance. The response and theme parameters recorded at this
checkpoint are historical alternatives, not values to copy into current shaders.

The original screenshots, timing samples and per-browser run outcomes remain in
Git history. Automated pixel checks supported comparison but did not establish
human visual acceptance.
