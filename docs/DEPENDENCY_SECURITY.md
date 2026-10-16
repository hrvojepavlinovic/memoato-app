# Dependency security maintenance

The public site, mobile wrapper and Wasp application have separate lockfiles.
Security CI audits all three. Application CI audits development dependencies as
well as runtime dependencies; there are no advisory exclusions or reduced
severity thresholds.

## Reviewed updates (2026-10-16)

- Public site: patched releases within the existing Astro 7 range.
- Mobile: patched Capacitor 8 releases; no native project or signing changes.
- Application: refresh compatible transitive releases and the existing overrides
  for Axios, Morgan, PostCSS, qs and Vitest. Keep `postcss-selector-parser` on its
  patched 7.x API while retaining Tailwind 3. Production CSS compilation verifies
  this override against the current Tailwind configuration.
- Nodemailer 10.1.2 replaces the affected 9.x releases. Node 24 satisfies its
  Node 20 minimum. Message-composition tests use JSON transport and deliver no
  email. The generated server/SDK manifests are patched before the clean install.
- React Router DOM 7.18.4 replaces the affected 6.x releases. Keep the published
  compatibility import path, updating the root, generated SDK and web manifests
  together. Tests cover the app's nested/data-router navigation, parameters,
  redirects, callback query strings and fallback. The app uses absolute routes;
  the only splat route is the not-found fallback.
- `braces` has no upstream patched release for GHSA-vfj7-8cjw-p6xm. A private
  [vendored depth-bounded fork](../packages/braces/README.md) replaces it throughout
  the graph. This is a source mitigation, not an audit exemption. Review that
  README for its provenance, limitations and removal criteria; registry audit
  alone cannot establish the safety of a renamed local fork.

## Regeneration and validation

Wasp 0.20.2 requires `react-router-dom: ^6.26.2` during generation and emits old
dependency ranges. `scripts/compile_wasp.mjs` pins that compiler, temporarily
provides its required router declaration, and restores the reviewed root
manifest/lock even on failure. CI and `scripts/build_prod_artifacts.sh` then run
`scripts/patch_wasp_dependency_versions.mjs` and `npm ci --include=dev` to replace
the compiler-time tree with the audited tree before bundling. Never publish the
intermediate compiler tree. Production runtime secrets remain unavailable until
all dependency installations finish, as in the existing build script. Keep these
manifests and the lockfile synchronized.

Server, web and SDK now use the same root workspace install in CI and production.
The previous production-only `npm --prefix ... install` calls created independent
trees that ignored root overrides and brought the affected `braces` package back.
They are removed; production also runs the full root audit before runtime secrets
are sourced. Do not add independent generated-project installs after this audit.

After changing dependency versions, validate a clean Wasp generation/install,
unfiltered `npm audit`, `npm test`, generated server TypeScript/bundle and the
authenticated web build. Also run each subproject's clean install, audit and
build where applicable. Review major-version release notes rather than running
`npm audit fix --force` indiscriminately.

Production deployment still uses the existing protected `main` branch and
GitHub Actions flow. Do not use a direct release upload to bypass failed checks.
