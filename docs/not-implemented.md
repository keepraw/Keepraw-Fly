# Explicitly deferred

The 0.1 local viewer does not implement:

- a backend, accounts, authentication, cloud sync or server persistence
- live flight status, delay prediction or notifications
- airline/booking integrations, ticket purchasing or boarding-pass storage
- email, CSV, screenshot, OCR or AI importers
- payment, subscriptions, advertising, analytics or social features
- zoomable third-party basemaps or map APIs (the bundled route map is local and static)
- a raw JSON editor (Power User Mode is an informational placeholder)
- a complete worldwide airline reference dataset
- self-hosted `ServerStorageAdapter`
- native mobile or desktop applications

These omissions are intentional first-stage product boundaries.
