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
- Playable routes share lightweight Web Audio SFX for buttons, tabs, selects, navigation, and warning actions.
- Game routes resolve a lightweight SFX theme by slug. Common action buttons also distinguish gathering, combat, crafting, research, trade, saving, and other gameplay semantics, then layer the current game's short audio signature over the action cue.
- Every shared play shell now exposes a compact per-theme sound toggle. The setting persists by game sound theme and also gates state-driven result cues, while enabling and disabling sound use separate confirmation signatures.
- Hub/detail cards use object-only SVG icons. Feature tabs and common gameplay actions use object-only Lucide icons with no people, faces, hands, portraits, avatars, or humanoid silhouettes.
- Recent-result panels infer their object icon from the action label and result text, so operation, battle, research, market, school, and archive outcomes no longer fall back to text-only status rows.
- Dual Academy TCG and BA Vanguard also route their board-specific summon, chain, pass, shuffle, ride, guard, skill, zone, and replay controls through the shared icon/SFX layer while card surfaces keep their compact visual treatment.

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
    - Adapter: `asset-lab`
    - Why later: looks more like an asset/demo pack than a full game loop.
    - First slice: track/event logo audit, local pack JSON overlay, placeholder fallback preview, event card generation, save/load, audit record.

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

## Shared Tutorial Coverage

- A route-aware tutorial launcher is available on every registered game route without adding another global header item. It covers Eternal Hunger, Twenty Questions, Dual Academy TCG, BA Vanguard, Primitive Archive, Tonkatsu Teacher, Schale Idle RPG, BA SRPG, MyAnimeCraft Starleague, School Simulator, SI Coding Sim, Rail3D Sim, Company Report, and Racing Logos Demo.
- Every tutorial has a game-specific objective, estimated time, six ordered steps, an exact action to try, a completion check, two reminders, and two common mistakes. Progress is stored separately per game and resumes at the first unfinished step.
- The shared modal supports keyboard Escape close, focus entry, progress navigation, reset, previous/next/completion controls, object icons, game-themed synthesized cues, full-width mobile layout, and no horizontal overflow at 390px.

## Twenty Questions Feedback Status

- Routes: `/twenty-questions` and `/twenty-questions/[id]`.
- UI/UX: room creation, login/board navigation, refresh, room entry, questions, guesses, hints, host answers, closure, and history headings use explicit object icons. Async outcomes remain visible in a sticky feedback row instead of relying on transient toasts. Mobile header commands and filters use two-column groups, room summary metrics use two columns, and the page has no document-level horizontal overflow at 390px.
- Feedback: `twentyQuestionsFeedback.js` maps room creation, question submission, three host responses, correct/wrong guesses, hints, closure, refresh, and invalid requests to eleven result branches and dedicated synthesized cues. Empty-input and exhausted-attempt errors use the same persistent feedback surface as API errors.

## Primitive Archive Slice Status

