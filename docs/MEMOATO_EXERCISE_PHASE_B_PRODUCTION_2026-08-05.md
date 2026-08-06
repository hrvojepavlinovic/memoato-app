# Memoato exercise Phase B production audit and repair

Date: 2026-08-05

Scope: approved production category/alias/concept and derived-data repair
Invariant: no `Event(kind=NOTE)` row, raw text, raw ID, or raw metadata is updated or deleted

## Production authority and immutable baseline

The production user scope is derived from the existing foreign-key relationship of raw entry `6f38571f-5e59-4e5a-a4fd-17e2e2a78572`. The other two supplied raw IDs resolve to the same single user; no username or manually supplied user ID is used as authority.

Before mutation:

- raw `NOTE` count: `48`
- raw ID/text digest: `31ac35ab5b252e97d278f1b5cc63cb50`
- supplied raw MD5 values:
  - `6f38571f-5e59-4e5a-a4fd-17e2e2a78572`: `e20a5ad8eb9d36bc3e71eb58d263a57a`
  - `4b6e4596-2ac1-4ba0-b7d5-d4e799a5f3d6`: `9674450e04143898aafba8b0924b3cd9`
  - `1dd6a03d-de0f-4d23-8820-dc18463818b0`: `40aa4102acc2e3dc2c72094e68146ddd`

## Category targets

New rows use fixed UUIDv5 IDs so the operation is replay-safe:

| ID | Title | Slug | Kind | Unit |
| --- | --- | --- | --- | --- |
| `1ededf8f-b06b-5685-ad99-19ae6cf4f6f3` | Workout Session | workout-session | movement | null |
| `0760308e-7b30-53e6-a51e-05ded69e12d6` | Dead Bug | dead-bug | movement | reps |
| `ef73ba95-80f0-50c5-b2cb-bcf13fb6b35f` | Supported One-arm Dumbbell Row | supported-one-arm-dumbbell-row | movement | reps |
| `698eba7c-fa5d-53d0-b3fe-5c811a78ecd5` | Chair Sit-to-stand | chair-sit-to-stand | movement | reps |
| `36c5d0e5-7e43-51aa-8593-d91c4214f67c` | Dumbbell Romanian Deadlift | dumbbell-romanian-deadlift | movement | reps |
| `0bbba913-0d80-5b13-a29f-8617bf78086d` | Low Step-up | low-step-up | movement | reps |
| `9c371cff-ca20-57f3-8f91-96f46235958b` | Seated Dumbbell Shoulder Press | seated-dumbbell-shoulder-press | movement | reps |

Reused category IDs:

- Push ups `focus_cat_71`
- Calf Raises `c9b55053-c67b-43ed-9793-21f9e877ed30`
- Wall Sit `038f98ad-606a-4a19-9b0d-f1fcc0af0b7e`
- Glute Bridge `e7462b11-875a-4329-bfc4-b4a26c48d41f`
- Stationary Cycling `8f377b2c-bef6-4d51-8997-8cb8e5ff4822`
- Strength B Workout `864bfedc-cf4b-4e7b-a662-544df4a83a17`
- Indoor Bike `b5e984c1-629e-4b99-b828-cd629bb6cd74` remains a separate legacy kcal category

Safe metadata normalization targets: Push ups -> `movement/reps`; Wall Sit -> `movement/seconds`; Glute Bridge -> `movement/reps`; Stationary Cycling -> `movement/minutes`. Indoor Bike remains `amount/kcal`.

## Concept targets

New concept IDs:

- workout session `7adbe3b6-1bf2-5184-aedc-132abfb8d71b`
- dead bug `63339d38-f042-5aad-807a-5a7bfb3735ea`
- push ups `353c2701-4263-56c1-bfc0-d098075990fc`
- supported one-arm dumbbell row `0840e080-93ee-5a93-a7a8-f0cc77fe8dab`
- chair sit-to-stand `785629cc-57b0-5e4b-838f-6858585485d1`
- dumbbell Romanian deadlift `70d59591-9151-5af1-8526-9fa684869b77`
- low step-up `bb0ee057-e2a5-5aca-bbcb-6b36b7db10b5`
- wall sit `7a26bbcf-9946-589b-8c00-85048d812f02`
- shallow glute bridge `ad30cfaa-e980-51bd-9443-9e627ab11979`
- seated dumbbell shoulder press `9c9261fe-0df6-55b7-9db5-d0eb1c9100d2`

