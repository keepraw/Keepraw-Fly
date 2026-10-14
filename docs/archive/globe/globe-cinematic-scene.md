# Representative Globe composition and route semantics

Historical Task 1B-2 decision. Baseline: `45f92e9c78a118417803dc7f43f027a821f95c65`;
rendered implementation: `c814eb3779d69aa6037c154370913a62a13b7af1`.
The [original report](https://github.com/keepraw/Keepraw-Fly/blob/8090372ac6d02d2c4c9dec4c09c78c2444f4641b/docs/globe-cinematic-scene.md)
contains fixed-camera measurements and validation. Use [current Globe implementation](../../globe.md)
for the released surfaces and [approved Control](../../visual-review/task-1b-7b2/README.md)
for the later accepted design reference.

## Composition decision

A raw longitude average cannot represent activity across the date line. Centering
only the most visited airport can also hide a coherent regional flight network.
The recorded algorithm scored weighted airport visits and five great-circle
samples per route, searched 192 spherical candidates and refined deterministically.
Dense regional activity outweighed sparse global outliers without assuming Asia.

A separate composition step evaluated actual airports/routes through the camera
at the container's aspect ratio. Safe margins, activity balance and the upper
horizon determined distance and view offset. The changed Demo framing was evidence
for this data-dependent approach, not a hard-coded regional default.

Home recomputed composition for the current container. An untouched Home view
could recompose on resize; a user-operated camera retained ownership. Hover
changed styling without turning the camera. The sun remained in world space when
selection, orbit, zoom, Home or appearance changed.

## Route decision

Opposite/duplicate airport pairs shared one physical stroke to avoid coincident
transparent lines, while directed route segments, flight counts and selectable
choices remained distinct. Picking retained a selected direction when possible
and otherwise used the deterministic first direction. This reduced visual work
without inventing or discarding flight facts.

Arc height used a bounded angle-dependent response and a `sin(πt)^1.2` profile,
with coincident endpoints producing no raised loop. A continuous world-normal
fade reduced limb clutter while depth testing and sphere-based picking preserved
occlusion. Selected-route framing used the real midpoint, endpoints and aspect.

These choices explain why composition and physical strokes are separate from
business counts. Historical camera vectors, measured frame cadence and task-level
pass counts are in the original record; they do not specify current page geometry.
