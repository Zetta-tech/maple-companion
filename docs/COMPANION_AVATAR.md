# Companion character reuse

The dashboard character reuses the original inline SVG and local motion controller from `Zetta-tech/build-north-backup-maple-platform`, commit `5f5322e4d9fe7d0c37a683752f1a6e2e616af83d`:

- `src/MapleCompanion.tsx` → `web/MapleCompanion.tsx` (imports, server-render-safe preference check and gradient color tokens adapted).
- `src/companionMotion.ts` → `web/companionMotion.ts` (unchanged).
- Character-only rules from `src/discovery.css` → `web/MapleCompanion.css`, using Companion tokens and the existing reserved dashboard area.
- `tests/companion-motion.test.ts` reused with import and strict-type adjustments.

The character is decorative. Existing product text supplies status and next actions. Only genuine loading/checking selects its thoughtful pose; saved discoveries and unresolved outcomes never show its approval/check badge. No overlay, new panel, service, dependency, model call, camera or microphone access is added.

Motion settles after six active seconds, stops offscreen or when the page is hidden, and cleans up on unmount. The visible pause control persists a browser-local motion preference. Reduced-motion preference takes precedence and renders a static pose. The original geometry, gradient positions, texture and motion are retained.

The current separately committed palette variant uses a warm coral body, burgundy shading, restrained sage leaves and charcoal facial details. Light/dark CSS tokens adjust highlights, limbs and ground shadow without changing any SVG path or motion code. The original green palette remains recoverable at commit `6d375d3a1444b69981a7471314a0f12387a118c2`, and the previous sage/forest body variant at `ab3fe339caabf99ec795dbdc507c10cb6d3711af`. The coral variant was inspected in desktop screenshots in both themes and its production build passed. The preceding sage variant passed the full 704-test check, typecheck and build, plus desktop and 320 px visual checks; the coral change modifies only CSS color values.

Validation: `npm run check` passed 704 tests across 43 files, typecheck and build, including the employment setup fix merged in PR #18. Desktop and 320/390 px light/dark screenshots were inspected with no horizontal overflow. Keyboard pause persisted across reload and did not change saved result content. A QA-only media-query simulation showed the static reduced-motion pose; lifecycle unit tests verify no animation frames are scheduled while reduced or paused. No production setting was changed. The preview uses explicit synthetic fixtures and mocked authentication on port 5202.
