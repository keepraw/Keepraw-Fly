# Keepraw Fly visual system

The visual system gives later page-by-page UI work a shared foundation. It is intentionally small: tokens define the product's visual language, while page CSS remains responsible for composition.

## Principles

1. **Facts first.** Flight numbers, airport codes, times and route relationships are the visual priority.
2. **Quiet confidence.** Warm neutral surfaces, restrained green accents and generous whitespace should feel archival rather than dashboard-like.
3. **Local ownership is visible.** Demo, replacement and destructive states must be explicit before the user acts.
4. **One system, two languages.** Layouts must tolerate longer English labels and dense Chinese labels without relying on fixed text widths.
5. **Accessible by default.** Semantic controls, visible keyboard focus, sufficient contrast and reduced-motion support are system rules.

## Token layers

`apps/web/src/design-system.css` is loaded before page styles and contains:

- semantic colors for text, canvas, surfaces, lines, accent, danger and focus;
- a dedicated dark atlas palette for the Flight Passport map;
- a compact type scale and weight/tracking roles;
- an 8-step spacing scale and a single content-width token;
- control heights, shape roles, modal elevation and motion timing;
- light, dark and system-theme values.

Existing short names such as `--ink` and `--green` remain as compatibility aliases. New components should prefer the semantic `--color-*` roles and shared shape, spacing and control tokens.

## Component rules

- Primary buttons are filled; secondary buttons are outlined or transparent. A destructive action must use the danger role and explicit language.
- Inputs and selects use the medium control height and control radius.
- Cards use the card radius; modal surfaces use the modal radius and modal shadow.
- Keyboard focus uses `--focus-ring` and must never be removed.
- Animations use the shared durations and are effectively disabled when the operating system requests reduced motion.

## Scope

This foundation does not claim that every current page is visually finished. Flights, detail, Passport and settings can now be refined one at a time without inventing new colors, radii or control behavior for each screen.
