# Memoato app design

The app extends the approved memoato.com identity. This is an operational
interface: capture, inspect, correct and recall should take precedence over
marketing copy. Use the existing logo; do not invent another brand.

## Shared language

DM Sans is the self-hosted working typeface. Newsreader belongs to the wordmark
and the short auth introduction; body copy, controls and records remain sans.
Light canvas #f4f0e7, ink #1d201b, forest #26372f and rust #b75e3b come from the
public site. Dark mode uses green charcoal #19201b, panel #212b23, warm light ink
#eee9df and a pale sage focus ring. No decorative grid or pure-black canvas.

Controls use clear text, 44px minimum touch targets for shared navigation,
visible focus and restrained hover states. Keep state and user/category colors
meaningful. Ordinary page content is not hidden behind disclosures.

## Shell and authentication — step 01

Desktop navigation shows Today, Memory, Recall, Views and Context. Mobile uses a
fixed bottom navigation with the same five destinations and icon + text labels,
never hiding Context. The top header keeps the full Memoato name, theme and
profile accessible. Respect install-banner height and device safe areas.
Navigation identifies the active route, including nested category/timeline routes.

A skip link leads to the page content. The logo is a link, not the page h1.
Auth uses an open two-column introduction/form layout on desktop and a form-first
single-column layout on mobile (the desktop introduction stays available to assistive technology), without an outer card or decorative left stripe.
The same layout serves login, signup, verification and reset flows. Labels use
sentence case; provider branding remains unchanged. Personal memory and AI
context appear together without implying unshipped team functionality.

## Workflow

Step 02 refines Today/capture/onboarding; step 03 Memory/Recall; step 04 Context;
step 05 Views/profile/privacy and final QA. Shared foundations must keep existing
screens usable while each surface is updated. No private test data is committed.

## Today and first visit — step 02

Today opens directly into a labeled writing area, with recent originals beside
it on desktop and below it on mobile. Only the editable input has a containing
surface. Recent notes use open rows, dates and explicit processing states;
loading and errors never masquerade as zero counts or an empty memory.

A successful raw write is separate from asynchronous processing and list refresh.
Keep failed drafts, prevent duplicate pending submissions and preserve typing
that happens during a write. A failed refresh must not ask for another save.
Cloud capture stays available even when category views fail. Structured and
local/encrypted capture retain their existing private flows.

The first visit offers personal notes and AI Context as equal, visible action
rows. Optional views are unselected native checkboxes below those paths, with no
mandatory tracker setup or disclosure. Completion has an in-memory fallback when
browser storage is unavailable. Keep source/claim capabilities truthful and
separate local/encrypted notes from Context's cloud sources.

## Memory and Recall — step 03

Memory uses open original-note rows with dates and source names. Extracted facts
sit beneath their original, with their status, provenance and visible Keep/Edit/
Dismiss actions. Imported entries are read-only. Inline editors retain failed
drafts and distinguish a confirmed mutation from a failed list refresh. Preserve
unchanged numeric/set data when editing labels or units. Clearing a value is an
explicit correction, not a silent reset to the old number. Original deletion
keeps its existing irreversible-action confirmation.

Filters are wrapping text controls, with real counts only after loading. Failures
must not appear as empty memory. Processing notes refresh until their status
settles. The existing feed returns the latest 30 matches; when capped, state the
limit and provide timeline and Recall links for older entries.

Recall starts with a labeled search and personal/work examples. Word matches
remain available if meaning search fails. AI answers are optional, identify the
searched question and link to numbered, visible sources. Changing a question,
editing a source or replacing evidence during refresh invalidates an earlier
answer and its pending request. No confidence is implied by decorative metrics.
Local/encrypted modes expose existing private views instead of enabling cloud
review/search inputs. Keep all existing backend/auth contracts unchanged.

## Context — step 04

Context uses wrapping workspace choices and three visible tool destinations:
Sources, Review and Build context. Keep source lists, claims and evidence in open
rows. Source setup uses an inline, labeled form with explicit repository/team
scope. Only Memoato administrators who also own/administer the workspace see
connection and sync actions; claim review follows workspace owner/admin rights.
Missing provider setup, pilot restrictions, failed imports and empty results
must be explicit. Do not imply an open team signup or automatic member grants.

Claims keep their source excerpt, link, version and freshness beside the review
actions. Context packets are snapshots of accepted, fresh, authorized claims,
not AI-generated answers. Show evidence, generation time, per-query changes and
retrieval identifiers. Copy includes the exact evidence versions and provenance;
expired output cannot be copied. Invalidate results and pending requests after
source refreshes, query edits or workspace changes. Lock overlapping actions and
workspace switching during a pending operation. Preserve failed drafts, and keep
a successful save visible even if a subsequent overview refresh fails.

No backend, membership, source-grant, credential or retrieval-policy changes are
part of this visual revamp. Use synthetic data for connected-source QA.
