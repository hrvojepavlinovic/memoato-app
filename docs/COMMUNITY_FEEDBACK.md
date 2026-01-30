# Community feedback + voting (proposal)

## Goal
Make memoato “shaped by community” with a simple loop:

1) Submit an idea
2) Upvote ideas
3) Ship in small increments
4) Close the loop publicly (changelog + blog)

## Minimal v1 (recommended)
- Use GitHub Discussions (Category: “Ideas”) and GitHub Issues for tracking.
- Add links in:
  - App: footer/menu “Feedback”
  - Landing: `/help` and `/open-source`
- Moderation: admin-only labeling (“planned”, “in progress”, “shipped”).

## In-app v2 (when ready)
Add these DB entities:
- `FeatureIdea` (title, body, status, createdByUserId, createdAt)
- `FeatureVote` (ideaId, userId, createdAt) with unique (ideaId, userId)

UI:
- Public ideas list + search
- Upvote toggle (requires login)
- Admin controls (status + pin + merge duplicates)

## Anti-abuse
- Require verified email for posting new ideas.
- Rate-limit submissions and votes per user/IP.

