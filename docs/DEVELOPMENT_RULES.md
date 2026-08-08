# AthleSense — AI Development Rules

## Priority
These rules apply whenever an AI agent edits the AthleSense repository.

### Rule 1 — Preserve existing behavior
Do not remove or silently alter existing user-visible functionality.

### Rule 2 — Inspect before editing
Before changing code:
1. locate the relevant implementation;
2. inspect related callers and data writers/readers;
3. inspect the relevant Firestore fields;
4. identify athlete/admin impact;
5. state the proposed change.

### Rule 3 — No speculative redesign
Do not migrate to React, TypeScript, a new backend, a new state-management system, or a new build system merely because it is considered cleaner.

### Rule 4 — Firebase is high risk
Do not change:
- collection names
- document IDs
- field names
- field types
- Authentication behavior
- Firestore Rules

without explicit authorization.

### Rule 5 — Preserve metric definitions
Do not modify the definitions/calculation logic of:
- IRS
- Training Load
- Total Load
- Training Monotony
- Training Strain
- ACWR
- RSI
- F-v analysis

without explicit approval.

### Rule 6 — Athlete/admin compatibility
Any backend or schema change must be checked against both `index.html` and `admin.html`.

### Rule 7 — PWA caution
Changes to `sw.js`, manifests, caching, notification behavior, or service-worker lifecycle require explicit review.

### Rule 8 — Minimal diff
Prefer the smallest safe change that satisfies the request.

### Rule 9 — No unrelated cleanup
Do not reformat, rename, reorganize, or refactor unrelated code in the same change.

### Rule 10 — Do not guess
If the specification or current code does not establish an answer, report the uncertainty and ask for clarification when it materially affects implementation.

### Rule 11 — Branch safety
Never assume `main` is safe for experimental work. Develop feature work on a separate branch.

### Rule 12 — Explain the change
Every implementation should report:
- files changed
- functions/areas changed
- behavior changed
- data/schema impact
- compatibility impact
- tests performed
- known limitations

## Recommended change protocol

```text
User request
  ↓
Repository inspection
  ↓
Specification check
  ↓
Impact analysis
  ↓
Implementation plan
  ↓
Code change
  ↓
Validation
  ↓
Diff review
  ↓
Commit / PR
```

## Definition of done
A change is not complete merely because the code compiles or renders.

At minimum:
- requested behavior works;
- existing relevant behavior still works;
- no unintended schema change occurred;
- athlete/admin compatibility is preserved;
- console/runtime errors are checked where practical;
- the final diff is reviewed.

## Security
Never expose or hard-code new secrets. Do not place private credentials, service-account keys, API secrets, or passwords in client-side files or documentation.

## Current repository
`chkr128-glitch/Kiuh-tfsprinters-mens-conditioning`
