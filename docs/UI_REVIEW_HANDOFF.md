# Review handoff and evidence disclosure

This follow-up changes presentation and navigation in the existing single-owner flow. It does not change scoring, save approval, ownership, request reconciliation, or the native-memory readback guard.

- A stale Guide result offers **Review Guide details**, opening the existing editor and focusing its heading without resetting unsaved input.
- Empty requirement checks link directly to employment or the CEC work-evidence disclosure. Unknown evidence remains unknown; saving inputs does not activate a policy.
- Remembered information explains the separate assessment review before sending. An unresolved update retains its send/assessment hold and offers **Check update status**, with one primary status explanation.
- The score disclosure opens in one action. It starts with the changing work/offer comparison and replacement equation, followed by unchanged factors. All source URLs remain visible; exact hashes and timestamps remain in one provenance disclosure.

## Verification

The follow-up passed 677 tests on merged PR10 (`0a1c314e`), typecheck, frontend/server build, packaging, and repository hygiene checks. Browser verification used actual React components and calculator-generated fictional data in an ignored offline fixture, not hosted API or model responses.

Codex IAB verified keyboard activation, heading focus, preserved unsaved input after closing/reopening the Guide editor, opening the nested employment/evidence sections, single-action score disclosure, and an immediate assessment/composer hold during a delayed local response. Refreshing an unresolved fixture status retained the hold without a duplicate warning or another send. Light/dark screenshots at narrow and desktop sizes showed no horizontal overflow in the observed viewport. Viewport requests were scaled by the browser; observed document client widths were 416 and 1405 pixels, not claims of exact device-width testing.

Ignored local evidence is in `.local/ui-review-handoff/`: fixture sources, calculator output, and `mobile-light.jpg`, `mobile-dark.jpg`, `desktop-score.jpg`, and `desktop-review.jpg`. The fixture explicitly states that it is offline. No hosted records, AM messages, credentials, or production runtime were changed by these checks.

## Release boundary

The native correction/readback discrepancy remains unresolved. This UI does not turn an unverified conversation update into a confirmed fact. Hosted validation and deployment are separate from this draft PR; the existing recording app remains unchanged.
