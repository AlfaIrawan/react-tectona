# Brainstorm upload lifecycle regression checks

From the repository root, using its existing dependencies:

    node --test scripts/tests/brainstorm-upload-lifecycle.test.cjs

The test resolves sources relative to this repository and dependencies through Node's normal module resolution. It has no hardcoded machine path and does not fall back to another checkout. Dependencies used: TypeScript, React, React DOM, jsdom (already installed in the reviewed checkout).

Coverage: pure lifecycle state transitions; actual picker and send handlers extracted from the page with mocked decoder/network dependencies; real React StrictMode hook mount plus the actual extracted parent busy-reset effect; localized status labels; source wiring and syntactic parse/transpile checks. Same-job reset, session change, close and unmount are covered. The whole page is not mounted. Canvas decoding, browser visuals, real uploads, image interpretation and final-draft fidelity are not tested. Transpilation is not semantic typechecking.

This standalone Node test is not added to npm test or CI by this patch. No browser/server/model/DB is contacted. The test generates no repository artifacts. The extraction intentionally fails when the named page-handler boundaries are removed, so refactors require updating this harness rather than silently bypassing tests.

The selected-image policy is explicit invalidation on a new selection. Unsupported/unreadable/oversized input leaves no attachment; pending decoding disables submit. A same-session failed send restores the exact captured attachment. A session change discards stale completions.