- Route: `/games/primitive-archive/play`
- Included loop: party selection, fog-of-war region exploration, gather, hunt, craft, eat, rest, camp upgrades, four-season day rollover, death/end state, primitive/neolithic/ancient/classical tech-tree research, separate eureka and inspiration triggers, turn/day automatic RP, six multi-turn tribe projects, population growth, four job assignments, daily tribe production/consumption, rival tribe contact and diplomacy, research/project passives, run settlement, perk points, perk shop, and perk-applied new runs.
- Research progression: the 160 advancements are split into a 102-node T1-T22 technology tree and a 58-node C1-C20 social-institution tree. The classical era is rebalanced to 17 technologies and 13 social institutions; the medieval and early-modern expansions each contribute 24 technologies and 18 social institutions across faith, natural philosophy, literature, military, survival, and engineering branches. Same-track prerequisites always point to a lower stage, cross-track requirements remain explicit gates, costs rise through each track, the record path follows Writing -> Clay Tablets/Bookcraft -> Library -> Cathedral Schools/Papermaking -> Printing Blocks/University Tradition -> Movable Type/Print Workshop, and automatic target selection favors the lowest available stage. Research UI/automatic RP unlock after campfire, shelter, and workbench reach Lv.1; manual research actions unlock after T1 Gathering and Hunting are complete.
- Tech/content depth: ancient/classical branches add preserved rations, precision carving, obsidian hunting gear, megafauna hide armor, clay-tablet records, weather lore, agriculture/animal/mineral/river yield improvements, and cultural/archive bonuses with matching survival effects and differentiated rare-resource/megafauna exploration events.
- UI/UX: the growth tab uses searchable horizontal SVG maps with sticky T1-T22 technology and C1-C20 social-institution headers, stage names, node counts, era filters, prerequisite and follow-up navigation, completion highlights, eureka/inspiration state, readable unlock rewards, blockers, and one-click targeting. Before the research facilities unlock, read-only previews expose all 160 advancements, prerequisites, follow-ups, eureka/inspiration conditions, and unlock effects while keeping target assignment and research actions disabled. Classical, medieval, and early-modern nodes show branch-specific labels and icons, and entering a new era plays a dedicated synthesized cue. Track-specific stage labels also appear in research nodes, target dropdowns, and recommendation rows; narrow screens keep horizontal overflow inside the map canvas. A 13-region fog-of-war world map reveals connected frontiers through gather/hunt actions; before Cartography the game chooses among known regions, while Cartography unlocks exact region targeting. Region danger, yield, rare-resource bonuses, landmarks, visits, and discovery rewards affect the loop. A compact "one more turn" board forecasts season change, selected research, tribe-project completion, and exploration progress. Six multi-turn tribe projects consume resources once, accumulate work over actions, and add food, discovery, gathering, research, defense, or archive-score rules. The tribe/diplomacy tab presents population capacity, morale, growth progress, daily food demand, four fixed-size job steppers, production and auto-work ledgers, hidden rival identities before contact, relation meters, and trade/gift/knowledge-exchange/raid actions. Assignment, growth, and diplomacy use dedicated object icons and short synthesized cues alongside research completion, discoveries, project work/completion, season changes, and era advancement. The action tab shows the acting character's HP, hunger, stamina, and body temperature, and disables crafting when the selected recipe lacks materials. Camp actions show owned/required material counts and remain disabled until every requirement is met. The play shell separates current run difficulty from the next-run start difficulty presets and labels each start difficulty by recommended use, pressure profile, scoring, and starting supplies. The run report and archive report surface exploration event count, rare-material pressure, recent event text, direct recovery/rare-gear response actions, and active rare-resource/megafauna event-chain response buttons.
- Research map routing: nodes are ordered by survival/camp/craft/science/culture/spiritual/military/civics lanes and packed within each track-specific stage. T1-T4 technology density is 2/4/4/3, adjacent dependencies use the gutter between columns, skipped-stage dependencies use a faint dashed header bus, and focused dependencies receive the only high-emphasis route. The 173 full prerequisites produce 81 technology paths, 42 civic paths, and 50 cross-track inspector gates; automated geometry checks confirm that none of the 123 rendered paths crosses an unrelated node. Hunting -> Military Tradition -> Trapping is exposed as a cross-track progression rather than a forced T1-to-T4 technology line.
- Compact play workspace: the primary navigation is a single row for actions, map, party, camp, archive, research, tribe, equipment, and run management. Difficulty presets and settlement controls live in run management, while the latest result sits directly below the action buttons. Expected returns, facility descriptions, and owned equipment stay behind details controls; equipment editing no longer duplicates inside the survival screen. At 1024x900 the action panel begins around 458px instead of 1,070px, its buttons and result remain in the first viewport, and total document height is roughly 1,015px with no page-level horizontal overflow. At 390px, hero controls, metrics, and feature tabs scroll within their own rows while the action panel starts around 582px.
- Recipe gates: manual crafting and auto crafting now use the research tree's recipe unlocks, with prototype crafting only allowed when the recipe itself is the current tech's eureka trigger.
- Site API integration: quick save through `/game-saves/primitive-archive/primitive-archive-main`; run record through `/game-records/primitive-archive`.
- Asset integration: source portraits are copied to `client/public/games/primitive-archive/portraits`.
- Next step: playtest population growth, daily food pressure, job yields, diplomacy costs, discovery pacing, winter pressure, project work costs, and late-run event-chain reward/risk weights across several full runs, then tune the tribe economy before adding the next macro-strategy layer.