Existing concept IDs retained and normalized:

- `9159eb8d-3220-46ee-927b-c91c32ad3314`: `movement.calf_raises` -> `movement.bilateral_calf_raise`
- `b685291d-020b-4e4b-b25f-d4a3aef8877f`: `movement.stationary-cycling` -> `movement.stationary_cycling`
- `ebba0f47-d127-4c89-9de8-6418a9642d4c`: Strength B program concept remains separate

Orphan duplicate Stationary Cycling concept `5f493753-2483-4cee-bfde-f2ddf022d2d3` may be deleted only after its duplicate derived fact is removed and no references remain.

Existing concept-alias rows intentionally reassigned to the canonical concepts are:

- `c3a8f866-e763-4257-b55a-76c29f32df6e` (`glute-bridge`): generic Strength -> Shallow Glute Bridge
- `9aa4bd45-59c4-4025-aa6a-63e1ef842c19` (`wall-sit`): generic Strength -> Wall Sit
- `135f87f8-d71b-4a70-97eb-31526c08374f` (`mini-strength-b`): personal Notes -> Strength B Workout
- `5bb5742e-2948-47e9-a38c-6136ae3bae6d` (`stationary-cycling`): `health.indoor-bike` -> canonical Stationary Cycling

Existing aliases `4cf2e64e-6187-458b-9a51-28adac249171` (`calf-raises`), `dc6b0bfd-ccfb-4f6b-a7b1-d14303f97360` (`listovi`), and `5202fd74-e8ab-4972-a3e9-2682a69c7a0b` (`strength-b-workout`) retain their row IDs while their owning concepts are normalized.

## Alias targets

Thirty-one personal `MemoryAlias` rows and matching concept aliases are approved, normalized idempotently, for these exact phrase groups:

- Workout Session: `workout session`, `trening`
- Dead Bug: `dead bug`, `dead bug po strani`
- Supported One-arm Dumbbell Row: `supported one-arm dumbbell row`, `jednoručno veslanje bučicom s osloncem`
- Chair Sit-to-stand: `chair sit-to-stand`, `ustajanje sa stolice`
- Dumbbell Romanian Deadlift: `dumbbell romanian deadlift`, `rumunjsko mrtvo dizanje s bučicama`
- Low Step-up: `low step-up`, `niski step-up`
- Seated Dumbbell Shoulder Press: `seated dumbbell shoulder press`, `sjedeći dumbbell shoulder press`, `sjedeći potisak bučicama iznad glave`
- Push ups: `push ups`, `sklekovi`
- Calf Raises: `bilateral calf raise`, `calf raises`, `listovi`, `podizanje na prste`
- Wall Sit: `wall sit`, `sjed uz zid`
- Glute Bridge: `glute bridge`, `plitki glute bridge`, `most za gluteus`
- Stationary Cycling: `stationary cycling`, `vožnja sobnog bicikla`
- Strength B Workout: `strength b workout`, `mini strength b`, `strength b`

`indoor bike`, `stationary bike`, `bike`, `sobna bicikla`, and `sobnu biciklu` are intentionally not moved to Stationary Cycling because they already map to the incompatible legacy Indoor Bike kcal concept.

## Exact derived row targets

### Mini Strength B raw `6f38571f-5e59-4e5a-a4fd-17e2e2a78572`

Existing facts to update:

- workout/note fact `9d162d74-8232-4632-a19a-e35e62d6600e`
- wall-sit fact `bc18d79f-1dfa-4a93-b1ab-35ae660fe4f1`
- glute-bridge fact `92fba72a-7fd9-4299-b72b-26a5856c8251`
- pain/context fact `59830395-180b-4e7b-94ab-575785f98385` only moves from position 3 to position 5 so the inserted exercise facts occupy positions 3 and 4

