# Maple UI handoff — 2026-10-25

Reviewable implementation on `feat/ui-polish`, rebased onto backend recovery commit `f52dae8c42d2ef0c3184a2b0278209d4d09e4fb3`. No merge or deployment. The original signed-in localhost:3000 recording process and its data were left unchanged.

## Preview

**http://127.0.0.1:5175/** uses the actual app components with a conspicuous offline-fixture banner. It has synthetic data, the existing offline calculator, no API proxy, no provider calls, and no database writes. Its state survives browser reload, but resets on process restart or Reset fixture. This is a UI review preview, not a live personal-account result.

Local-only preview helpers are `.local/ui-preview.config.ts` and `.local/clerk-preview.tsx` in the isolated UI worktree. Start with `node node_modules/vite/bin/vite.js --config .local/ui-preview.config.ts --port 5175`. These ignored helpers are excluded from production and must not be used as production authentication.

## Changes since screenshot 31

- Removed the visible “Your next steps” and “Your discoveries” heading layers while retaining accessible headings. Category and discovery status share one quiet line.
- Replaced the competing side-by-side result blocks with one primary discovery and a compact secondary policy comparison. The C20 reason and next action have distinct positions; action emphasis comes from typography and an accent rule.
- Moved employment refresh to the employment section; the results have one quiet refresh control. History and research controls remain below outcomes.
- Shortened evidence disclosure labels and placed them together. Qualification, missing evidence, demo status, effective date and policy uncertainty remain visible beside their claims.
- Retained the green/serif identity and designed light/dark surfaces, including expanded sources and notifications. No new design library, avatar, branding exploration or decorative animation.

## Research acceptance comparison

| Recovered requirement | Current implementation and evidence |
| --- | --- |
| Purposeful grouping without a nested-card dashboard | Main results use whitespace and dividers; the next action has a subtle accent rule. Input/review and notification boundaries remain clear. Desktop screenshots 40–41. |
| One dominant discovery, reason, next action | C20 leads with its employer-specific reason and action. EE leads with actual calculated 528 → 568 / +40 in the fixture, not a hardcoded finding. Screenshots 38–41. |
| Both themes, including expanded states | Same populated state checked in light/dark. Sources, version metadata and notification surfaces remain legible. Screenshots 42–43. Draft values survived theme switching. |
| Human outcome-led copy | Removed repeated headings and receipt jargon from primary views. Exact profile data, hashes and calculation internals remain inspectable. |
| Material qualifications and sources | Potential eligibility, demo, projected/effective date, outstanding evidence and unresolved cap remain adjacent. Historical/uncertain results do not appear as current conclusions. |
| Desktop/mobile interaction evidence | IAB checks at desktop and 416/316 CSS-pixel widths; no horizontal overflow. Keyboard disclosure activation and notification Escape/focus restoration verified. |

Sources applied: the three May 10 files in `C:/Users/aakas/Downloads/Codex/Maple Landing Page/` (`yc-design-review-feedback.md`, `yc-framer-conversion-review-feedback.md`, `maple-landing-page-design-plan.md`), their relevant screenshot evidence, the supplied Library brief and parent-recovered chat decisions. Landing-page positioning was not transplanted into this immigration product. The canceled Oct 20 prototype was not treated as an approved destination. Its protected sign-in was not retried.

## Personal Guide integration

Uses the committed `/api/guide/*` contract and existing confirmed employment. Supplemental intake starts unknown; personal CRS evidence does not use fictional defaults. Employment dates remain canonical. Exact assembled information is shown before confirmation, and stale inputs withhold current conclusions.

Personal and demo save controls now share a check-only recovery state. An uncertain save exposes `POST /proposals/:id/reconcile` with `{}`; it does not resend facts. Only a refreshed backend proposal restored to pending enables confirmation again. Browser fixtures verified both uncertain-save readback across reload and the proved-unsent retry of the same proposal. Personal source failures release the request hold only with explicit `guideRequestState: not_started`.

NativeMemoryPanel honors backend `syntheticOnly`; missing status remains fail-closed. Its assessment-hold coordination and AssessmentPanel behavior are preserved. No server or shared contract was edited in the UI commits.

## Verification

Final `npm run check`: TypeScript, **643 tests in 38 files**, production build passed. `git diff --check` passed. Existing bundle-size warning remains: about 550 kB minified / 157 kB gzip. No dependency change.

IAB verification used only isolated fixtures: personal unknown intake; confirmation/save/reload; retained drafts across themes; explicit safe retry; uncertain save held across reload and recovered by readback; uncertain research held; stale personal results withheld; demo confirmation/reload invalidating prior results; source links/version details; full score calculation; mobile layout; keyboard disclosures; notifications and focus restoration. Earlier checks covered empty, missing-information, unsupported C20, processing, source failure and native-memory holds. No live provider requests were made.

Live authenticated personal save/readback and provider execution remain an integration check for the parent's configured combined application. Production policy seeding/configuration remains backend-owned. This handoff does not claim production deployment or live end-to-end verification.

## Screenshots

Saved locally, inspected, uploaded successfully to Library; version metadata was written back to each local file. Local folder: `C:/Users/aakas/AppData/Local/Temp/maple-ui-audit-20261025`.

- [Desktop dark](https://chatgpt.com/api/library/files/libfile_5ccfc172d4588191a163f789c9160467/download)
- [Desktop light](https://chatgpt.com/api/library/files/libfile_e926f938fc0881918b140a31ca993276/download)
- [Mobile C20](https://chatgpt.com/api/library/files/libfile_eac8730997bc8191a4a284c1f02f0744/download)
- [Mobile Express Entry](https://chatgpt.com/api/library/files/libfile_c01e8fa9c1708191b10286b1ce2affe4/download)
- [Expanded light](https://chatgpt.com/api/library/files/libfile_d2538853ee988191a264f48cac0ac934/download)
- [Expanded dark](https://chatgpt.com/api/library/files/libfile_aeb9e70fb74c8191bbbc2412ee056db4/download)

Owned frontend files: `main.tsx`, `styles.css`, `DemoJourneyPanel.tsx/.css`, `CrsBreakdown.tsx`, `CrsEvidenceEditor.tsx`, `journey-presentation.ts`, `NotificationCenter.tsx`, `PersonalGuidePanel.tsx`, `GuideSaveActions.tsx`, `NativeMemoryPanel.tsx`, `request.ts`. Regression coverage: `tests/ui-presentation.test.tsx`, `tests/personal-guide-ui.test.tsx`.