## Dual Academy TCG v13 Slice Status

- Route: `/games/dual-academy-tcg/play`; deck editor: `/games/dual-academy-tcg/deck`.
- Included loop: deck loading, 8000 LP duel state, MAIN1/BATTLE/MAIN2/END phases, 5 monster zones, 5 spell/trap zones, field card zone, normal summon, set, spell activation, field activation, target selection, chain prompt, counter-trap negate, battle, guard/pierce/shield keywords, enemy auto-play, room state sync, save/load, and match record.
- v13 event layer: draw, summon, set, effect, chain response, attack, phase, turn-start, prompt, win, and greet actions now emit a bounded duel event stream with Yuuka/Hina character callouts.
- v13 card layer: the uploaded Gehenna/Trinity/Millennium monster, spell, field, and counter-trap cards are mapped into the site card pool with simplified Monster/Spell/Trap zone behavior and playable effects for draw, damage, shield, destroy, banish, field ignition, and counter negation.
- UI/UX: duel tabs now include a zone inspection board that compares field power, open slots, deck/hand/grave resources, priority risks, and direct deck/grave/banished archive jumps. The compact turn coach and live event pulse keep the current recommendation, event type, actor, prompt, and chain state near the first viewport; desktop tabs begin inside the first 720px and mobile match metrics use a dense two-column grid without page-level horizontal overflow. Header commands, feature tabs, deck validation, hand actions, phase/effect controls, and archive jumps use explicit object icons, while spatial card zones remain uncluttered.
- Feedback: `dualAcademyTcgFeedback.js` compares match, LP, grave/banished, chain, prompt, event, turn, phase, and winner snapshots. Nineteen synthesized card-duel cues distinguish start, draw, summon, set, effect, chain, attack, hit/damage, destroy, negate, position, phase/turn, prompt/invalid, deck save, and victory/defeat. The play route waits for client hydration before rendering randomly identified duel state, preventing server/client character-quote mismatches.
- Site API integration: quick save through `/game-saves/dual-academy-tcg/quick-match`; room state sync through `/game-rooms/:id/state`; match result through `/game-records/dual-academy-tcg`.
- Source basis: `C:\2저장고\마이애니메\dual-academy-tcg-v13-fix-emitEvent`, especially the `emitEvent`/character quote flow from `src\duel\engine.ts` and `src\data\characters.ts`.
- Next step: deepen original card-specific effects such as Hina/Mika/Yuuka quick effects, cost selection prompts, extra deck/summon variants, and richer zone inspection modals.

## Tonkatsu Teacher Slice Status

