---
name: Memoato
colors:
  paper: "#f4f0e7"
  paper-deep: "#e9e2d5"
  ink: "#1d201b"
  soft-ink: "#5f6259"
  sage: "#87937b"
  forest: "#26372f"
  forest-text: "#dce0d7"
  forest-muted: "#c8cec3"
  rust: "#b75e3b"
  focus: "#7e442d"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(3rem, 6.7vw, 5.75rem)"
    fontWeight: 400
    lineHeight: 1.03
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
---

## Overview

This refinement extends Memoato's existing cream, ink, sage and rust identity.
Newsreader carries the headings and DM Sans the explanations and controls. The
first screen gives personal memory and AI context equal prominence, as approved
by Hrvoje on 16 October 2026.

## Colors

Cream remains the canvas; ink and muted ink carry text. Forest gives the Context
section a distinct surface within the same identity. Its text uses light colors
with sufficient contrast. Color does not replace an availability label.

## Typography

Headings stay in Newsreader. The first-screen heading uses two short lines with
an explicit role for each use case. Body text and action labels stay in DM Sans.
Mobile headings scale down to leave room for the actual entry points.

## Layout

The landing container is at most 1180px. A desktop introduction pairs the title
with a short explanation, followed by two equally sized open entry sections.
Thin horizontal rules separate these sections without enclosing them in cards.
Both desktop actions are visible at 1280×720. Mobile stacks the two paths and
keeps the same title, body and action order.

Two open example sections follow the introduction, personal first on cream and
project context on forest. Each pairs an explanation with a three-step evidence
flow. Functional rules separate capture/source, human review and recall/retrieval;
they do not enclose the example in decorative cards. Below 880px the explanation
sits above the flow; below 760px stage labels sit above their content.

## Elevation & Depth

The new hero is flat and typographic. The mobile navigation panel has a
restrained shadow to show that it overlays page content. It is a functional
disclosure, not an application-style card.

## Shapes

Keep the existing rounded primary actions. Use ordinary rules and spacing to
organize content, and 44px or larger targets for shared header controls.

## Components

The shared header exposes Personal and AI context links on desktop and a native
`details` navigation disclosure below 840px. Its links remain available without
JavaScript; Escape, outside click, focus departure and desktop resize enhance
closing behavior when JavaScript is present. A skip link targets the main
content.

The Personal action opens the existing app. The Context action leads to a pilot
explanation and a contact link. It does not imply unrestricted team sign-up.
Availability is stated next to each entry action.

The examples are explicitly fictional, static explanatory content. The personal
example shows a place clarification while preserving the original note. The
project example shows a human-accepted claim, a source version, freshness and
scope. Source links lead back to the matching example excerpt on the page. They
do not imply access to a real user's note, GitHub project or live AI response.

The homepage ends with an open privacy explanation and a compact directory of
starting paths. Cloud memory, encryption of selected category fields and local
logging have explicit boundaries. Availability labels distinguish the web app
and MCP connection from the single-owner Context pilot. The directory uses
horizontal rows on desktop and stacks each path on mobile, without enclosing
cards or an oversized closing slogan. Setup links lead to the existing Help
page; the privacy explainer keeps its existing URL and links to the unchanged
legal policy.

Informational pages use a compact, flat introduction and a centered reading
column (760px). The title is at most 4rem, followed by publication metadata when
relevant and a short deck. Content follows immediately; decorative grids,
circles, repeated margin branding and oversized hero spacing are removed. The
journal index expands to 1180px and lists dated entries in open horizontal rows,
stacking dates over titles on mobile. Original article text and URLs are kept.
Help exposes native topic anchors before its instructions. Header and footer
reuse the official Primer Octicons GitHub mark within its original viewBox.

## Do's and Don'ts

- Keep both audiences visible and give each a concrete next step.
- Preserve original sources and state the Context pilot's actual scope.
- Keep the established fonts and palette rather than copying another site's
  look.
- Use real evidence and clearly marked examples; do not invent product proof.
- Preserve authored articles and factual policy commitments.
