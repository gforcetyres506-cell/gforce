# Dependency review

Fresh npm advisory results, 12 October 2026. Counts describe npm's dependency findings, including parent-package propagation; they are not counts of independently exploitable application flaws.

| Scope | Before | After |
| --- | --- | --- |
| Production/runtime | 1 critical, 2 high, 1 moderate (4 total) | 0 findings |
| Entire install | 2 critical, 14 high, 3 moderate (19 total) | 0 critical, 7 high, 2 moderate (9 total) |

Next.js and matching ESLint configuration were patched from 15.5.23 to **15.5.27**, without a major upgrade. Sharp is explicitly declared at `^0.35.5` because the social-image route imports it. Compatible transitive patches cover sharp, source-map-js, qs, proxy-addr, undici, js-yaml and the installed brace-expansion major lines. The lockfile records exact resolved versions. No `npm audit fix --force` was used.

Runtime advisories covered unauthenticated Next.js code-execution/image-processing issues, cache poisoning, vulnerable native image dependencies and parser resource exhaustion. See the machine-readable before/after evidence for advisory URLs and exact ranges. Clearing the installed branch audit does not prove the currently hosted deployment has these fixes.

## Unresolved development-only findings

| Package | Severity | Reason retained |
| --- | --- | --- |
| braces | High | Installed 3.0.3 has no fixed compatible release reported by npm; used by build/lint glob parsing |
| chokidar | High | Propagates braces through Tailwind's build watcher |
| micromatch | High | Propagates braces through build/lint glob parsing |
| fast-glob | High | Propagates micromatch through build/lint glob parsing |
| @next/eslint-plugin-next | High | Propagates fast-glob; npm proposes an incompatible downgrade to 14.2.35 |
| eslint-config-next | High | Same propagation; keep aligned with patched Next 15 rather than blindly downgrade |
| tailwindcss | High | Npm proposes a Tailwind 4 major migration, which requires independent CSS/visual acceptance |
| postcss-selector-parser | Moderate | Npm's fixed version crosses the installed parser major; avoid an unverified major override |
| postcss-nested | Moderate | Propagates selector parser into the Tailwind build toolchain |

These packages remain in development dependencies and are absent from `npm audit --omit=dev` findings. That scope distinction is not a waiver. Treat contributor-controlled source/glob/build inputs as trusted only after review; do not expose lint/watch/build commands as public request handlers. A future Tailwind/tooling migration needs its own compatibility and visual checks. **Full audit: FAIL / unresolved. Runtime audit: PASS.**

Re-run both audits after dependency changes and immediately before an accepted release. Npm advisory status can change. No package score proves authorization, privacy, provider delivery or hosted security.