- Route: `/games/tonkatsu-teacher/play`
- Included loop: ingredient buying, all 15 source recipes, six original cooking methods, method experience/level progression, facility/cosmetic production modifiers, menu sales, hall/delivery business mode, daily order settlement, all eight source students, student meal support, crit/evasion/attack-speed battle reward progression, facility upgrades, recipe research unlocks, cosmetic buying/equipment effects, tournament scoring/unlocks, and day rollover. Legacy five-student saves migrate to the complete roster and initialize missing method experience without changing the save slot.
- UI/UX: the first tab now opens the actionable kitchen loop before reports. Selected recipe planning summarizes material/cost readiness, method chain, success chance, mastery production, expected yield, sales margin, student fit, tournament gap, and the next recommended action. Kitchen and production views show compact method-level tracks with dedicated Lucide object icons and one-click sound previews; student support exposes crit, evasion, attack speed, preferences, weaknesses, and role notes. Craft controls stay disabled until unlock, gold, and ingredient requirements are all met.
- Feedback: fry, grill, boil, simmer, sauce, dessert, craft failure, and method-level-up have distinct synthesized result cues. A successful craft plays its primary method cue, failures and mastery gains override the initial click sound, and the existing serve, sales, order, tournament, judge, battle victory, and defeat signals remain connected to their outcomes. `npm run check:tonkatsu-teacher-feedback` covers source parity, legacy migration, deterministic crafting, mastery, battle forecast, icon mappings, and feedback cues.
- Site API integration: quick save through `/game-saves/tonkatsu-teacher/tonkatsu-teacher-main`; run record through `/game-records/tonkatsu-teacher`.
- Source basis: `C:\2저장고\마이애니메\tonkatsu_teacher_mvp_v0.4.5_judge_batch_banner`.
- Next step: port the original tournament-only profile and recipe buff/penalty matrix more deeply into combat, then tune method progression and kitchen margins across a full 14-day run.

## BA Vanguard Slice Status

- Route: `/games/ba-vanguard/play`
- Included loop: P-G card library, Gehenna/Trinity/Millennium sample deck presets, deck rule validation, opening-hand shuffle test, duel state, ride/call/retire, stride, VC act, battle declaration, boost, guard, G guardian, drive/damage checks, trigger effects, 6-damage win, and simple AI progression.
- UI/UX: the compact duel shell keeps nine primary metrics, the latest duel result, and four icon-led feature tabs near the first viewport. Header save/load/record/replay/room/detail commands and duel controls use explicit object icons, while spatial field circles remain icon-free selection tiles. Deck/drop/soul/damage/G zone inspection shows zone metrics, grade/type/trigger breakdowns, G-zone filters, and tactical advice rows. Desktop header commands use a stable four-column grid with zero text overflow, button overlap, or page-level horizontal overflow.
- Feedback: `baVanguardFeedback.js` compares turn, phase, battle, guard, hand, damage, log, stride, and winner snapshots. Nineteen synthesized card-duel cues distinguish start, invalid actions, draw, phase/turn, ride, stride, call, skill, attack, guard window, guard/perfect guard/block, trigger, hit/damage, and victory/defeat. AI continuation waits 180ms so an outcome cue finishes before the next guard warning; trigger effects are also written to the replay log.
- Site API integration: quick save through `/game-saves/ba-vanguard/ba-vanguard-main`; playtest record through `/game-records/ba-vanguard`.
- Source basis: `C:\2저장고\마이애니메\ba-vanguard`.
- Next step: evolve revision-based room snapshots into live turn-by-turn multiplayer sharing and deepen original card-specific skill coverage.

## MyAnimeCraft Slice Status

- Route: `/games/myanimecraft/play`
- Included loop: Starleague-style 10-team round-robin season, weekly fixtures, best-of-five team matches, standings, map pool, team roster inspection, sponsor negotiation, training investment, FA signing, player contracts, contract renewal/release, economic logs, season reports, payroll carryover, season rollover.
- UI/UX: match replay now stores broadcast headlines, turning points, event-beat key scenes, tempo labels, V2 role-split caster/analyst timelines, replay-center breakdowns, bench reactions, build-pick reasoning, and a series replay report that summarizes the scoreline, key set, build tendency, map spread, and replay highlights across regular league, personal league, and Winners League sets. Personal League V2 preliminary reports now surface seed tiers, race distribution, form/rating averages, and lower-seed breakthrough stories. A rivalry archive now derives head-to-head records from regular league, postseason, Personal League, and Winners League set history. The league tab now has a postseason briefing that tracks seed routes, next matchup pressure, upset stories, champion state, and bracket notes. The market tab now includes a front-office report that evaluates trade acceptance, value gap, team-power change, payroll change, suggested cash adjustment, warnings, and priority shop purchases. Major league, sponsor, contract, release, transfer, shop, and equipment commands now use dedicated object icons and semantic cues; regular matches branch into neutral broadcast, selected-team victory, selected-team defeat, and championship result stingers. Replay style aggregation now uses the existing build-style validator instead of the missing normalizer that previously crashed after the first match.
- Site API integration: quick save through `/game-saves/myanimecraft/myanimecraft-main`; league snapshot record through `/game-records/myanimecraft`.
- Source basis: `C:\2저장고\마이애니메\starleague-masterdata.json` and `C:\2저장고\마이애니메\myanimecraft`.
- Next step: tune event-beat timing, upset frequency, and front-office recommendation weights after playtesting several full seasons, then continue porting deeper original `simulateSet` details where they materially improve match variety.

