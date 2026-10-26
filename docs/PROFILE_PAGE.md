# Profile page and history

The dashboard's **Review your profile** link opens `#profile`. Employment, education,
language tests, personal details and assessment evidence each have a direct edit route:
`#profile/employment`, `#profile/education`, `#profile/languages`, `#profile/status`
and `#profile/assessment`. Hash routes work with the existing static deployment;
no server rewrite or new identity store is required.

## Storage and review

- Employment continues to use the existing employment proposal, confirmation and
  reconciliation routes. Only one canonical employment record is supported.
- Education and repeated language-test records live in optional `intake.history`
  in the existing personal Guide `assessment_inputs` envelope. The owner, purpose,
  receipt chain and employment-revision checks are unchanged. No migration or
  backfill is required. Old receipts retain absent history and their original hash.
- `history.version` is `1`. Education records contain a stable UUID, institution,
  program, optional credential name, nullable exact dates and optional notes.
  Language-test records contain a stable UUID, language, the existing
  `LanguageEvidence` fields and optional notes. Arrays are limited to 20 entries
  each, with a combined 16 KB history limit inside the existing request limit.
- History edits use `POST /api/guide/proposals`, then explicit confirm or reject.
  An uncertain save keeps the same check-only reconciliation path. No automatic
  write retry or research call is introduced.
- History names and dates do not infer an ECA, education category or score. A test
  stays in history unless the user explicitly chooses **Use as current evidence**;
  that updates an unsaved assessment draft and clears its overall review flag.
  Unknown component scores stay null. Scores are CLB/NCLC benchmarks, not raw
  IELTS/TEF/PTE scores or an average.

## Navigation and drafts

The existing employment and Guide controllers stay mounted while sections change,
so navigation does not discard their drafts or ongoing-operation holds. Browser
close/reload warns when a draft differs from its last loaded or confirmed value.
Drafts are kept in memory, not silently written to local storage or AM. Section
navigation focuses the heading; prerequisite links open and focus the employment
editor. The global navigation returns to discoveries and requirement checks.

Education, language and personal-detail drafts can be prepared before employment
is complete. Review/save stays disabled until confirmed employment is available,
with the setup action beside it. The overview explicitly marks and displays
unsaved drafts so returning from an editor does not appear to lose an edit.
One centered profile surface, divided sections and an outside-edge backdrop keep
the content grounded without adding a separate card around every record.

The profile overview does not show family information. Existing family inputs
remain in assessment evidence because removing them would change scoring.

## Limits and recording integration

This is saved education and language-test history plus the existing employment
record, not a claim to store an entire immigration case file. Repeated employment,
travel/address history, permit documents and raw test-score conversion remain
unsupported. Unknown exact dates must stay null; month-only knowledge belongs in
notes until date precision is supported.

Private recording adapters must supply history in both the Guide `intake` and
assembled `profile` readbacks, while retaining their existing private state and
staged scenario separately. Do not add personal prefills to public source or use
fictional defaults for real profiles. Main now wraps `DashboardOverview` in a
hidden-on-profile container and passes `profileSection`/`onProfileReadback` into
`GuideWorkspace`; adapters using literal JSX transforms must account for this.

## Verification

Tests cover optional-history compatibility, confirm-before-write, saved reload,
stale-employment rejection, unverified scores and unload protection. The preview
uses synthetic fixtures and makes no provider calls. Browser visual and keyboard
verification must still be completed on desktop and mobile in both themes; the
Codex IAB transport was unavailable during implementation. Passing tests does not
establish visual acceptance.