Existing set events retained/updated:

- Wall Sit: `54e9373f-c19b-41e3-b522-ad6bbf45b0c5`, `3a70ec1e-8909-48ba-9611-7bc9ade5eed5`, `80060eab-33d7-4574-9223-44f7d1d4e667`
- Glute Bridge set 1: `c0ae3bed-f7b5-4a42-bb29-55cd332afd0d`

New fact IDs:

- shoulder press `bf3e3cbe-6a2e-5282-856c-5e120758018e`
- dead bug `6fbeae3c-27a5-5532-86b2-92d3da282b81`

New event IDs:

- workout `b9d48b6a-e243-51c9-80d3-60286e933471`
- Glute Bridge set 2 `0d635696-a074-5c9b-8193-a7f076d823cf`
- shoulder press sets `891ad79f-7302-5f5f-a068-3b88629ebbec`, `1d3d8a56-1234-5657-a31b-bd520f26d825`
- dead bug sets `c27cf11c-0665-52a5-8da5-66667e8cfaaf`, `04ddbd53-d94f-53f0-90e4-170443f67d8d`

### False and duplicate projections

Delete both rows in each pair unless noted:

- false Calf Raises: fact `95447553-9040-4e44-b738-48eb1837aa4b`, event `705074e9-f456-4415-ac30-62c651782324`
- duplicate evening Strength B: fact `b6b8f723-7278-4562-8838-c60c91595f0d`, event `f69c686e-d1cc-48ec-a475-590e5814be5e`
- duplicate midday cycling correction, Indoor Bike: fact `2ac0b3e2-0a73-43ed-84cb-fb2203f2a36a`, event `77723758-aa06-4abb-9eed-3490c3ca042f`
- duplicate midday cycling correction, Stationary Cycling: fact `902cd9b0-32e9-45d2-aee7-40ebca6f7fb4`, event `67e26098-9fb3-446d-87fb-e0e07ced0b3e`
- duplicate evening cycling recap: fact `b57c51b2-cf14-47d0-bcc0-14b1b8fa7507`, event `976c9611-9faf-4bf6-8eba-8de2b658365e`
- duplicate 2026-08-04 evening cycling recap: fact `979e4daa-f513-4af0-819c-06c351507c17`, event `41963fab-f236-4a6c-a6cc-dd4b84ce949d`
- incompatible generic Indoor Bike projection on detailed duration/kcal raw: fact `3888157f-757c-40d2-913d-76e9fa0bf9da`, event `156a891b-d537-4dc8-b4d2-7305a01be18b`

Planned cycling facts are retained but converted to non-projecting `executionStatus=planned`; only their false SESSION events are deleted:

- fact `9e8f8b7a-ca04-49ef-9d2b-e2f839b815da`, event `64632460-649d-44f6-ad3d-0395db15d531`
- fact `f0b923d1-3b46-4c4f-99c4-a56f2a88644c`, event `06ca86e8-c843-4a42-9baf-cd938783ffa5`

### Actual Calf Raises history

Facts to repair and events to insert:

- raw `560779d7-294f-4d04-999d-e05dcc7ae120`, fact `1d09f606-8203-43ef-a58b-b7b4f589e0c1`, event `65b88fee-f5bf-5164-98ec-0ecd05cdbd36` = 1x10
- raw `37ee4bfd-db47-4eef-880b-ed93bd9ec9b4`, fact `09fb9343-5ac1-4795-9fc7-b68e63336219`, events `4f9ac588-26f5-5552-9c0c-e4c47c5e2ec7`, `61fb4d18-1d73-5fc9-a793-487fd68c257c` = 2x10

### Feedback raw

Fact `9c74660d-2a9d-411a-aa97-0ee5a14338b6` is updated in place from generic Life note to a Dead Bug `executionStatus=reported` fact with no SESSION event. It records 2x6 as too easy, links confirmed 2x8 to raw `6f38571f-5e59-4e5a-a4fd-17e2e2a78572`, and records 2x12 only as undated self-report.

