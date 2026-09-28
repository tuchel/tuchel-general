# Reitweg 25 design studio

Private design exploration portal. Five initial projects: east glazing, kitchen/wintergarten, front boundary, east dining terrace and courtyard patio. Budget and timing are deliberately deferred at the owner’s request.

## Source hierarchy
- Original exposé: public/assets/expose.pdf. PDF pages 17–21 contain the site, grounds and all three floor plans. Ground floor is PDF page 19 (printed 36–37). Kitchen extension description is PDF page 7 (printed 12–13).
- Original photo filenames are retained in lib/photos.json. Optimized browsing copies are in public/assets. 201 photographs are catalogued. New tagged photo descriptions are in lib/new-photo-catalog.json.
- AI concepts are illustrations, not measured or approved designs. Exact prompts and source images are recorded in public/assets/prompts-and-sources.json.
- The exposé reports a roughly 40 m² extension with permission valid until 20 August 2029. Actual approval/stamped plans remain outstanding. Do not treat the brochure’s non-binding proposal as stamped drawings.

## Kitchen geometry correction — 14 September 2026 (current priority)

The user reports that the kitchen renders still misrepresent the permitted footprint. Establish the space before producing any more layouts or AI variations. The prior north-dining / west-preparation programme below is superseded as a working assumption; it was assigned before checking fit. The hand-drawn wintergarten schematic is not traced or dimensionally validated and must not guide subsequent images.

Review artifact: `output/pdf/kitchen-footprint-review.pdf`. Page 1 annotates the source inset without changing its proportions; page 2 preserves the complete original ground-floor spread. A is the long west wing, B the shallower north return, C the existing kitchen and D the east-side cooker wall. The exposé places its long dining table in A. The green trace follows the drawn glazed edge, not the dashed illustration box, and is not a verified approval boundary. The owner confirmed the annotated A+B footprint and requested deletion of the old kitchen concepts. The portal now uses the source overlay and two fresh vector furniture studies with shared geometry. All three previous kitchen images and active prompt records were removed; saved favorites/render requests tied to their IDs are removed by migration 0001. After resolving the outline, establish a consistent geometric model and camera orientation before testing furniture or generating visual treatments. Exact dimensions and roof/ceiling geometry remain unconfirmed.

## Continuing with Codex
Use the page’s WebMCP tools to read the studio, open renovations, and save ideas. Render briefs are saved in the private D1 database, then explicitly sent to Codex by the user. No background image generator or automatic image service is claimed. Create/edit images using imagegen with the referenced originals and plans. For new concepts, save images in public/assets, add source/provenance and update lib/design-data.ts; build and publish the same Site. Uploaded concepts can also be added from a renovation’s reference-photo panel.

The authenticated API supports GET/POST/PATCH/DELETE /api/entries, POST /api/uploads, and owner-scoped GET /api/files/:id. Production access is private to the owner; authentication is handled by Sites. Do not commit credentials. D1 migrations are in drizzle; do not rewrite applied migrations.

## Verification performed
Production build and TypeScript checking. API checks for create/read/update, stale-version conflict, invalid kind, deletion and anonymous rejection. WebMCP read/open/save journeys checked with a valid and an invalid project. Compare view and project navigation visually checked in the local browser. Local development uses the starter’s local sign-in and local DB; local notes are not automatically copied to production.


## Design revision — 14 September 2026

User feedback sets the current design direction:
- East: keep the generous glazing and add looking-out studies for family room, ground-floor bedroom and bathroom. Existing fireplace stays; glazing wraps to it.
- Kitchen: occupy the complete approximately 40 m² north-and-west L shown in the original inset. Test north dining / west preparation and storage within that envelope. This furniture programme differs from the exposé’s west-table proposal. The inset remains a source, not a stamped approval.
- Courtyard: compare whole-L layouts A (fireplace lounge / perpendicular dining), B (fireplace dining / pool-facing lounge), C (several small seating groups / reading / daybed, with formal dining on east terrace). Keep the existing roof, posts, fireplace and tree.
- Front: substantially taller boundary entirely clad in narrow horizontal timber siding strips matching the house, including gates. Supersedes the earlier mineral-wall direction. Keep original asset available for provenance but remove it from active concepts.

Functional diagrams in `components/studio/spatial-study.tsx` communicate unmeasured programme and adjacency alongside the original plan. They are not traced dimensions. Spatial wintergarten views use side-by-side reference comparison because their inferred viewpoints differ from the source photo. Variation requests include the selected concept’s title, description and asset so the selected layout is preserved in the next brief.


## Mobile and public viewing — 14 September 2026

The user requested link sharing with anyone they send it to. The public surface shows bundled renovation studies, photos, source documents and starting design briefs without sign-in. D1 notes, edited briefs, shortlist, custom projects and uploaded private files remain owner-only. Server authorization checks the dispatcher-verified owner email against server-only `STUDIO_OWNER_EMAIL`, configured from the Site’s owner access record; missing configuration fails closed. All entry and upload/file routes use this check. Visitors do not load saved entries or see editing controls. The owner signs in through the existing dispatch-owned flow.

Mobile changes: sticky navigation, drawer close control and spacing, 44px primary controls, two-column section tabs, contained scrollable diagrams, stacked spatial comparisons, responsive photos, readable forms, and viewport-bounded dialogs. Temporary phone viewport overrides are reset after QA.


## Whole A+B+C concepts — 14 September 2026

The owner requested fuller use of the combined volume. Three concepts: social kitchen (C cooking, A dining, B lounge), garden kitchen (A cooking including relocated range, C dining, B breakfast), family room (A lounge, northwest A/B dining, C redesigned kitchen). Proposed openings through former north/west boundaries are dashed on plans. Retained piers and illustrative height are assumptions, not structural design. `scripts/build-kitchen-volume.mjs` builds plans and deterministic cutaways from one envelope. Records link Plan and Spatial model plus AI illustration. Prompts, paths and refinement provenance: `public/assets/kitchen-abc-render-prompts.json`. Earlier v3 furniture options remain; deleted incorrect v1/v2 renders remain deleted.