## Schale Idle RPG Slice Status

- Route: `/games/schale-idle-rpg/play`
- Included loop: idle floor settlement, stamina recovery, equipment crafting, UID equipment inventory, direct equipment swapping, equipment lock/favorite protection, UID presets, equipment enhancement, equipment option affixes/reroll, safe salvage queue/auto salvage, Trial Tower attempts, rotating tower token shop, mission rewards, inventory/equipment summary.
- UI/UX: the playable duty tab now opens first, crafting shows owned/required materials and disables unaffordable recipes, and the equipment tab exposes every owned UID with score, equipped/reserve state, direct equip, lock, and favorite controls. Equipment tuning still recommends high-value affix locks, low-option rerolls, and next enhancement targets with direct action buttons. Affix lock planning surfaces the post-lock reroll cost, lock surcharge, currency shortage, and reroll readiness before the player commits. The compact play shell keeps ten primary metrics, a one-line growth coach, the latest result, and six icon-led feature tabs near the first viewport; mobile hero controls, metrics, and tabs scroll inside their own rows. Duty settlement, tower clear/failure, enhancement success/failure, crafting, reward, reroll, salvage, shop purchase/refresh, research, equip, lock, favorite, and preset outcomes use distinct idle-theme cues.
- Site API integration: quick save through `/game-saves/schale-idle-rpg/schale-idle-rpg-main`; account-progress snapshot through `/game-records/schale-idle-rpg`.
- Source basis: `C:\2저장고\EternalHunger\myanime\Schale_idle_rpg_v1_34`.
- Save migration: `schale-idle-rpg-v2` accepts the previous site slot-object save shape and the original v1.34 `inventory.stack/equip` plus slot-to-UID shape without dropping reserve equipment.
- Next step: import the original enhancement protection/pity/destruction policy and expand the item/equipment catalog where those rules add meaningful build choices.

## BA SRPG Slice Status

- Route: `/games/ba-srpg/play`
- Included loop: mission selection, tactical grid movement, AP, range, destructible cover/obstacle tiles, enemy phase, mission rewards, inn rest with daily property settlement, crafting, discounted shop purchases, equipment, guild rank table, daily/weekly/monthly/yearly quest cadence, property buy/rent/lease/upgrade, monthly edicts, guild quest reporting, expanded formation roster, student-specific tactical skill lists, and property/town facility state. Tactical skills now execute the source rule order for cover damage, damage, shield/heal, HighestOnly stat modifiers, and status chance; overwatch reactions, smoke zones, area flash, burst fire, marking, suppression, rally, and advance-on-hit are live combat state rather than description-only data.
- UI/UX: battle tab now includes a tactical HUD that compares normal attacks and student-owned skills by expected damage, status chance, AP cost, target, cover damage, area count, modifier value, and direct execution readiness. The board displays smoke coverage, overwatch stance, live cover durability, and destroyed cover without changing tile dimensions. A mission overlay summarizes the active mission objective, star conditions, turn pressure, power gap, rewards, high-priority threats, and tactical recommendations. Tactical pressure is surfaced in forecasts with DoT tick damage, shields, stun skips, confusion accuracy penalties, active buffs/debuffs, smoke penalties, overwatch exposure, and dynamic cover. The mission prep tab recommends mission-specific formation presets and formation cards expose each student's tactical profile and usable skills. Deploy, formation, movement, overwatch, reaction fire, smoke, cover break, buffs, debuffs, status application/resistance, burst, wait, turn, auto, property, edict, equipment, quest-claim, and shop controls/results use tactical object icons and distinct synthesized cues.
- Site API integration: quick save through `/game-saves/ba-srpg/ba-srpg-main`; tactical-grid snapshot through `/game-records/ba-srpg`.
- Source basis: `C:\2저장고\EternalHunger\myanime\ba-srpg\ba-srpg-frontend`, especially `public/data/docs/systems/RuntimeRules_SkillsAndStatus.md`, `public/data/docs/data/Skills.sample.json`, and the monolithic `src/App.tsx` game flow.
- Next step: add mission-specific map events, objective tiles, enemy skill patterns, and property specialization branches.

