# Sign-in focus verification

Clerk's input focus shadow extended four pixels outside the field while Maple
also applied a three-pixel outline. The Clerk card clips horizontal overflow,
leaving thick top and bottom rails. This was reproduced on a real Clerk email
input, not an imitation form.

The sign-in appearance now uses one two-pixel inset outline and removes the
outside focus shadow. The doubled appearance selector is intentional: it must
win over Clerk's equally specific `data-variant` focus rule. The same appearance
applies to normal fields and one-time-code inputs. Global app controls and
account popovers are unchanged.

Verified locally on 2026-10-25 using the existing Clerk development instance in
a separate QA origin, without signing out the production owner or submitting
credentials:

- Real email field: before/after reproduction, light and dark themes, keyboard focus.
- Real password field in an unsubmitted Clerk sign-up form: light/dark, focus,
  validation text, and show/hide control. No account was created.
- Mobile viewport overrides of 320 and 390 pixels: complete focus boundary,
  no clipped side rails. Desktop viewport restored afterwards.
- Existing semantic contrast tests, full regression suite, type checking and
  production packaging.

The one-time-code appearance is covered by the same scoped rule, but a real
code-entry step was not exercised: no email/code send or authentication-setting
change was performed for visual QA. Retest that step during the next authorized
sign-in. The production deployment is unchanged by this pull request.
