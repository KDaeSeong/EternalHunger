# Game Porting Backlog

Source archive: `C:\2저장고\마이애니메\마이애니메.zip`
Checked: 2026-07-04

## Current Shared Site Support

- Public game candidates can be managed from `/admin/games`.
- Visible candidates appear in `/games` and `/games/[slug]`.
- Candidates using `roomSystem: game-room` can be selected in `/games/rooms`.
- Dynamic candidate names are recognized in room detail, save slots, and records.
- Adapter presets now provide default room/result/save/record capability flags.

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

3. `ba-vanguard`
   - Adapter: `shared-game-room`
   - Why next: already close to the existing TCG prototype. Deck builder and card data can be folded into the current `dual-academy-tcg` area.
   - Site integration target: import card catalog/deck validation first, then connect room state sync later.

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

1. Add a `primitive-archive` playable route under `client/src/app/games/primitive-archive/play`.
2. Copy only the minimal core modules needed for one playable loop; avoid importing the whole Vite shell.
3. Wrap state in the existing game save API contract:
   - save key: `primitive-archive-main`
   - version: `primitive-archive-v1`
   - summary: day, party, HP/hunger, camp level, inventory weight
4. Submit run/end summaries to `/game-records/primitive-archive`.
5. Once the slice works, mark the static catalog integration as prototype-ready.
