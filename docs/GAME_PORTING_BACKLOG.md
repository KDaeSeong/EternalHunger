# Game Porting Backlog

Source archive: `C:\2저장고\마이애니메\마이애니메.zip`
Checked: 2026-07-04

## Current Shared Site Support

- Public game candidates can be managed from `/admin/games`.
- Visible candidates appear in `/games` and `/games/[slug]`.
- Candidates using `roomSystem: game-room` can be selected in `/games/rooms`.
- Dynamic candidate names are recognized in room detail, save slots, and records.
- Adapter presets now provide default room/result/save/record capability flags.
- Playable routes can share `GamePlayShell` for header, actions, summary metrics, and status messages.

## Recommended First Port

1. `primitive-archive`
   - Adapter: `survival-loop`
   - Suggested route: `/games/primitive-archive/play`
   - Why first: self-contained Vite/React game, clear TypeScript core modules, IndexedDB save model, run summary queue already exists.
   - Site integration target: replace IndexedDB-only persistence with `/game-saves`, submit run summaries through `/game-records`, and expose a playable slice from the existing core loop.
   - First slice: party/status, action loop, inventory/camp summary, save/load, end-run record.

## Next Candidates

2. `tonkatsu_teacher_mvp_v0.4.5_judge_batch_banner`
   - Adapter: `management-loop`
   - Why next: simple React/Vite app with JSON data and a compact kitchen/business/battle/contest loop.
   - Site integration target: save restaurant state to `/game-saves`, record contest or battle result to `/game-records`.
   - First slice: ingredient shop, recipe crafting, shop sales, student meal support, battle reward loop, save/load, end-run record.

3. `ba-vanguard`
   - Adapter: `shared-game-room`
   - Why next: already close to the existing TCG prototype. Deck builder and card data can be folded into the current `dual-academy-tcg` area.
   - Site integration target: import card catalog/deck validation first, then connect room state sync later.
   - First slice: P-G card catalog, sample deck presets, main/G-zone validation, opening-hand test, save/load, deck-test record.

4. `myanimecraft`
   - Adapter: `league-sim`
   - Why not first: it is important, but larger. It has many career/league/economy modules and an Electron build path.
   - Site integration target: season state as save slot, match results as records, rankings as a game-specific hub panel.

5. `Schale_idle_rpg_v1_34`
   - Adapter: `idle-rpg`
   - Why later: mature but version-heavy. Needs migration cleanup before embedding.
   - Site integration target: account progress save, tower/boss results, item/equipment snapshots.

6. `ba-srpg`
   - Adapter: `tactical-grid`
   - Why later: best long-term playable game candidate, but needs a larger route/UI slice.
   - Site integration target: mission data import, tactical state save, mission-clear record.

7. `rail3d-sim`
   - Adapter: `transport-sim`
   - Why later: engine-heavy and likely needs a dedicated visual/debug route.

8. `company-report-stepg6-ledger-physical-restore`
   - Adapter: `business-ledger`
   - Why later: very large backend-oriented Spring project; better treated as a separate integration track.

9. `si-coding-sim_stepAQ_AR`
   - Adapter: `challenge-sim`
   - Why later: needs problem/judge sandbox decisions before embedding.

10. `school-simulator-step23`
    - Adapter: `school-sim`
    - Why later: small, but plain JS structure needs cleanup before sharing site state.

11. `racing-logos-demo`
    - Adapter: `discussion`
    - Why later: looks more like an asset/demo pack than a full game loop.

## Immediate Implementation Plan

1. Done: add a `primitive-archive` playable route under `client/src/app/games/primitive-archive/play`.
2. Done: expose one minimal loop without importing the whole Vite shell.
3. Done: wrap state in the existing game save API contract:
   - save key: `primitive-archive-main`
   - version: `primitive-archive-v1`
   - summary: day, party, HP/hunger, camp level, inventory weight
4. Done: submit run/end summaries to `/game-records/primitive-archive`.
5. Done: mark the static catalog integration as prototype-ready.
6. Done: split the Primitive Archive loop into a reusable engine module under `client/src/app/games/primitive-archive/_lib`.

## Primitive Archive Slice Status

- Route: `/games/primitive-archive/play`
- Included loop: party selection, zone selection, gather, hunt, craft, eat, rest, camp upgrades, day rollover, death/end state.
- Site API integration: quick save through `/game-saves/primitive-archive/primitive-archive-main`; run record through `/game-records/primitive-archive`.
- Asset integration: source portraits are copied to `client/public/games/primitive-archive/portraits`.
- Next step: replace the simplified engine internals with selected original core modules while keeping the site save/record shell stable.

