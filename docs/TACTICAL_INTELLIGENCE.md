# Tactical intelligence v1

Eight additions are embedded in the existing laboratory/rematch screens. They operate on archived EA player-event aggregates, not event sequences, coordinates or video. No new EA requests or production collection changes are introduced.

## Features and decisions

1. Passing bottleneck: event 175 per 100 attempted passes versus forward success. Player chart and a separate match-level co-occurrence rule: at least five paired valid matches and two strict high-no-option/low-forward cases. Feedback is a hypothesis about support, never proof of poor movement.
2. Passing expectation: observed forward/back/side successes minus position-specific expected successes. Unknown direction attempts do not enter the expectation; known directions must cover at least 80% of pass attempts. Chart residual is shrunk with n/(n+50), with raw residual visible.
3. Press balance: defensive-third loss share versus attacking-third regain share, including raw counts, severe positioning feedback and opposition recorded shots. Five matches minimum for quadrant labels; ties explicitly stay on the boundary.
4. Score versus play: four independent indicators versus the median of at most twenty strictly older matches, at least five per indicator. No xG, expected score or win probability. Shot comparison needs complete event coverage of both recorded human sides and shows their player counts. AI actions are outside scope.
5. Rematch recipe: same opponent ID, own forward success against other opponents, both human-roster overlaps, opponent profile from our encounters only, and local trials started between encounters. A changed opponent roster weakens transferability. Two encounters plus five other-opponent games are needed for the forward-pass recipe.
6. Production dependency: 1 / sum(player share squared), separately for forward passes, through balls, second assists and regional regains. Entire matches with missing player records are excluded. This is concentration, not estimated absence impact.
7. Session rhythm: configurable 60/90/120-minute elapsed gap; disjoint first two/last two games of sessions of at least four games. Requires five complete sessions per metric for repeated-pattern wording. Shows roster and opponent changes. Filters can truncate a session; neither fatigue nor tilt is diagnosed.
8. Prospective trials: frozen baseline IDs and a registered implementation metric/direction, primary metric, guardrail, and minimum change. First N recorded post-start matches form the window, including missing-data games. All three metrics use the same eligible cohort. Five pre/post matches, completed window and application threshold required for a verdict. Guardrail harm overrides positive results.

## Data and reference model

Community source: https://github.com/Interactive-63/eafc-pro-clubs-api-research (uploaded repository archive).

Regenerate:
```sh
python scripts/build-pass-reference.py /path/to/eafc-pro-clubs-api-research-main.zip
```

Only the anonymous, small aggregate model is committed in data/pass-reference.json. It contains CSV SHA-256, raw/valid/train/holdout counts, cutoff timestamp, event totals and smoothed directional rates by recorded position. The 47 MB raw CSV and player identifiers are not shipped.

Records are deduplicated by match/club/player. Club 79638 is excluded. Named passes, goals, assists and shots must agree with events; impossible direction partitions are rejected. Training uses the oldest 80% of distinct timestamps; holdout uses strictly later timestamps, keeping matches together. Group rates use a 100-attempt global prior. The artifact reports aggregate heldout calibration error, not individual prediction accuracy. The game sample is not a population census. The reference is versioned, not automatically refreshed.

The application refuses model estimates at or before the training cutoff and for unknown positions. Existing event decoding validates goal/assist/shot consistency; additional pass consistency, direction and shot partition checks apply. Missing events within a valid bucket mean zero; missing buckets mean unavailable. Ratios are pooled from numerators/denominators, not averaged percentages. Team signals require 80% recorded player coverage per metric.

## Trial uncertainty

400 deterministic bootstrap resamples of whole matches, preserving numerator/denominator pairs. 5th/95th percentiles give a descriptive 90% difference interval. Serial dependence, non-random tactics and multiple exploration are not corrected: a signal is never a causal claim.

Matched sensitivity uses the same opponent ID and >=50% Jaccard overlap for both human rosters, within the frozen baseline and trial window. It needs five records each for an interval. No post-match performance variable selects matched records. It is not an independent controlled experiment.

Old local trials remain readable but receive no new success verdict without preregistered criteria. Plans and notes remain browser-local and are included in the existing JSON export. They are not team-shared data.

## UI / accessibility

Six internal navigation views in the laboratory; rematch recipe in the opponent view; trial assessments in the existing experiment list. SVG points support keyboard and touch selection; screen-neighbour points group without altering the source values. Selected values and a full expandable table expose exact coordinates and source match links. Mobile tables scroll within panels.

## Verification

Run pnpm test, pnpm lint, pnpm exec tsc --noEmit, and pnpm build. Tactical tests cover missingness, event reconciliation, expectation arithmetic, chronological isolation, pooling, shrinkage, concentration, quadrant ties, sessions, trial windows, adverse guardrails, deterministic intervals and real snapshot immutability.
