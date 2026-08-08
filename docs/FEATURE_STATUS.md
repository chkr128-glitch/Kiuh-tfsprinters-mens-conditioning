# AthleSense — Feature Status

## Baseline
Specification: **AthleSense 全機能一覧 v4.1**

Legend:
- ◎ implemented / confirmed
- ○ partially implemented or implementation differs from the specification
- × not implemented
- ? requires further verification

## Athlete application

| Feature | Status |
|---|---|
| Athlete login/selection | ◎ |
| Dark mode | ◎ |
| Weather display | ◎ |
| Weather conditioning advice | ◎ |
| Competition countdown | ◎ |
| Team broadcasts | ◎ |
| Input streak | ◎ |
| Condition calendar | ◎ |
| Injury indicators | ◎ |
| Coach comments | ◎ |
| Morning input | ◎ |
| Evening input | ◎ |
| IRS | ◎ |
| Rule-based “AI advice” | ◎ |
| Learning content | ◎ |
| History | ◎ |
| Kudos | ◎ |
| Notification center | ◎ |
| Reminder behavior | ○ |
| PB/confetti behavior | ◎ |

## Admin application

| Feature | Status |
|---|---|
| Daily/team monitoring | ◎ |
| Unsubmitted-data detection | ◎ |
| High-fatigue monitoring | ◎ |
| Sleep monitoring | ◎ |
| Monotony monitoring | ◎ |
| ACWR monitoring | ◎ |
| Condition detail | ◎ |
| Coach comments | ◎ |
| Team trend analysis | ◎ |
| Care analysis | ◎ |
| Muscle soreness heatmap | ◎ |
| Sprint ranking | ◎ |
| F-v profile | ◎ |
| Individual analysis | ◎ |
| Goal/player management | ◎ |
| Education management | ◎ |
| Full data view | ◎ |
| Dynamic IRS recalculation | ◎ |
| CSV export | ◎ |
| PDF report generation | × |

## Known implementation gaps
### PDF report
The current implementation contains a placeholder/preparation state rather than a completed PDF reporting system.

### Device synchronization
The UI contains synchronization-related affordances, but automatic device integration for sleep/heart rate/steps is not currently a completed feature.

### Reminder implementation
Reminder behavior exists, but it should not automatically be assumed to be equivalent to a full server-side web-push system.

## Product terminology
Rule-based recommendations are intentionally called “AI advice”. This is accepted and should not be reclassified as a defect.

## Important distinction
A feature marked ◎ means it is implemented according to the current review. It does not mean the feature is bug-free or that its underlying mathematical/technical implementation has been formally validated.
