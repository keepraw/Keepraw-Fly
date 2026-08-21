# Keepraw Fly Schema

Keepraw Fly JSON is the portable canonical format. It stores flight facts and
stable identifiers, while viewers derive display names, delays, distances and
statistics.

Version `0.1.0` deliberately keeps the core small. Namespaced `extensions`
allow compatible software to carry additional facts without making them part
of the core schema. Unknown extension values must be preserved during an
import/edit/export round trip.

Viewer preferences such as language, appearance, units and time format are not
part of this document. They belong to local application storage.

