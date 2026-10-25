# Public Companion share artwork

`companion-social-card.svg` is the editable source for `web/public/maple-companion-social-v1.png` (1200 × 630, PNG). It uses the existing Maple leaf mark unchanged, with Companion-specific public copy. No profile, scores, immigration status or saved results are included.

Brand references inspected on 25 October 2026:

- Newsletter source: `web/src/app/layout.tsx`, `web/src/lib/seo.ts`, and `web/public/` in `Zetta-tech/maple-newsletter`.
- Live initial HTML: https://www.maplenewsletter.com/ and its published https://maplenewsletter.com/maple-social-card-v1.png.
- ICO and 16/32 px PNG files are byte-identical to the live newsletter versions. The 180 px Apple icon was copied from the live `/apple-touch-icon.png`, whose current opaque background differs from the older local copy.
- `maple-icon-512.png` reuses the newsletter's `android-chrome-512x512.png` as the artwork source. No new runtime image library or image service was added.

The new card was rasterized from the SVG using the already installed Sharp tool, embedding the referenced local PNG for that render. The PNG is committed; neither rendering nor authentication is needed when a crawler requests it.

The canonical origin `https://app.maplenewsletter.com/` returned HTTP 200 before editing. Its new `/maple-companion-social-v1.png` path is verified in the local production package and becomes public only after an approved deployment. Initial HTML includes all metadata without JavaScript. Existing PR15 HTML cache handling is unchanged. Social platforms may retain an older preview until their caches refresh; no external share test was sent.
