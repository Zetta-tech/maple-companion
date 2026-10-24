# Maple appearance

The light theme retains Maple's warm paper, green accent and serif headings. The dark theme uses a green-charcoal page, quieter secondary sections and raised review surfaces. Inputs, primary button labels, borders, disabled controls and status messages have separate semantic roles; none depend on a surface staying white.

The header's keyboard-accessible **Dark mode** toggle uses a stable accessible name and `aria-pressed`. Its choice is stored under `maple-theme` in this browser. Before an explicit choice, the theme follows `prefers-color-scheme`, including changes during the visit. Storage denial falls back to the system preference and still permits a temporary choice. Storage events synchronize open tabs. A small same-origin script in the document head sets the theme before the app renders. Native controls use the corresponding `color-scheme`.

Clerk consumes the same CSS tokens through its supported `appearance.variables` and documented element styles. Theme changes update the variables in place without remounting Clerk or changing authentication. No new dependency is required.

## Basis

- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html): normal text pairs are checked at 4.5:1 or better, including muted copy and statuses.
- [WCAG non-text contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html): input boundaries and focus indicators are checked at 3:1 or better against relevant surfaces.
- [MDN color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): browser controls, including select/date UI, receive the active scheme.
- [Clerk appearance variables](https://clerk.com/docs/react/guides/customizing-clerk/appearance-prop/variables): cards, inputs, muted surfaces, foregrounds, status colors and overlays use the supported theming API.

## Verification, 2026-10-24

- `npm run check`: typecheck, all 404 tests and production build passed. Theme tests cover startup choices, invalid/blocked storage and semantic contrast in both palettes.
- Codex IAB rendered the actual application with a separate GET-only fictional fixture server on loopback port 5178. The fixture aliases Clerk only in its external, local Vite configuration. It is outside the repository and production build; no provider request or data write is available.
- IAB DOM/computed-style checks: keyboard toggle, persistence across reload, preservation of unsaved form text, pre-sign-in error state, error/disabled forms, native selects and NOC disclosure, review comparison and changed-row backgrounds.
- Both themes checked at measured CSS widths 320, 375, 414 and 768 px, plus desktop. A 320 px header overflow was found and fixed; the toggle retains its 44 px target and accessible name when its visible label is hidden at the narrowest width.
- Screenshot limitation: IAB's baseline and final capture calls returned `Unable to capture screenshot`, including visible and bounded-capture attempts. No before/after image or pixel-level visual verification is claimed. No alternate browser was used. A screenshot pass remains necessary before promoting this draft.
- Live Clerk sign-in/account popovers and OS-rendered native popups were not visually verified because this task forbids provider calls. The appearance object passes the installed Clerk SDK's TypeScript checks. Run an authenticated visual pass before release.

The preceding checks describe the isolated theme commit `0765312`. Its production
files were integrated into the active companion checkout with the user's approval;
the external fixture harness was not imported. The combined change also contains
the separately documented hours clarification and private diagnostics. It is based
on PR #6's branch while that review remains open. No deployment or merge is included.

Combined verification: 480 tests, typecheck and build pass. On the real
`http://localhost:3000` app, Codex IAB verified the live Clerk sign-in surface,
both theme states, computed page/card colors and no horizontal overflow at the
current desktop viewport. The toggle was left in dark mode. This IAB session was
signed out; no sign-in, pending proposal action or live extraction was attempted.
Screenshot capture again returned `Unable to capture screenshot`; authenticated
workspace/popover pixel verification remains unclaimed. Theme preference is
origin/browser-specific, so the separate port 5178 preference does not transfer.