Post-transaction verification identified old fallback Notes SESSION `8b74d458-0576-4903-aaa6-c72bb5a37e11` for the feedback raw. It has `data.rawEntryId=1dd6a03d-de0f-4d23-8820-dc18463818b0`, category `Notes`, no fact payload, and zero normalized fact links. It is therefore an exact orphan target for a second minimal delete-only transaction; the raw NOTE remains untouched.

## Intentionally untouched before mutation

- All 48 raw NOTE rows and all raw metadata/text.
- Indoor Bike category and its incompatible kcal model.
- Legacy Indoor Bike event `5214b4e4-37c0-46f0-9216-ec2da70143da` for raw `ed0fb486-0d38-4c5e-b271-7e64eacb3134`: valid 10-minute retrospective evidence exists, but it lacks a normalized fact link and its legacy category/unit semantics are ambiguous.
- Duplicate active-kcal interpretations on detailed bike raws: choosing between the explicit client Indoor Bike kcal projection and newer Active Calories categories is a metric-taxonomy decision outside this exercise repair.
- Unrelated concept/catalog anomalies such as the Padel concept's current category mapping; they require a separate bounded taxonomy audit.

## After verification

Production commit completed successfully. The validated SQL file used for the main transaction had SHA-256 `e44a75707297a78cb982b0c63aebe9c022551e75b39f558f0abf027cd44b62ff`. A full after-state replay of the same SQL also passed every invariant and was rolled back, proving that the fixed IDs, upserts, conditional deletes, and after-state preconditions are replay-safe.

### Aggregate before/after

| Row class | Before | After | Change |
| --- | ---: | ---: | ---: |
| Raw NOTE | 48 | 48 | 0 |
| Categories | 24 | 31 | +7 |
| Personal aliases | 0 | 31 | +31 |
| Concepts | 56 | 65 | +10 canonical, -1 orphan duplicate |
| Normalized facts | 154 | 149 | +2 exercise facts, -7 false/duplicate facts |
| SESSION events | 1,125 | 1,124 | +9 performed events, -10 false/duplicate/orphan events |

Raw ID/text digest remained exactly `31ac35ab5b252e97d278f1b5cc63cb50`. All three supplied raw MD5 values remained unchanged, and no SQL statement updated or deleted a NOTE row.

### Actual category inventory after

| Category | Events | Facts | Personal aliases | Notes |
| --- | ---: | ---: | ---: | --- |
| Workout Session | 1 | 1 | 2 | created, unitless |
| Dead Bug | 2 | 2 | 2 | one performed fact + one reported feedback fact |
| Supported One-arm Dumbbell Row | 0 | 0 | 2 | created, ready for future writes |
| Chair Sit-to-stand | 0 | 0 | 2 | created, ready for future writes |
| Dumbbell Romanian Deadlift | 0 | 0 | 2 | created, ready for future writes |
| Low Step-up | 0 | 0 | 2 | created, ready for future writes |
| Seated Dumbbell Shoulder Press | 2 | 1 | 3 | repaired 2x10 |
| Push ups | 222 | 0 | 2 | reused; metadata normalized to movement/reps |
| Calf Raises | 3 | 2 | 4 | false 21 removed; actual 1x10 and 2x10 projected |
| Wall Sit | 3 | 1 | 2 | repaired 3x30 seconds |
| Glute Bridge | 2 | 1 | 3 | repaired 2x15 |
| Stationary Cycling | 2 | 4 | 2 | two performed events + two non-projecting planned facts |
| Strength B Workout | 0 | 0 | 3 | retained as program/category mapping; no duplicate workout projection |
| Indoor Bike | 24 | 1 | 0 | retained as separate legacy kcal category |

### Created personal alias IDs

