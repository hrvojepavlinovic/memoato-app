# Memoato public website

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Explain Memoato and help visitors choose between personal memory and useful
context for AI-assisted project work, within one product.

Hrvoje confirmed on 16 October 2026 that personal memory and AI/team context
should have equal prominence on memoato.com. This supersedes the earlier
personal-first marketing priority for this website. It does not expand the
implemented capabilities of the application.

## Users

- People who want to capture everyday context in their own words and recall it
  later.
- People evaluating evidence-backed project context for AI tools and teams.

## Capabilities and Constraints

- memoato.com is the Astro public website in `apps/memoato-site`.
- app.memoato.com is the unified application; api.memoato.com exposes API/MCP.
- Personal memory saves the raw entry before interpretation, keeps derived facts
  reviewable, and returns evidence during recall. MCP supports logging, search,
  metric summaries and scoped context retrieval.
- Repository code contains a Context pilot: explicit GitHub/Linear source
  scopes, immutable source versions, human claim review and permission/freshness
  checks before context packet ranking. The pilot review restricts workspaces to
  a single owner and upstream access to read-only. Broad team onboarding,
  invites, and multi-user availability must not be implied without further
  verification.
- Code presence is evidence of implementation, not proof of production setup or
  public availability. Verify entry paths and operational constraints before
  publishing claims or calls to action.
- This revamp covers the public website. Changes to application behavior,
  authorization, storage modes, integrations or pricing are outside this scope.
- Preserve original blog articles and factual policy commitments. Explain real
  privacy trade-offs; do not invent testimonials, usage numbers or guarantees.

## Operating Context

Follow the established workflow from the prior website revamps: Todoist tasks in
order, one implementation at a time, verification and deployment before user QA,
then wait for approval before closing the task and moving on.

## Evidence on Hand

- Public pages and existing Newsreader/DM Sans, cream, sage and rust identity.
- `src/memory/mcp.ts`, `src/memory/mcpCapabilities.ts` and
  `docs/MEMOATO_2_PRODUCT_ARCHITECTURE.md` describe personal memory and MCP.
- `src/context/ContextPage.tsx`, `src/context/packet.ts` and
  `docs/TRUSTWORTHY_CONTEXT_SCHEMA_PLAN.md` describe the Context pilot.
- Existing product vision and some handover prose predate the implemented pilot;
  compare these with code rather than treating roadmap wording as current
  status.

## Product Principles

- Give both uses equal visibility and a concrete starting point.
- Show capture, evidence, review and recall through realistic examples.
- Keep original sources distinct from interpretations and assumptions.
- State current availability clearly, especially for the Context pilot.
- Preserve product identity while improving mobile usability and clarity.