## School Simulator Slice Status

- Route: `/games/school-simulator/play`
- Included loop: weekly school operations, policy presets, AP/budget spending, student growth/stress, teacher fatigue/morale, facility condition, subject policy/presentation actions, admissions campaigns, career counseling, club recruitment/showcases, festival planning, exam weeks, semester reports, rest action, and school score summary.
- UI/UX: student and staff/facility care boards rank risk targets and provide direct counseling, career, maintenance, and teacher-action buttons. The compact play shell keeps all 12 headline metrics in a horizontal micro summary, collapses the school coach by default, and pins the latest operation result above the feature tabs. Detailed operation groups now render through nested weekly-operation, people/event, vision/incident, and report tabs instead of one continuous stack; school stat blocks stay in a dense two-column mobile grid. Header, care, policy, class, club, festival, event, and semester controls use object icons. Policy, counseling, lesson, festival, semester, and incident transitions use distinct synthesized cues; a 12-week browser run verified event, festival-completion, normal-advance, and semester-transition cues.
- Site API integration: quick save through `/game-saves/school-simulator/school-simulator-main`; term-report snapshot through `/game-records/school-simulator`.
- Source basis: `C:\2저장고\마이애니메\school-simulator-step23` JavaScript simulation, seeds, and Step 23 UI flow.
- Next step: import the original full classroom model, teacher relation events, long-term evaluation rules, and per-student/per-facility modal detail screens behind the site save/record shell.

## SI Coding Sim Slice Status

- Route: `/games/si-coding-sim/play`
- Included loop: Step AQ/AR task pack loading, task selection, code file editing, report writing, hint reveal cost, includes/notIncludes/anyIncludes judge rules, resource settlement, project grade evaluation, and run log.
- UI/UX: the compact play shell keeps the field coach, latest result, and seven icon-led feature tabs in the first viewport. The submission readiness panel previews static checks, report, document, and hint status, then jumps directly to the needed work tab. Task-pack loading, project opening, code/document/hint navigation, submission, reset, company support, audit, and follow-up project selection use explicit object icons instead of unlabeled percentage or point-only buttons.
- Feedback: failed, passed, and perfect submissions; approved or rejected project evaluations; hint reveals; and company support spending emit distinct synthesized coding-theme result cues. Browser checks verified `codeFail`, `hintOpen`, `support`, and `projectRejected` state transitions.
- Site API integration: quick save through `/game-saves/si-coding-sim/si-coding-sim-main`; challenge-score snapshot through `/game-records/si-coding-sim`.
- Source basis: `C:\2저장고\마이애니메\si-coding-sim_stepAQ_AR\prototype\data\task-pack-stepAQ_AR.json` and `data\judge-rules.json`.
- Next step: import the original execution harness, contract negotiation, follow-up branch depth, seed generation depth, and career progression UI.

## Rail3D Sim Slice Status

