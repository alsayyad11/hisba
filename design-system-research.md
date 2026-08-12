# Hisba design-system research

## Sources

1. W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
2. Material 3 Color Roles: https://m3.material.io/styles/color/roles
3. Material Bidirectionality: https://m2.material.io/design/usability/bidirectionality.html

## Decisions for Hisba

- Use semantic color roles rather than raw colors: surface, surface-container, on-surface, on-surface-variant, primary, on-primary, secondary, error, outline.
- Keep the same role map between Light and Dark; only the actual values change.
- Validate normal text at WCAG AA minimum contrast 4.5:1, large text 3:1, and non-text UI boundaries/focus indicators at 3:1 where applicable.
- Avoid using accent colors as body text unless the contrast is measured for the exact surface.
- Keep Arabic typography readable with a stable font stack, clear line-height, limited weights, and consistent size hierarchy.
- Mirror layout and directional icons in RTL, but do not mirror non-directional icons such as search, camera, or wallet. Keep numbers and LTR strings in their natural direction.
- Treat surfaces as a small elevation ladder; avoid gradients and arbitrary per-component colors that break theme consistency.
- Use tokens for all component colors, borders, text, focus rings, and states so Web and Android share the same semantic system.

## Implementation order

1. Audit tokens and remove late overrides.
2. Define Light/Dark semantic roles.
3. Map body, cards, inputs, buttons, tables, toasts, and destructive states to roles.
4. Fix Arabic typography and spacing rhythm.
5. Run contrast checks on representative foreground/background pairs and verify RTL/mobile states.
6. Sync www and Capacitor, then build APK.

## Important note

The current project contains multiple late CSS override blocks, which are likely causing the perceived inconsistency. The redesign should consolidate rather than append another override layer.

## References

[1]: https://www.w3.org/TR/WCAG22/ "Web Content Accessibility Guidelines (WCAG) 2.2"
[2]: https://m3.material.io/styles/color/roles "Material 3 Color Roles"
[3]: https://m2.material.io/design/usability/bidirectionality.html "Material Bidirectionality"

