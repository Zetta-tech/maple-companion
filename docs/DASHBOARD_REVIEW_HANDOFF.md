# Dashboard overview review — 25 October 2026

Base: PR11 `d89a5dc59c90cc6c160f0d56dcf2d06abea127c8`.
Branch: `feat/dashboard-overview`.
Review preview: http://127.0.0.1:5198/?preview=dashboard-final

This preview runs the actual application components with an explicit offline banner, synthetic in-memory data and mocked authentication. It makes no provider or database calls. Port 3000, the backup on 5182, PR11's component fixture on 5192, and the separate Clerk styling worktree were not changed.

## What changed

- Replaced the vague starting hierarchy with “What would you like to understand?”, a compact character placeholder, and actions into the existing Guide and information controls.
- Added a persistent desktop workspace sidebar and one compact sticky section navigation on smaller screens. Anchor actions open containing disclosures and place keyboard focus at their destination.
- Added a next-step panel driven by existing employment and Guide state. Pending changes, unresolved requests, unavailable readback, stale results and missing information take precedence over saved-result review. It does not claim that a discovery establishes eligibility.
- Added a saved employment summary with actual title, employer, hours and employment status. Unavailable readback suppresses the cached summary; missing hours remain unknown.
- Kept the existing C20/EE components, official sources, disclosures, confirmation controls, data actions and authentication. The personal Guide heading is now “Your discoveries”.

The backup's workspace map and overview grouping informed the layout, not its metrics or avatar. Primary research on visual hierarchy and descriptive scanning headings informed the grouping:
https://www.nngroup.com/articles/visual-hierarchy-ux-definition/
https://www.nngroup.com/articles/layer-cake-pattern-scanning/

## Validation

- `npm run check`: 685 tests passed across 41 files; typecheck and production build passed. The sandbox initially denied HTTP tests' loopback connections; the approved host run passed. Vite still reports its existing large-chunk advisory.
- `git diff --check`: passed.
- Desktop dark and light screenshots inspected. Initial 320 px and 390 px layouts checked without horizontal overflow.
- Ask Maple Guide opens and focuses the existing question without sending it. Keyboard section activation focuses the destination heading below the sticky bar in DOM geometry checks.
- The personal stale fixture shows “Bring your Guide up to date”; its review action opens the existing editor and focuses “Review your Guide details”. A processing event shows “Check your earlier request”. Saved fixture reload restores its saved results.
- Eight focused dashboard tests cover unavailable readback, unresolved changes, pending/review/unavailable/empty Guide states, unknown hours, and unavailable Guide fallback navigation.

## Evidence and remaining review

Local screenshots are under `C:/Users/aakas/AppData/Local/Temp/maple-ui-audit-20261025/`:
- `135-backup-dashboard-reference.jpg`: actual backup reference.
- `137-dashboard-review-dark.jpg`: desktop overview; Library `libfile_240c36a738448191a7d7b6064508a2f6`.
- `138-dashboard-review-light.jpg`: desktop light overview.
- `139-dashboard-mobile320-light.jpg`: narrow light overview.
- `146-dashboard-mobile390-dark.jpg`: initial phone dark overview.

Scrolled mobile screenshots from IAB emulation crop away the sticky bar even though DOM geometry places it at viewport top and focuses the destination below it. Direct native pane input was unavailable (`coordinate input geometry is unavailable`); do not treat those cropped captures as visual proof. A direct mobile visual check remains before final release acceptance. User aesthetic review and combined live-auth integration remain separate; no merge or deployment was performed.

Library upload succeeded. Windows could not persist the optional local extended attributes (`os.setxattr` unavailable); the Library identity above is valid, and no replacement upload was attempted.

Owned files: `web/DashboardOverview.tsx`, `web/DashboardOverview.css`, `web/WorkspaceNavigation.tsx`, `web/main.tsx`, presentation-only status callbacks in `web/PersonalGuidePanel.tsx` and `web/DemoJourneyPanel.tsx`, `tests/dashboard-overview.test.tsx`, and this handoff. No login CSS, backend or shared-contract changes.
