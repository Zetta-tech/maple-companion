# Maple UI review handoff — 2026-10-25

This revision replaces the visually rejected `fb324924afbd4a85092f55483c18ceb003f28def` presentation. It is reviewable, not claimed visual acceptance or proof of 5–10 second comprehension. Branch `feat/ui-polish` includes backend recovery base `f52dae8c42d2ef0c3184a2b0278209d4d09e4fb3`. No merge or deployment. Original signed-in localhost:3000 and its saved data were left unchanged.

## Preview

**http://127.0.0.1:5175/** uses the actual app components with an explicit offline preview banner, synthetic data and the existing calculator. No API proxy, provider calls or database writes. It is not a live personal-account result. State survives browser reload and resets on process restart or Reset fixture.

QA session: **http://127.0.0.1:5175/?preview=qa-navigation**. Synthetic state is isolated by query parameter, avoiding interference with the root review session. Both policy-first and C20-first fixtures are available. Production event ordering remains unchanged.

Ignored local helpers: `.local/ui-preview.config.ts`, `.local/clerk-preview.tsx`. Start with `node node_modules/vite/bin/vite.js --config .local/ui-preview.config.ts --port 5175`. These are excluded from production and must never serve as production authentication.

## Requirement versus current screen

| Requirement | Current implementation |
| --- | --- |
| Cohesive score story | A single softly contrasted surface contains actual delta, previous score and projected score. Desktop +40 is 72px beside 528 → 568 at 48px; mobile keeps both numeric rows together. No gauges, number cards or count animation. |
| Breathing room with structure | Space separates result, qualification and action. Desktop explanation has a bounded adjacent column; numbers stay close. C20 retains distinct reason, qualification and next step. |
| Visible, concise qualifications | Projected, effective date, demo status, eligibility not established and unresolved-cap qualification stay below the score and above its action. Full exact conditions are retained in details. |
| Fewer collapsible controls | EE's Review score breakdown opens calculation, evidence and official records together. C20 has one Review evidence and official sources control. Per-source version toggles are removed; all hashes/dates remain readable inside the unified evidence surface. Existing history, generated explanation and meaningful profile review controls remain available. |
| Both discoveries | Both event orderings inspected. C20's reason, outstanding evidence and one next step precede its detail control. No permanent EE-first sorting was introduced. |
| Newsletter theme and backdrop | Inter/Space Grotesk, neutral light/charcoal surfaces and restrained Maple red replace arbitrary green/serif styling. Static 84px grid is masked out of the entire reading column, restricted to outer margins and removed on mobile; solid result surfaces preserve readability. No decorative motion. |
| Both themes and access | Same populated data, expanded sources, notifications and review controls checked in both themes. Current 320 CSS-pixel layouts have no horizontal overflow. Keyboard breakdown activation/focus return and C20 detail activation verified. Workspace anchors use aria-current and an underline. Desktop and narrow native IAB sticky navigation are visually verified; capture limitations are documented below. |

## Source-backed decisions

Read-only inspection of **Zetta-tech/maple-newsletter**:

