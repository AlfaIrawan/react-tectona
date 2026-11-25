# W02 Frontend Publication QA

- The Directory badge indicates active WAC membership, not full
  workspace access. Commit `9b8d8a4` made this distinction explicit.
  The corrected baseline test covers read-only membership, full
  membership, and isolation from a different subject, without changing
  application behavior.
- The baseline workspace ownership and grant suites passed 17 tests.
- The isolated publication candidate passed 511 tests across 37 suites.
  Four optional replay tests require external artifacts and were not run.
  All 19 attachment lifecycle tests passed.
- Scoped ESLint on 92 files passed with zero errors and 24 warnings.
  The official Node 22.13.1 / Vite 7.3.2 build passed with zero
  TypeScript diagnostics and zero circular chunk warnings. Existing
  bundle size and Browserslist age warnings remain.
- Local Chrome smoke covered the built app and separate browser
  fixtures for diagram recovery, Inbox, Workflow link consumption,
  Knowledge picker resets, and Chat completion. API responses and
  upload fixtures were synthetic; there was no live PDF or production
  verification in this publication gate.
