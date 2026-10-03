# Current product boundaries

The 0.1 local viewer does not currently implement:

- a backend, accounts, authentication, cloud sync or server persistence
- live flight status, delay prediction or notifications
- airline/booking integrations, ticket purchasing or boarding-pass storage
- email, screenshot, OCR or AI-assisted importers, and other third-party importers beyond the supported Flighty import workflow
- payment, subscriptions, advertising, analytics or social features
- external map tiles or map APIs (the bundled SVG map supports local pan, zoom and selection)
- a raw JSON editor (Power User Mode is an informational placeholder)
- a complete worldwide airline reference dataset
- self-hosted `ServerStorageAdapter`
- native mobile or desktop applications

These are current scope limits, not a release roadmap. See the
[README](../README.md) for supported workflows and [architecture](architecture.md)
for the local storage and reference-data boundaries.