- [web/src/app/globals.css](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/app/globals.css), blob `bafebddf565b6c7639af99e1e84f7b6932569f90`: brand #dc2626, #fafafa/#ffffff, #0f0f0f/#161616, #111827; type families.
- [web/src/app/layout.tsx](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/app/layout.tsx), blob `e64189c78255a2e61c617066116ee70aebc3b5c7`: actual font configuration.
- [web/src/components/landing/CinematicStory.tsx](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/components/landing/CinematicStory.tsx), blob `5db39450184c4118839bf3b6fe132b0aa067920a`: typography and red emphasis; cinematic motion not imported.
- [web/src/components/draws-client.tsx](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/components/draws-client.tsx), blob `7f5d3ad249bbc425f4d765477f0200a3a46b10ab`: dark surface roles, subtle grid/dividers and CRS emphasis.
- [web/src/app/post-ita-guidance/page.tsx](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/app/post-ita-guidance/page.tsx), blob `72429b7cf0eb217bc9ce869d271b71e9806fa220`, and [post-ita-guidance.module.css](https://github.com/Zetta-tech/maple-newsletter/blob/main/web/src/app/post-ita-guidance/post-ita-guidance.module.css), blob `325173873fb73c97ca63b6cb4393afea1ff31f99`: task grouping, readable takeaways, line lengths, section space, source strip and 84px hero grid.

The public [post-ITA page](https://www.maplenewsletter.com/post-ita-guidance) was accessible and inspected in IAB; screenshots 12/13 are saved locally. Newsletter code and Neon configuration were not changed.

Companion adaptations use #c82323 light text accent, #ff777b dark text accent and #dc2626 action fill to pass actual role-based contrast checks. Inter and Space Grotesk are self-hosted with SIL licenses, avoiding runtime font network calls.

Research: [NN/g visual hierarchy](https://www.nngroup.com/articles/visual-hierarchy-ux-definition/), [layer-cake scanning](https://www.nngroup.com/articles/layer-cake-pattern-scanning/), [minimalist design](https://www.nngroup.com/articles/aesthetic-minimalist-design/), [GOV.UK details](https://design-system.service.gov.uk/components/details/), [buttons](https://design-system.service.gov.uk/components/button/), [WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html). These support grouping/emphasis/disclosure decisions; no universal psychological effect or comprehension time is claimed.

The May 10 files in `C:/Users/aakas/Downloads/Codex/Maple Landing Page/` and parent-recovered chat decisions remain constraints. The canceled Oct 20 prototype was not treated as an approved destination, and its denied protected sign-in was not retried.

## Navigation and login follow-up

Navigation research reread: `yc-design-review-feedback.md:96` (predictable navigation), `:147` (one clear sticky state), and `maple-landing-page-design-plan.md:55` (one sticky state, additive hover, stable mobile targets) and `:381` (sticky QA). The app uses one section bar, native anchors with 80px offsets, active-section tracking on scroll and focus transfer to the chosen heading. Mobile visible labels shorten to Discoveries / Your info / Checks while accessible names remain complete. Desktop bar is about 61px; mobile is about 57px. No duplicated header or scroll animation.

The user-requested separate login agent completed the first `LoginExperience.tsx/.css` implementation, which the user subsequently rejected. It has now been replaced by the reference-informed static composition below. No hosted account settings or authentication behavior changed.

The new authoritative reference is `libfile_b995d186b4188191af217193f19f9cc6`, `image(20261025-160455).png`. The Library helper's Windows metadata error was resolved for this task by the user supplying and expressly authorizing a separate local copy: `C:/Users/aakas/Downloads/Codex/Build North Maple Companion/maple-companion/login-reference.png` (633,012 bytes). Both root and login side agent inspected its actual pixels. The implemented composition has an airy background, delicate natural veined leaf cropped in the lower-left quadrant, and compact unboxed sign-in right of center. The large left marketing panel and heavy form card are removed. Maple red/neutral colors remain; the reference's cream/orange palette and password fields were not copied.

The user's later instruction explicitly removed the motion requirement. The illustration is static, with no animation or pause control. The login side agent generated and inspected `web/public/images/login-maple-leaf.png`: transparent 1295 x 1215 RGBA, 1,631,155 bytes, SHA-256 `3d699a373d85817e5ee5db3ff64f7dbae1471f8413998f9aa8f8f18b957d17c1`. It is a decorative botanical illustration, not a newsletter logo. A stalled large file write delayed installation; bounded writes recovered the original generated bytes without regeneration. Root inspected both the installed PNG and its actual IAB rendering.

Production wiring is **<LoginExperience><SignIn routing="hash" appearance={clerkSignInAppearance} /></LoginExperience>**. The scoped appearance removes card chrome while preserving all Clerk fields, verification instructions, error and recovery states. Other account popovers keep their normal surfaces. No password fields were introduced.

**http://127.0.0.1:5175/?login-preview=1** is the updated offline visual preview. Its form is a non-submitting placeholder, not real authentication. The final static layout was inspected on desktop and at 320 CSS pixels in both themes. At 320px, form width is 263.3px and document scroll width is 303px: no horizontal overflow. The leaf is decorative, does not cover controls, and has computed animation `none`. No credentials were entered. Actual Clerk/email-code execution remains the backend owner's combined-environment integration check. The revised source passed the full **643-test suite**, typecheck and build; after the asset was installed, **build:vercel passed**, with the identical PNG present in both `dist/web/images/` and packaged `public/images/`. No deployment occurred.

## Data behavior preserved

Personal Guide uses committed `/api/guide/*`, confirmed employment, unknown initial supplemental answers, exact review before confirmation and stale-input protection. It never uses fictional defaults for personal CRS.

Uncertain saves use `POST /proposals/:id/reconcile` with `{}` for readback, without resending facts. Only a backend proposal restored to pending allows confirmation again. Personal source failures release the request hold only for explicit `guideRequestState: not_started`. NativeMemoryPanel synthetic-only handling and AssessmentPanel pending-state coordination remain intact. No server/shared contract changed.

## Verification and limits

- Final `npm run check`: TypeScript, **643 tests in 38 files**, production build passed after disclosure/backdrop changes.
- `git diff --check` passed. Build contains local font binaries/licenses. Existing size warning: 554.76 kB minified / 158.49 kB gzip.
- Current IAB: both themes, desktop/320px, both story orderings, real breakdown action, exact official links/hashes/dates, C20 unified disclosure, keyboard focus, expanded-state reflow and clean reload with no captured warnings/errors. Five EE sources and two C20 sources remain accessible without nested disclosures.
- This revision also checked review forms, draft retention across themes and confirmed personal synthetic save/reload. Earlier combined checks cover unknown intake, proved-unsent safe retry, uncertain save held across reload and reconciled without resend, stale results withheld, demo review invalidation, source failures, processing/missing/unsupported/empty states and native-memory holds.

**Mobile navigation discrepancy resolved by native IAB verification:** the viewport-emulated screenshot path produced inconsistent crop/scroll behavior under the host's scaled display. Explicit document clips also reset scrolling, so they were not valid sticky-state evidence. After resetting viewport emulation, the actual native IAB panel was narrowed and inspected directly. At 354 CSS pixels, screenshots 89/90/91 show the section bar pinned at y=0 in both themes, correct selected link and visible destination headings. Keyboard Enter moves focus to `native-memory-heading` (top 124.4px; bar bottom 56.5px) or `assessment-heading` without obscuring it. Manual scrolling changes the active section from Discoveries to Your info. No horizontal overflow (scroll width 338px inside a 354px viewport), and no captured runtime warnings/errors. The native panel minimum prevents an exact 320px native capture; earlier 320px layout checks remain separate evidence. This verifies implementation behavior, not user visual acceptance.

The only follow-up code change is `scrollbar-gutter: stable`, preventing line-wrap and anchor-position shifts when the capture process hides a scrollbar. Standard CSS sticky positioning remains; no fixed-position workaround was retained. Targeted presentation/theme checks passed: **74 tests in 2 files**, and the production build passed. The earlier combined **643-test/typecheck/build** run remains the full-suite baseline; no JavaScript changed in this follow-up. Browser viewport overrides and panel width were restored after QA.

Live authenticated personal save/readback and provider execution remain a combined-environment integration check. Policy seeding/configuration remains backend-owned. No provider request was made for visual QA.

Provided rejection attachment `libfile_f896204047d481918e7014da128dc2b2` was not materialized: the supported Library helper required an unavailable Python runtime. This is a tooling block, not a denied audit. Fresh actual IAB pixels were saved and inspected instead (01-before.png). Native host Library uploads succeeded for all final screenshots below.

## Final screenshots

Saved, inspected and uploaded successfully; returned Library version metadata written to local files. Local directory: `C:/Users/aakas/AppData/Local/Temp/maple-ui-audit-20261025/revision-2`.

- [30-final-desktop-dark.png](https://chatgpt.com/api/library/files/libfile_ae69e1e0d6a88191b7e9909903a97ebe/download)
- [31-final-desktop-light.png](https://chatgpt.com/api/library/files/libfile_4d73a7cd9dd48191b1787b3f4bfa4d18/download)
- [32-consolidated-details-light.png](https://chatgpt.com/api/library/files/libfile_5ca155f767608191a2dd3297bea16479/download)
- [33-consolidated-details-dark.png](https://chatgpt.com/api/library/files/libfile_4fe34a8b880c8191bd0a4b8bdded9744/download)
- [34-final-mobile-dark.png](https://chatgpt.com/api/library/files/libfile_9df8c919be908191b5355e0168066efd/download)
- [35-final-mobile-light.png](https://chatgpt.com/api/library/files/libfile_eb70fa0e1ba48191ab3fdac0070b87c1/download)
- [36-final-c20-light.png](https://chatgpt.com/api/library/files/libfile_9ba0cff1b9c881919eb3960048b85569/download)
- [37-final-c20-dark.png](https://chatgpt.com/api/library/files/libfile_9c5f4253ac50819186124e02e16fb332/download)



Latest masked-backdrop and navigation evidence (supersedes the initial grid in screenshots 30/31):
- [70-review-desktop-dark.jpg](https://chatgpt.com/api/library/files/libfile_cc5e924f166c81919b02a5d2f76d9156/download)
- [71-review-navigation-dark.jpg](https://chatgpt.com/api/library/files/libfile_c99bb9f7ffcc8191838b264037bcd9f6/download)
- [42-muted-grid-desktop-light.png](https://chatgpt.com/api/library/files/libfile_383ce54329d481918c8d78815c908571/download)
- [43-sticky-information-light.png](https://chatgpt.com/api/library/files/libfile_588f534004708191a2963fb161a4d8a7/download)
- [45-sticky-mobile-result-light.png](https://chatgpt.com/api/library/files/libfile_1f7a27e7b9388191b118db0601ea1006/download)

Superseded first login visual preview (rejected composition; explicit offline form placeholder):
- [60-login-desktop-light.jpg](https://chatgpt.com/api/library/files/libfile_361986ae38f48191806b0c12faeaf33c/download)
- [61-login-desktop-dark.jpg](https://chatgpt.com/api/library/files/libfile_b573f8bea4b08191b2038c20e9de1220/download)
- [62-login-mobile-dark.jpg](https://chatgpt.com/api/library/files/libfile_1ec76c87734081918e65c35437eee071/download)
- [63-login-mobile-light.jpg](https://chatgpt.com/api/library/files/libfile_1932336f8fcc8191bf902fe447f5b84f/download)

Latest verified mobile navigation captures, saved and inspected locally:
- `89-mobile-navigation-light.jpg`
- `90-mobile-checks-light.jpg`
- `91-mobile-navigation-dark.jpg`

Library delivery for this batch is pending. The current required prepared-upload helper returned `Library prepare_uploads is not available` before any upload result. No Library IDs were returned and no direct-upload workaround was used. These files remain in the local screenshot directory above. Prior screenshot links remain valid; the login images are the rejected first composition.

Final reference-informed static login captures, saved and inspected locally in the same directory:
- `102-login-mobile-light.jpg`
- `103-login-desktop-light.jpg`
- `104-login-desktop-dark.jpg`
- `105-login-mobile-dark.jpg`

These supersede login screenshots 60-63. Library transfer remains unavailable; no new upload delivery is claimed. The actual updated local preview URL above is ready for review, with user visual acceptance still pending.

## Owned files

Current revision: `web/LoginExperience.tsx/.css`, `web/Theme.tsx` presentation, `web/ScoreImpact.tsx`, `DiscoveryEvidence.tsx`, `WorkspaceNavigation.tsx`, `CrsBreakdown.tsx`, `DemoJourneyPanel.tsx/.css`, `main.tsx`, `styles.css`, `web/public/fonts/*`, presentation/theme tests and this handoff. Earlier UI commits include PersonalGuidePanel, GuideSaveActions, NativeMemoryPanel presentation, CrsEvidenceEditor, journey-presentation, NotificationCenter and request handling. Backend-owner worktree was not edited.
