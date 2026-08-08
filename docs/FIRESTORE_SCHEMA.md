# AthleSense — Firestore Schema

## Important status note
This document is intentionally conservative. Collection names observed in the current application are recorded below, but every field/type/document-ID rule should be verified against the complete current code and live Firestore data before a migration.

## Collections observed in the current application

### `team_condition_logs`
Primary conditioning log collection.

Conceptually contains athlete/date-based condition records with morning and evening information.

Known functional areas include:
- sleep duration
- sleep quality
- body weight
- heart rate
- fatigue
- stress
- muscle soreness/tightness by body part
- injury information
- IRS
- exercise duration
- RPE
- Training Load
- sprint records
- RSI
- F-v analysis
- evening soreness/injury
- menu
- positive points / challenges
- steps
- care/recovery
- next-day IRS

### `team_players`
Athlete roster / player information.

### `team_goals`
Athlete/team goals.

### `team_settings`
Team/application settings.

### `team_education`
Learning/education content.

### `team_broadcasts`
Coach/admin broadcasts and announcements.

### `team_kudos`
Kudos / peer or team recognition records.

## Authentication
The current athlete application uses Firebase Anonymous Authentication. Athlete selection is also represented in client-side state/local storage.

Do not interpret the athlete display name as a secure authorization boundary.

## Security Rules
The currently supplied Firestore Rules are:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This is the current service configuration, not a recommendation.

## Schema change policy
Any change to:
- collection names
- document IDs
- field names
- field types
- nesting
- date representation
- athlete identifiers

must be treated as a high-risk change.

Before changing schema:
1. identify all readers/writers;
2. identify historical data affected;
3. define migration/backward compatibility;
4. test athlete and admin paths;
5. verify existing analytics and exports.

## Not yet fully verified
The exact field-by-field schema, required/optional status, and document-ID convention should be extracted from the complete current `index.html` and `admin.html` before any schema migration.