```text
177d9286-dd22-5914-a4a6-2a4690d10938  bilateral-calf-raise -> Calf Raises
ab7e8f25-1c29-5a43-a964-76931bcd542f  calf-raises -> Calf Raises
2faf5abf-b500-5bfb-9c8a-acc67433026a  listovi -> Calf Raises
b58ccd33-0d6e-5535-8bd2-fbf71dfb26ad  podizanje-na-prste -> Calf Raises
b488c920-78aa-5337-b52c-e3148d755a4e  chair-sit-to-stand -> Chair Sit-to-stand
31a997b5-16fc-5321-96c1-3c6fc004834b  ustajanje-sa-stolice -> Chair Sit-to-stand
e4181f71-c24d-5a75-8497-99f8ad90168f  dead-bug -> Dead Bug
cb7649c2-f283-5cac-aba6-9beae6fb2be0  dead-bug-po-strani -> Dead Bug
4c8b8eec-bf14-50a2-a8ec-14d9eef3efa3  dumbbell-romanian-deadlift -> Dumbbell Romanian Deadlift
50348822-8dac-5337-a03a-36fd1948a74a  rumunjsko-mrtvo-dizanje-s-bucicama -> Dumbbell Romanian Deadlift
9137fc9b-3521-513c-87fd-36be6c66db15  glute-bridge -> Glute Bridge
240a5ea1-aaa8-527d-9e81-e25530e3a2cf  most-za-gluteus -> Glute Bridge
d24c23a5-0b57-5f52-a117-33cb2574c608  plitki-glute-bridge -> Glute Bridge
498b228d-da9a-5afe-bc93-ef4ad62ab79c  low-step-up -> Low Step-up
22512df3-082b-5066-88dc-619296cc28c6  niski-step-up -> Low Step-up
b0666388-1ebf-55da-8b15-7714d311f2dd  push-ups -> Push ups
93e678b8-7c2e-525d-9811-4909d7c59565  sklekovi -> Push ups
b0624833-e1ad-5001-bf05-7d9cad0ef008  seated-dumbbell-shoulder-press -> Seated Dumbbell Shoulder Press
b3215041-64a5-52e8-b62c-8bc9d3966e47  sjedeci-dumbbell-shoulder-press -> Seated Dumbbell Shoulder Press
2e7bc0e8-c330-532e-85ae-4a2d6006cedb  sjedeci-potisak-bucicama-iznad-glave -> Seated Dumbbell Shoulder Press
38543aa1-2a76-5070-bbd8-3b7eea86b33d  stationary-cycling -> Stationary Cycling
3455fbad-26d7-5d7c-9246-4997756a6108  voznja-sobnog-bicikla -> Stationary Cycling
7c706729-5415-5b94-9e6a-7b166274065c  mini-strength-b -> Strength B Workout
5b262eed-23ff-5bbf-9dda-f5006edd92ab  strength-b -> Strength B Workout
4c99b1b9-2901-5e68-8a6b-762ad716e234  strength-b-workout -> Strength B Workout
cc12ec73-a339-5c36-a7d3-7ef1824fe655  jednorucno-veslanje-bucicom-s-osloncem -> Supported One-arm Dumbbell Row
7e149e57-94e5-5f2b-a118-cf1fb3e0ed9b  supported-one-arm-dumbbell-row -> Supported One-arm Dumbbell Row
9c1ce63a-504f-5879-abc3-06b2ff5e0a17  sjed-uz-zid -> Wall Sit
ef0c4717-2e97-5230-867b-36edf962ac47  wall-sit -> Wall Sit
adc9a1e0-2448-555b-aa1f-97c90fc9a3e6  trening -> Workout Session
bfd42e5b-6a35-54ea-bed9-9f760df9ed00  workout-session -> Workout Session
```

Thirty-one concept-alias upserts also completed: 24 new rows and seven exact collision reassignments documented above.

### Mini Strength B verification

Raw `6f38571f-5e59-4e5a-a4fd-17e2e2a78572` now has six normalized facts and ten performed SESSION events:

- workout event `b9d48b6a-e243-51c9-80d3-60286e933471`;
- Wall Sit events `54e9373f-c19b-41e3-b522-ad6bbf45b0c5`, `3a70ec1e-8909-48ba-9611-7bc9ade5eed5`, `80060eab-33d7-4574-9223-44f7d1d4e667` = `30,30,30` seconds;
- Glute Bridge events `c0ae3bed-f7b5-4a42-bb29-55cd332afd0d`, `0d635696-a074-5c9b-8193-a7f076d823cf` = `15,15` reps;
- Shoulder Press events `891ad79f-7302-5f5f-a068-3b88629ebbec`, `1d3d8a56-1234-5657-a31b-bd520f26d825` = `10,10` reps;
- Dead Bug events `c27cf11c-0665-52a5-8da5-66667e8cfaaf`, `04ddbd53-d94f-53f0-90e4-170443f67d8d` = `8,8` reps per side.

