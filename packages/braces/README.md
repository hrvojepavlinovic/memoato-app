# Local depth-bounded braces fork

This private, vendored package is based on **braces 3.0.3**, distributed under
the included upstream MIT license. It is not an upstream release and is not
published to npm. The root `overrides.braces` installs it for the existing
Tailwind/chokidar/micromatch dependency graph.

Source: <https://registry.npmjs.org/braces/-/braces-3.0.3.tgz>

Upstream archive integrity: `sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==`

Advisory: [GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
At the time of this change, no upstream patched release exists. The maintainer
disputes the advisory for trusted glob inputs; Memoato still bounds the reported
recursive paths instead of ignoring the finding or changing audit thresholds.

## Changes from upstream

- Add `lib/depth.js` with a hard nesting limit of 100 containers.
- Check the parser stack before adding brace or parenthesis containers, before
  any recursive cleanup or walker runs. Callers cannot raise this limit.
- Validate child-tree depth iteratively before compile, expand and stringify,
  including direct AST/module calls. A 10,000-node budget also bounds cyclic or
  unusually large supplied trees. Original `parent`/`prev` links are not followed.
- Rename the private package to `@memoato/braces@3.0.3-memoato.1` so the local
  patched implementation is distinguishable from the affected upstream release.
  All other upstream runtime files and the upstream license are retained.

Rejected inputs raise a controlled `SyntaxError`, analogous to the existing
upstream character limit. Callers handling untrusted patterns must handle errors.
This patch addresses recursive AST depth; it does not claim arbitrary glob
expressions or unlimited expansion are safe.

## Verification and maintenance

`src/security/braces.test.ts` reproduces the reported 4,000-level input through
all public paths, parentheses, raw ASTs and cycles. It checks normal glob/range
behavior and that transitive consumers resolve to this implementation. Full app
tests and server/web builds cover the Tailwind and Wasp integration.

`npm audit` still runs without exemptions. A renamed local fork is not covered
by registry advisories for `braces`, so future upstream advisories must also be
reviewed against this source. Replace the fork with an upstream fixed release
when available, retaining the depth regression tests. Do not simply remove the
guard or change the local version to make an audit pass.