## Tonkatsu Teacher Slice Status

- Route: `/games/tonkatsu-teacher/play`
- Included loop: ingredient buying, recipe crafting, menu sales, student meal support, battle reward progression, day rollover.
- Site API integration: quick save through `/game-saves/tonkatsu-teacher/tonkatsu-teacher-main`; run record through `/game-records/tonkatsu-teacher`.
- Source basis: `C:\2저장고\마이애니메\tonkatsu_teacher_mvp_v0.4.5_judge_batch_banner`.
- Next step: import the original facility, research, and tournament rules into the simplified engine.

## BA Vanguard Slice Status

- Route: `/games/ba-vanguard/play`
- Included loop: P-G card library, Gehenna/Trinity/Millennium sample deck presets, deck rule validation, opening-hand shuffle test.
- Site API integration: quick save through `/game-saves/ba-vanguard/ba-vanguard-main`; deck-test record through `/game-records/ba-vanguard`.
- Source basis: `C:\2저장고\마이애니메\ba-vanguard`.
- Next step: import the original battle playtest engine and room state sync.

## MyAnimeCraft Slice Status

- Route: `/games/myanimecraft/play`
- Included loop: Starleague-style 10-team round-robin season, weekly fixtures, best-of-five team matches, standings, map pool, team roster inspection, season rollover.
- Site API integration: quick save through `/game-saves/myanimecraft/myanimecraft-main`; league snapshot record through `/game-records/myanimecraft`.
- Source basis: `C:\2저장고\마이애니메\starleague-masterdata.json` and `C:\2저장고\마이애니메\myanimecraft`.
- Next step: replace the simplified match model with selected original `simulateSet`, career economy, personal league, and postseason modules.

## Schale Idle RPG Slice Status

- Route: `/games/schale-idle-rpg/play`
- Included loop: idle floor settlement, stamina recovery, equipment crafting, equipment enhancement, Trial Tower attempts, mission rewards, inventory/equipment summary.
- Site API integration: quick save through `/game-saves/schale-idle-rpg/schale-idle-rpg-main`; account-progress snapshot through `/game-records/schale-idle-rpg`.
- Source basis: `C:\2저장고\마이애니메\Schale_idle_rpg_v1_34`.
- Next step: import the original equipment instance, reroll, auto-salvage, tower shop, and migration rules behind the simplified site shell.

## BA SRPG Slice Status

- Route: `/games/ba-srpg/play`
- Included loop: mission selection, tactical grid movement, AP, range, cover/obstacle tiles, enemy phase, mission rewards, inn rest, crafting, shop purchases, equipment, and guild quest reporting.
- Site API integration: quick save through `/game-saves/ba-srpg/ba-srpg-main`; tactical-grid snapshot through `/game-records/ba-srpg`.
- Source basis: `C:\2저장고\마이애니메\ba-srpg\ba-srpg-frontend\public\srpg` and the monolithic `App.tsx` game flow.
- Next step: import the original town hub, property, edict, quest cadence reset, and richer battle UI rules behind the site save/record shell.

## School Simulator Slice Status

- Route: `/games/school-simulator/play`
- Included loop: weekly school operations, policy presets, AP/budget spending, student growth/stress, teacher fatigue/morale, facility condition, exam weeks, semester reports, rest action, and school score summary.
- Site API integration: quick save through `/game-saves/school-simulator/school-simulator-main`; term-report snapshot through `/game-records/school-simulator`.
- Source basis: `C:\2저장고\마이애니메\school-simulator-step23` JavaScript simulation, seeds, and Step 23 UI flow.
- Next step: import the original admissions, career, club, festival, and subject-specific presentation/evaluation flows behind the site save/record shell.

## SI Coding Sim Slice Status

- Route: `/games/si-coding-sim/play`
- Included loop: Step AQ/AR task pack loading, task selection, code file editing, report writing, hint reveal cost, includes/notIncludes/anyIncludes judge rules, resource settlement, project grade evaluation, and run log.
- Site API integration: quick save through `/game-saves/si-coding-sim/si-coding-sim-main`; challenge-score snapshot through `/game-records/si-coding-sim`.
- Source basis: `C:\2저장고\마이애니메\si-coding-sim_stepAQ_AR\prototype\data\task-pack-stepAQ_AR.json` and `data\judge-rules.json`.
- Next step: import the original execution harness, company support budget, contract negotiation, follow-up branch, seed generation, and career progression UI.