Every workout/exercise fact and set event carries the same `workoutId` and raw link. The existing pain/context fact remains at position 5. No 2x12 performed event exists.

### Removed and repaired rows

- All seven targeted false/duplicate fact IDs and all nine paired/plan event IDs listed in the before section are absent.
- Feedback fallback Notes event `8b74d458-0576-4903-aaa6-c72bb5a37e11` is absent.
- Feedback fact `9c74660d-2a9d-411a-aa97-0ee5a14338b6` is `executionStatus=reported`, has no derived event, stores 2x6 as too easy, stores 2x12 with `dateConfirmed=false`, and links confirmed 2x8 to the 2026-08-02 raw.
- Planned cycling facts `9e8f8b7a-ca04-49ef-9d2b-e2f839b815da` and `f0b923d1-3b46-4c4f-99c4-a56f2a88644c` remain queryable as `executionStatus=planned` with zero SESSION projections.
- Actual Calf facts `1d09f606-8203-43ef-a58b-b7b4f589e0c1` and `09fb9343-5ac1-4795-9fc7-b68e63336219` now project exact sets `10` and `10,10`.
- The 12 inspected target raws have zero orphan derived events after cleanup.
- Exact normalized derived-event duplicate scan returned zero rows. Exact category title duplicate scan returned zero rows.

### Actual coverage and intentionally retained ambiguity

- Complete row-level inventory was performed for all 14 relevant categories, all 31 personal aliases, their canonical concepts, the 12 selected workout/plan/feedback raws, their normalized facts, and their derived SESSION events.
- Exact event duplicate grouping covered all events in the 14 categories, including all 222 legacy Push ups events. It found 18 same-time/same-value Push ups groups. Representative raws (`Push ups 8`, `Push ups 10 x`) and distinct source IDs are consistent with repeated equal-value sets, but old rows have no `setIndex` or raw provenance. They were not deleted.
- The two value-2 Pull ups facts for raw `a51a822e-3605-418a-aa75-e6b57e2ba69c` are not duplicates: their stored `setIndex` values are 1 and 2 in the explicit raw `Zgibovi 2 2 3`.
- Indoor Bike legacy event `5214b4e4-37c0-46f0-9216-ec2da70143da` remains the only known relevant derived event without a normalized fact link. Its raw proves a retrospective 10-minute ride, but the event is in the legacy kcal category; deleting or moving it would require choosing incompatible metric semantics.
- Indoor Bike has 24 events: two with `data.rawEntryId`, and 22 legacy/no-raw-provenance rows. Those 22 were count-audited but cannot receive reliable semantic duplicate decisions from current production evidence.
- Duplicate active-kcal interpretations on detailed bike raws remain untouched because choosing between explicit client Indoor Bike kcal history, Active kcal, and Active Calories Burned is a separate metric-taxonomy decision.
- The remaining Strength concept fact `5caf15cb-936e-4c00-81dd-43f2ac192544` is an uncategorized 18-minute plan from raw `9e92b9df-2b50-4867-8294-2e8a3a2aa079`, confidence 0.8, with no SESSION projection; it is safe and was retained.
- Unrelated catalog anomaly `movement.padel -> Pain` was observed but not mutated because this phase was bounded to the named exercise taxonomy and derived workout repairs.

### Access and deployment gap

The active MCP surface still lacks category/alias/fact/event administration and audit reads, so production verification required direct read-only SQL over the proven user relation. No API key or environment secret was printed. No Todoist, deploy, commit, push, migration, mass reprocess, or raw mutation occurred.

The local Exercise Nested Phase A code is still only in the dirty worktree and is not live. Production data is repaired now, but future automatic nested writes need a separately approved commit, push, and deploy of that code.
