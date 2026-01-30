# Open-source preparation tasks

## Security + hygiene
- [ ] Audit git history for secrets (SMTP creds, tokens, auth secrets, DB URLs).
- [x] Ensure `.env*` files that contain secrets are not committed (`.gitignore` ignores `.env*`, examples are committed).
- [x] Add a “secrets rotation” checklist for production credentials (`docs/SECRETS_ROTATION.md`).
- [x] Review public endpoints for unintended data exposure (only `/api/totals` proxies aggregate counts).

## Docs
- [x] Add `CONTRIBUTING.md` (setup, PR expectations).
- [x] Add `SECURITY.md` (how to report vulnerabilities).
- [x] Add `LICENSE` (MIT).
- [x] Add a “self-hosting” guide (`docs/SELF_HOSTING.md`).
- [x] Add a “release checklist” doc (`docs/RELEASE_CHECKLIST.md`).
- [x] Add an architecture overview (`docs/ARCHITECTURE.md`).

## Product openness
- Decide where community feedback lives:
  - GitHub Discussions (recommended) + in-app link
  - or an in-app voting board (model + UI + admin moderation)
- Publish a lightweight public roadmap (keep `docs/ROADMAP.md` as source).

## Repo structure
- Keep `memoato` app and `memoato-site` landing in the same repo for now.
- Optional later split:
  - `memoato-app` (Wasp app + deploy scripts)
  - `memoato-site` (landing + blog + Pages function)
