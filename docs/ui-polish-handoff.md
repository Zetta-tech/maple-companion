# UI polish checkpoint — 2026-10-25

Implemented on `feat/ui-polish`, based exactly on `de9028ec579f0e5902342c3fa665b52479312c20`. No server, shared-contract, dependency, NativeMemoryPanel or AssessmentPanel changes. The native-memory assessment hold and refresh coordination remain intact. No merge or deployment was performed.

## Status

This is an implementation checkpoint, not final design approval. The parent is recovering earlier YC research and exact requested corrections for a source-backed comparison. The current layout will be revised where that evidence calls for it.

## Result

- Saved discoveries lead the workspace. The latest C20 and Express Entry results show before profile editors; all earlier records remain in history, and unresolved requests stay visible.
- C20 shows the profile-specific reason and first next action before detailed evidence. Potential-pathway qualification stays visible.
- Express Entry leads with calculated previous/new totals and delta. Demo, projected/effective-date and unresolved-cap qualifications remain visible; full subtotals, conditions, sources and generated explanations remain inspectable.
- Updates live in the top-right notification center. Its count describes saved updates, not an invented unread count. Loading, unavailable and empty states differ.
- Existing profile review, discard and confirmation actions are retained. Demo reviews now move keyboard focus to their confirmation; saved employment inputs have a concise summary and expandable editor.
- Existing green, serif identity and light/dark themes are retained. No avatar work, new visual library, model calls, fabricated findings, or backend changes.

Owned files: `web/main.tsx`, `web/styles.css`, `web/DemoJourneyPanel.tsx`, `web/DemoJourneyPanel.css`, `web/CrsBreakdown.tsx`, `web/NotificationCenter.tsx`, `web/journey-presentation.ts`; regression coverage in `tests/ui-presentation.test.tsx`.

## Verification

`npm run check` passed: TypeScript, all 609 tests in 33 files, and production build. The existing large-bundle warning remains (about 532 kB minified / 153 kB gzip); no new dependency was added.

IAB checks used actual app components in a separate, clearly labelled offline fixture preview. Verified desktop, light/dark themes, mobile (416 CSS-pixel content width), narrow mobile (316 CSS pixels), no horizontal overflow, keyboard disclosure activation, notification Escape/focus restoration, official source links, full score details, history, missing information, unsupported C20, processing, uncertain outcome, source failure, stale results, and the native-memory assessment hold. Demo and employment review/confirm flows were exercised only on isolated fixtures. Confirmed changes and saved results survived browser reload. A clean reload and interactions produced no new console errors; development hot-reload errors during source edits did not recur.

## Preview and limits

The original signed-in `http://localhost:3000` was screenshot-audited read-only and left running unchanged. It is the older build, not this implementation.

The review preview is `http://127.0.0.1:5174/`. It runs the real `web/main.tsx` with an isolated Vite configuration at `.local/ui-preview.config.ts` and `.local/clerk-preview.tsx` in this worktree. Start with `node node_modules/vite/bin/vite.js --config .local/ui-preview.config.ts` after the existing locked dependencies are installed. These local-only helpers are intentionally excluded from production and from the integration commit. They must not become a production auth configuration.

The preview uses synthetic state and the existing offline calculator, not saved account data. There is no API proxy, provider request, or database write. Fixtures survive browser reload but reset when the preview process restarts or Reset fixture is used. The scenario selector demonstrates states without generating findings. Backend integration/authentication and persistence must still be checked on the parent's combined build; this pass does not claim end-to-end live-provider verification. No interface changes are required.

## Saved screenshots

All screenshots were saved locally, inspected, and uploaded successfully to Library. Local evidence is in `C:\Users\aakas\AppData\Local\Temp\maple-ui-audit-20261025`.

- [Desktop](https://chatgpt.com/api/library/files/libfile_f0002388ed248191b170a710d2c7a7f0/download)
- [Mobile C20](https://chatgpt.com/api/library/files/libfile_335df5b9f1688191b37308d9b9f8d7a6/download)
- [Mobile Express Entry](https://chatgpt.com/api/library/files/libfile_0a3dbdded4f0819183589c753869ea6b/download)
- [Sources and calculation detail](https://chatgpt.com/api/library/files/libfile_2eaf848b4e3881919bb6e7fe92bedb6c/download)
- [Light theme](https://chatgpt.com/api/library/files/libfile_016e31150bfc81918337673055bada4e/download)

The initial audit estimate was 3–5 focused hours including verification, with a first usable preview in 60–90 minutes. The focused implementation was ready earlier; production readiness still depends on review and verification of the combined application.
