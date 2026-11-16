# PR 118 CI investigation

The failing push run [43382644843](https://github.com/keepraw/Keepraw-Fly/actions/runs/43382644843)
and PR run [43382703004](https://github.com/keepraw/Keepraw-Fly/actions/runs/43382703004)
used `0e2039e94a8405ef35588ae0992ce626f399b57d`.

## Formatting and archive versions

The project Prettier command ran in GitHub Actions, without downloading local
dependencies. It formatted all 28 reported files. The first-use create, CSV and
Flighty expectations now require 0.2.0. The JSON import case still imports 0.1.0,
compares the entire saved document with its input, and explicitly checks that
the importer does not manufacture endpoint IDs.

## Reference-point regression

The remote [coordinate audit](https://github.com/keepraw/Keepraw-Fly/actions/runs/43391103417)
ran the same fixture through the pre-refactor implementation at
`d6ee3a06960fc0a28964680599c0301ab3ebfc5d` and the failing implementation.
Its artifacts contain every flight's endpoint IDs, identity keys, coordinates,
distance, cancellation flag and aggregate statistics.

The total changed from 571473.8186966669 km to 571505.1023713474 km, a
31.2836746805 km increase. Airport count remained 19 and directed route count
remained 66; the share image's 49 undirected plotted routes also passed in both
original runs. The archive contains 92 records, including one cancelled flight
and one flight with an unknown endpoint. Of those records, 91 changed distance,
including the cancelled record, which is excluded from the aggregate.

Fifteen airport reference points changed: NRT, HND, PVG, ICN, HKG, SFO, PEK,
LHR, LAX, JFK, SYD, CDG, SIN, CAN and CTU. Removing the curated directory overlay
changed fourteen of these points. Unconditionally substituting formal survey
coordinates changed HKG's reference point. The airports did not physically
relocate. Existing directory-only endpoints now have permanent IDs rather than
null IDs and code-based keys; that intended change did not alter airport count.

The fix stores the established reference points in the physical directory and
uses explicit ID equality to retain a continuing entity's canonical point.
Formal coordinates supply entities absent from the directory. No proximity
matching or candidate matching is introduced. Known LYG, LZO and NMI coordinate
corrections are stored directly in the directory with provenance. Saved endpoint
IDs keep precedence over date and code lookup.

## Night scene regression

The same remote audit captured the old and failing screenshots and scene JSON.
The old test passes; the failing revision reproduces the 856-to-857 change.
Both scenes have 22 physical routes and a 1006 by 608 canvas. The camera changed
from `[-1.1462179214868498, 0.5012782172755569, -1.6866845067609426]` to
`[-1.1459832046057938, 0.5012828529890873, -1.6868426115262078]`. The view offset
changed from `[-0.0459629031778328, -0.5004980895646883]` to
`[-0.045906644554208065, -0.5004858574405304]`.

`nightPixels` counts pixels whose world rays land in fixed geographic regions;
`all.count` does not count illuminated cities. Applying the existing world-ray
formula to the captured remote scenes identifies pixel **(485, 252)** (zero-based
canvas coordinates) as entering the Beijing/Tianjin region. No pixel leaves that
region. Other geographic regions also gain or lose boundary pixels. The cause
is automatic camera framing responding to changed airport reference points,
not an extra city-light source or a changed emission shader.

The fix preserves the 856 assertion, geographic boundaries, brightness
thresholds and visual baseline. The test now attaches scene JSON and on/off/route
screenshots before assertions so future failures retain useful evidence.

## Failures exposed after formatting

Remote type checking passed. The first workspace unit run then exposed a test
using TSE in 2018, before the reviewed interval's latest-start bound of
2020-04-07. The continuity assertion now uses 2020-05-01 and additionally requires
the 2018 query to remain uncertain. No historical date was invented. TAO's
established English directory name is retained with the raw upstream spelling
as a historical search alias.

Final full-CI results will be recorded after both push and PR runs complete.

The [second remote audit](https://github.com/keepraw/Keepraw-Fly/actions/runs/43796711615)
confirms that the fixed branch restores every fixture flight's original distance
exactly, including the total 571473.8186966669 km. All six dark/light on/off/route
PNG attachments have exactly the same content hashes as the pre-refactor run.
The unchanged night pixel assertions pass. The old failing revision remains in
that diagnostic matrix as a control and still fails, so the diagnostic workflow
as a whole is intentionally red; this is separate from the required full CI.

The next unit run passed all 124 core and 35 validator tests, exposing two web
issues: the empty-archive unit expectation still said 0.1.0, and Umetrip name
lookup did not include the physical directory's historical names after the
refactor. The latter now includes those names and tests both pre-change IST and
post-change ISL for the same Atatürk entity.

The directory merge now finds an existing formal entity by permanent ID even
after its current code changes. It retains the updated reference point, names,
aliases and status instead of letting the old crosswalk restore a stale code.
A regression exercises a synthetic HKG-to-XHK directory rename while a saved
HKG endpoint keeps its confirmed entity.

Full CI also exposed a workflow-source test still expecting pushes only on
`main`. Its exact branch-list assertion now includes this review branch, matching
the existing push workflow. All dependency-result checks and the main-only
deployment assertion remain intact. Temporary audit tooling was removed after
capturing its evidence.
