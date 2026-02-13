# Ideas & suggestions (uncommitted)

These are product ideas that came from users or internal discussion.
They are not promises and can be revisited later.

## Time precision tracking + goal pacing (2026-02-12)

Context:

- User: Luv Sahu (`@shipluv`)
- Goal: high precision time allocation tied to priorities

User intent:

- Track where time goes with very high precision.
- Break down a longer goal into actionable daily steps.
- Know daily if they are on track based on how time is spent.

Clarification from user (key points):

- They want hierarchy, not just entries.
- Goal → project → task
- Each time block is tied to that structure (example: deep work → Product → Growth).
- They want rollups across levels and daily intention vs actual comparison.
- They want both pre plan and ad hoc logging.
- They want to measure drift from an ideal day and reconcile goals with time distribution.

Possible shape (Memoato style):

- A time-tracking mode where you can quickly switch the active category and the app tallies minutes.
- Time budgets per day or week per category or project.
- A simple on-track signal that compares planned time vs actual time, plus a pace marker throughout the day.

PM read: current state vs desired

Current Memoato is optimized for:

- Flat categories with minimal friction logging
- Simple progress visibility (goals, pace marker, timeline)
- Lightweight suggestions (Next up)

What Luv is asking for is closer to:

- A structured planning tool with a hierarchy model
- Time block tracking as the primary data type
- Rollups, drift detection, and plan vs actual reporting

That is a different center of gravity than habit tracking. It is more like a lightweight personal ERP for time and priorities.

Recommended compromise (keep Memoato philosophy intact)

If we ever support this, it should be opt in and layered:

1. Add an optional second dimension: Project
   - Keep categories as they are
   - Allow linking time blocks to a project name (flat list, not full nesting)
   - Show rollups by category and by project

2. Add daily intention (simple budgets, not a scheduler)
   - User sets time budgets per day (or per weekday template)
   - Compare actual minutes vs budget with the same pace marker approach

3. Add tasks only as lightweight labels
   - Avoid turning Memoato into a project management tool
   - Treat tasks as optional labels for later search and rollups

Why this compromise:

- Hierarchy is expensive and easy to bloat
- Planning UIs are high maintenance and opinionated
- The core promise is low friction and clarity, not maximum expressiveness

How this changes vision and philosophy (if adopted)

- Memoato stays a minimal tracker by default.
- "Structure mode" becomes a separate layer for a specific persona:
  people who want intention vs reality for time, not only habit logging.
- The north star stays the same:
  reduce decision fatigue and keep the feedback loop visible.

Open questions:

- Manual entry (e.g. `+15 min`) vs a running timer with one-tap switching.
- Single dimension (category only) vs category + project.
- Is “on track” daily only, or also weekly/monthly pacing.
- Any need for idle detection or automatic capture.
