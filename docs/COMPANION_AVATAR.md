# Companion character reuse

The dashboard character reuses the original inline SVG and local motion controller from `Zetta-tech/build-north-backup-maple-platform`, commit `5f5322e4d9fe7d0c37a683752f1a6e2e616af83d`:

- `src/MapleCompanion.tsx` → `web/MapleCompanion.tsx` (imports and server-render-safe preference check adapted).
- `src/companionMotion.ts` → `web/companionMotion.ts` (unchanged).
- Character-only rules from `src/discovery.css` → `web/MapleCompanion.css`, using Companion tokens and the existing reserved dashboard area.
- `tests/companion-motion.test.ts` reused with import and strict-type adjustments.

The character is decorative. Existing product text supplies status and next actions. Only genuine loading/checking selects its thoughtful pose; saved discoveries and unresolved outcomes never show its approval/check badge. No overlay, new panel, service, dependency, model call, camera or microphone access is added.

Motion settles after six active seconds, stops offscreen or when the page is hidden, and cleans up on unmount. The visible pause control persists a browser-local motion preference. Reduced-motion preference takes precedence and renders a static pose. The original artwork and colors are retained.

Validation: `npm run check` passed 702 tests across 43 files, typecheck and build. Desktop and 320/390 px light/dark screenshots were inspected with no horizontal overflow. Keyboard pause persisted across reload and did not change saved result content. A QA-only media-query simulation showed the static reduced-motion pose; lifecycle unit tests verify no animation frames are scheduled while reduced or paused. No production setting was changed. The preview uses explicit synthetic fixtures and mocked authentication on port 5202.
