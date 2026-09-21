# Working on JevForSteve

- Read `docs/00-route-decision.md` and `docs/08-validation-status.md` before changing capability claims.
- Use the installed TypeSafe skill at `.agents/skills/typesafe-ai/SKILL.md` for Jev work. Check the live official documentation when the API contract changes; do not reinstall another copy unnecessarily.
- Keep geometry, timing, authorization and execution in deterministic local code. Jev only proposes a visible candidate and may abstain.
- Never silently rewrite a user's literal message or treat a model probability as user permission.
- Default to local video processing. Do not commit `.env`, credentials, real participant records, faces, raw videos or private text.
- Distinguish a synthetic test, browser demo, real device validation, and individual accessibility trial in every report.
- Keep the product surface a small expandable companion. Add a feature only with a complete user journey, including cancellation and recovery.
- Preserve the documented Windows/single-display boundary unless the new platform is actually verified.
- Run `npm run check` for changes to core behavior. Add focused tests for concrete interaction/authorization failure modes; do not expand tests for purely cosmetic edits.
- Update the relevant document when implementation and plan diverge. Do not lower calibration thresholds simply to make a demo pass.