- Route: `/games/rail3d-sim/play`
- Included loop: sample track/service data loading, timetable step progression, station dwell/run/done phases, block occupancy, STOP/GO signal state, delay/wait summary, SVG minimap, and route-score record snapshot.
- UI/UX: the compact operating shell keeps all 10 headline metrics visible, pins the latest operating result above the tabs, provides horizontally scrollable icon tabs, and gives every dispatch/train/analysis control an explicit action icon. The operations tab includes a dispatch plan that prioritizes waiting trains, recommended lookahead changes, timetable headway checks, and direct jumps into train or bottleneck analysis.
- Feedback: state-diff feedback distinguishes ordinary rail steps, departures, station arrivals, STOP signals, token waits, signal release, lookahead adjustment, train completion, and full service completion. The dispatch-plan callback is now wired through the feature tabs, and legacy `sM` train poses are normalized so a waiting train never renders as `NaNm`.
- Site API integration: quick save through `/game-saves/rail3d-sim/rail3d-sim-main`; transport-sim snapshot through `/game-records/rail3d-sim`.
- Source basis: `C:\2저장고\마이애니메\rail3d-sim\src\data\sampleTrack.json`, `sampleService.json`, and the MVP debug loop structure from `src\engine\mainLoop.ts`.
- Next step: port the original route cache, dynamic timetable editing, richer MiniMap overlays, and eventually a dedicated Three.js 3D view.

## Company Report Slice Status

- Route: `/games/company-report/play`
- Included loop: company status, partner credit, order creation, shipment, inventory inbound, receivable collection, marketing campaign, month-end settlement, ledger snapshot, and latest snapshot restore.
- UI/UX: the compact management board prioritizes receivable collection, shipping, VAT, global receivables, disclosure risk, snapshots, and ledger follow-up actions. The full input/audit surface is preserved behind a dedicated `상세 원장` tab instead of rendering a second copy below the tabs, and the guidance panel stays compact until expanded.
- Feedback: trade, shipment, production, VAT, closing, global settlement, capital-market, archive, and restore controls use explicit Lucide action icons. Successful ledger outcomes emit distinct synthesized result cues in addition to the control click sound.
- Site API integration: quick save through `/game-saves/company-report/company-report-main`; ledger-score snapshot through `/game-records/company-report`.
- Source basis: `C:\2저장고\마이애니메\company-report-stepg6-ledger-physical-restore` Spring Boot ledger/report project, especially company, trade order, inventory, receivable, settlement, report, and ledger snapshot/restore flows.
- Next step: connect the simplified in-memory ledger diff/restore model to an optional API-backed audit store and add richer long-run business scenarios.

## Racing Logos Demo Slice Status

- Route: `/games/racing-logos-demo/play`
- Included loop: core track/event data, local pack JSON overlay, local logo candidate priority, public placeholder fallback, region/surface filtering, logo pack audit, and simple race card generation.
- UI/UX: the compact asset-lab shell keeps eight headline metrics, the latest audit result, and nine horizontally scrollable icon tabs in the first viewport. The audit board includes an asset production queue, draft local-pack JSON preview, one-click sample pack application, and direct jumps into calendar or result-card follow-up work. Save/load/record/detail, audit, card generation, pack editing, and queue commands now use explicit object icons; the desktop page has no document-level horizontal overflow.
- Feedback: logo audits, perfect 100% audits, local-pack apply/clear/invalid outcomes, event cards, and season cards emit distinct synthesized racing/asset-lab cues. Browser state checks verified `logoAudit`, `logoAuditPerfect`, `packApply`, `packClear`, `packInvalid`, `raceCard`, and `seasonCard` transitions.
- Site API integration: quick save through `/game-saves/racing-logos-demo/racing-logos-main`; asset-audit snapshot through `/game-records/racing-logos-demo`.
- Asset integration: public placeholder SVGs are copied to `client/public/games/racing-logos-demo/logos/_placeholder`; private real logos remain outside git under `/local_pack/logos`.
- Source basis: `C:\2저장고\마이애니메\racing-logos-demo`.
- Next step: add optional private logo-pack deployment instructions and split real racing calendars/results into a separate data pack.
