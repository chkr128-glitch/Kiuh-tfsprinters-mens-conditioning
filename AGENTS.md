# AthleSense KIUH Edition — Codex Instructions

## Purpose
This repository contains the current AthleSense KIUH Edition conditioning-management web application for sprint athletes.

Before making changes, understand the existing application and preserve current production behavior.

## Required context
Before implementation, read these files:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/FIRESTORE_SCHEMA.md`
4. `docs/FEATURE_STATUS.md`
5. `docs/DEVELOPMENT_RULES.md`

The v4.1 functional specification is also authoritative for intended product behavior where it is available in the repository/project context.

## Repository structure

- `index.html` — athlete application
- `admin.html` — admin/coach application
- `manifest.json` — athlete PWA manifest
- `manifest-admin.json` — admin PWA manifest
- `sw.js` — Service Worker
- `docs/` — project and development context

The athlete and admin applications share backend data but are separate HTML applications. Changes affecting Firestore must therefore be checked against both applications.

## Mandatory workflow

For every non-trivial task:

1. Inspect the current implementation before editing.
2. Read the relevant documentation in `docs/`.
3. Identify all affected files, functions, data paths, and UI surfaces.
4. Check whether the change affects athlete and/or admin behavior.
5. Check whether it affects Firestore schema, Authentication, Security Rules, PWA behavior, or existing metric definitions.
6. State an implementation plan before making high-risk changes.
7. Make the smallest safe change that satisfies the request.
8. Do not modify unrelated code.
9. Run appropriate tests or validation available in the repository/environment.
10. Review the final diff for unintended changes.
11. Report changed files, behavior changes, data impact, tests, and known limitations.

## Hard constraints

### Do not change without explicit authorization
- Firestore collection names
- Firestore document IDs
- Existing field names or field types
- Firebase Authentication behavior
- Firestore Security Rules
- IRS calculation/definition
- Training Load calculation/definition
- Total Load calculation/definition
- Training Monotony calculation/definition
- Training Strain calculation/definition
- ACWR calculation/definition
- RSI calculation/definition
- F-v analysis calculation/definition
- athlete/admin data relationships

### No speculative redesign
Do not migrate the project to React, TypeScript, Next.js, a new build system, a new backend, or a new state-management architecture merely for code quality. Do not split the monolithic HTML applications into modules unless explicitly requested.

### No unrelated refactoring
Do not perform broad cleanup, formatting-only rewrites, renaming, or architectural refactors while implementing a feature unless they are necessary and explicitly approved.

### Do not guess
If the repository or specification does not establish a required behavior, do not invent one. Explain the uncertainty and ask for clarification when it materially affects the implementation.

## Firebase and data safety

Treat Firebase and Firestore as high-risk production dependencies.

Existing Firestore data uses established collection, document-ID, field-name, and field-type conventions. Preserve backward compatibility unless a migration is explicitly designed and approved.

The current Firestore Security Rules are a production configuration. Never weaken, broaden, or replace them as a shortcut for development.

Never add private credentials, service-account keys, passwords, or other secrets to client-side files or documentation.

## PWA safety

`sw.js`, both manifest files, caching behavior, notification behavior, and service-worker lifecycle are production behavior. Changes in these areas require explicit impact analysis and validation.

## Product terminology

The application intentionally labels its rule-based recommendation system as “AI advice”. Do not replace or criticize this terminology unless the requested task specifically concerns changing the recommendation architecture.

## Branch safety

Feature and bug-fix work must be performed on a dedicated branch. Do not treat `main` as an experimental workspace.

Recommended naming:

- `feature/<short-description>`
- `fix/<short-description>`
- `docs/<short-description>`

Do not merge or deploy to production without the user's approval.

## Implementation principles

Prefer:

- minimal diffs;
- existing conventions;
- backward compatibility;
- explicit validation;
- simple solutions appropriate to the current architecture;
- preserving the existing UI and behavior unless change is requested.

Avoid:

- unnecessary dependencies;
- large rewrites;
- schema migrations without a plan;
- silent behavior changes;
- assumptions based only on generic web-development best practices.

## Definition of done

A task is complete only when:

- the requested behavior is implemented;
- relevant existing behavior remains intact;
- relevant Firestore paths remain compatible;
- athlete/admin compatibility is checked where applicable;
- PWA behavior is checked when applicable;
- appropriate tests or runtime validation have been performed;
- the final diff has been reviewed;
- remaining limitations or unverified assumptions are explicitly reported.

## Reporting format

Finish implementation tasks with:

### Changed files
- list files

### What changed
- concise behavior summary

### Data / Firebase impact
- None, or explain exact impact

### Compatibility impact
- athlete/admin/PWA impact

### Validation
- tests and checks performed

### Known limitations
- unresolved issues or assumptions
