# AthleSense — Architecture

## High-level architecture

```text
Athlete
  -> index.html
  -> Firebase Authentication
  -> Cloud Firestore
  -> client-side state / calculations
  -> athlete UI

Coach/Admin
  -> admin.html
  -> Firebase Authentication
  -> Cloud Firestore
  -> client-side analytics / calculations
  -> admin UI

PWA
  -> manifest.json / manifest-admin.json
  -> sw.js
```

## Application structure

### Athlete
`index.html` is a self-contained application containing:
- HTML UI
- CSS
- JavaScript application state and behavior
- Firebase initialization
- Firestore access
- UI calculations
- weather integration
- charting
- confetti/PB presentation
- PWA registration-related behavior

### Admin
`admin.html` is a separate application for:
- team monitoring
- athlete detail analysis
- training-load analytics
- injury/condition monitoring
- sprint analysis
- goals/player management
- education management
- broadcasts
- Kudos
- data export

## Data flow

### Athlete write path
```text
User input
  -> client-side validation/calculation
  -> Firestore write
  -> Firestore snapshot/update
  -> local state
  -> UI
```

### Admin read/analysis path
```text
Firestore
  -> realtime listener
  -> admin state
  -> calculations
  -> charts/tables/modals
```

## Important calculations
The current system contains logic related to:
- IRS
- Training Load
- Total Load
- Training Monotony
- Training Strain
- ACWR
- RSI
- sprint/F-v related analysis

Do not alter the mathematical definition of an existing metric without explicit authorization and before/after validation.

## PWA
The repository contains:
- `manifest.json`
- `manifest-admin.json`
- `sw.js`

`sw.js` must be treated as production behavior. Changes to caching, service-worker lifecycle, or notifications require explicit review.

## External dependencies
The athlete application currently loads Firebase SDKs, Chart.js, and canvas-confetti through external CDN resources. Exact dependency versions and all admin-side dependencies should be verified before a major dependency change.

## Architecture constraints
- Do not introduce a framework migration merely for code cleanliness.
- Do not split the monolithic HTML files into modules unless explicitly requested.
- Do not change Firebase collection names or document/field conventions without a migration plan.
- Do not assume athlete/admin data are independent; they share backend data.
