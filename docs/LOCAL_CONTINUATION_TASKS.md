# Local Continuation Tasks

Updated: 2026-07-17 KST
Latest pushed commit: check `git log -1 --oneline origin/main` after pulling.

This document is the handoff list for continuing work on another machine.

## Start Here

1. Pull the latest main branch.

```powershell
git pull origin main
```

2. Enter the client app and make sure dependencies exist.

```powershell
cd client
npm install
```

3. Run a quick baseline check before editing.

```powershell
npm run build
```

## Current State

- Eternal Hunger `/simulation` now classifies major world events separately from ordinary logs. A compact persistent event strip and eleven dedicated synthesized cues cover hyperloop, kiosk revival, dimension-rift opening/battle, boss spawn/defeat, core objectives, legendary/transcendent supply, special crafting, and sudden death. Automatic play keeps ordinary movement/farming silent and suppresses repeated hyperloop/crafting cues; `npm run check:eternal-hunger-feedback` guards the transition priority and icon/sound wiring.
- Eternal Hunger now has six original procedural soundtrack scenes: ready, day, night, combat, final zone, and result. The loops span 32-48 bars (about 71-105 seconds), rotate A/B/C motifs by phrase, use eight-bar chord variations and late key shifts, and crossfade from day/night ambience into temporary combat cues. Its dedicated palettes add string ensemble, synth pulse, ghost snare, and ride cymbal layers on top of the shared 18-role score; combat and final-zone tracks use separate 149/154 BPM assault grooves. No reference samples or melodies are stored in the repository. `npm run check:eternal-hunger-soundtrack` validates all six profiles and state wiring.
- Eternal Hunger pregame setup exposes random or custom 24-character selection. `SimulationPregameRosterSetup.js` keeps the cockpit compact while its modal supports search, exact-count selection, and manual 8x3 squad assignment; the latest direct roster is persisted in reserved preset id `__custom__` without reducing the 10 named-preset allowance. `customRosterRuntime.js` is the shared validator and `npm run check:custom-roster` covers duplicate, missing-team, balanced-squad, solo, and persistence wiring.
- Eternal Hunger character settings now persist a multi-select `erWeapons` pool and choose one run-locked weapon when the initial roster is built. Eight additional weapon groups have metadata, combat skills, and generated item fallbacks; `npm run check:er-weapons` guards normalization, selection, UI wiring, and run-lock behavior.
- Heal/shield skill-amplification coefficients now scale their support value instead of becoming damage against the support target. `npm run check:skills` includes an ally shield regression with nonzero skill amplification.
- Shared `GamePlayShell` routes now include a compact per-theme sound toggle backed by `gameSfxPreferences.js`. The preference persists by theme and is honored by both control sounds and state-driven result cues. All 13 SFX themes share one dynamics-controlled Web Audio session with per-theme stereo width and short synthesized reverb, so layered outcomes gain space without multiplying audio contexts or blurring single clicks. `RecentActionResult` also infers an action icon from its label/result context, covering more than 40 existing result panels without page-specific wiring. Shared action icons remove people and hand silhouettes and distinguish diplomacy, counseling, sponsorship, jobs, participants, production, logistics, finance, analysis, document review, collection, and deck actions with object symbols. `check:game-feedback-shell` guards route themes, spatial mixes, shared output processing, preference storage, dedicated cue coverage, and object-only feedback icon coverage.
- Shared game audio now includes 13 original procedural BGM profiles covering 15 route families. Each base route profile has a 288-step, 18-bar arrangement with at least six named sections, while the engine exposes 22 roles spanning A/B/C lead material, harmony and octave doubles, counter melody, arpeggio, bass, inverted/extended pads, string ostinato and ensemble, brass stabs, bell accents, choir pads, sub-bass, synth pulse, and eight drum/transition roles. `GameBgmProvider` gives the added orchestration a dedicated mix bus and game-style palette, then combines it with section impacts, noise-and-pitch risers, filter sweeps, open-hat/tom fills, ghost notes, ride cymbals, kick-driven pumping, stereo placement, delay, synthesized reverb, route crossfades, hidden-tab fades, and SFX-triggered ducking while preserving gesture unlock and global enable/volume preferences. Tutorial-supported routes expose SFX, BGM, and music volume through one compact fixed utility dock; `check:game-feedback-shell` validates arrangement length, section integrity, all 22 roles, climax orchestration, extended voicings, theme variety, and ducking contracts.
- `client/src/app/games/company-report/play/page.js` is roughly 380 lines and delegates panels, persistence, selections, and derived view data.
- Company Report tab UI now lives in `client/src/app/games/company-report/_components/CompanyReportFeatureTabs.js`.
- Company Report lower detail panel layout now lives in `client/src/app/games/company-report/_components/CompanyReportDetailPanels.js` and is mounted only inside the `상세 원장` feature tab, avoiding a duplicated full-page render.
- Company Report lower detail feature groups now live in:
  - `client/src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportGlobalCapitalPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportManagementPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportVatInventoryPanels.js`
- Company Report shell metrics and message builders now live in `client/src/app/games/company-report/_lib/companyReportPageRuntime.js`.
- Company Report read-only play view model now lives in `client/src/app/games/company-report/_lib/companyReportPlayViewModel.js`.
- Company Report save/load/record actions now live in `client/src/app/games/company-report/_hooks/useCompanyReportPersistence.js`.
- Company Report controlled selections now live in `client/src/app/games/company-report/_hooks/useCompanyReportSelections.js`.
- Company Report now uses a compact hero, micro summary, collapsible guidance panel, horizontally scrollable feature tabs, and dense business stat cells. `client/src/app/games/company-report/_lib/companyReportFeedback.js` classifies 24 ledger transitions, and the page uses a latest-state ref so rapid actions cannot overwrite each other. Twelve result panels receive the same action icon/tone, state-changing buttons suppress their preliminary click cue, and `npm run check:company-report-feedback` exercises the real engine flows plus 23 required result cues.
- School Simulator feature tabs now live in `client/src/app/games/school-simulator/_components/SchoolSimulatorFeatureTabs.js`.
- School Simulator advanced/detail operation tab is split into:
  - `client/src/app/games/school-simulator/_components/SchoolSimulatorAdvancedTab.js`
  - `client/src/app/games/school-simulator/_components/SchoolSimulatorAdvancedVisionEvents.js`
  - `client/src/app/games/school-simulator/_components/SchoolSimulatorAdvancedOperations.js`
  - `client/src/app/games/school-simulator/_components/SchoolSimulatorAdvancedReports.js`
  - `client/src/app/games/school-simulator/_components/SchoolSimulatorAdvancedPeople.js`
- School Simulator student/staff care report logic now lives in `client/src/app/games/school-simulator/_lib/schoolSimulatorCareReport.js`.
- School Simulator save/load/record actions now live in `client/src/app/games/school-simulator/_hooks/useSchoolSimulatorPersistence.js`.
- School Simulator controlled selections now live in `client/src/app/games/school-simulator/_hooks/useSchoolSimulatorSelections.js`.
- School Simulator derived rows and selected entity assembly now live in `client/src/app/games/school-simulator/_lib/schoolSimulatorPlayViewModel.js`.
- School Simulator now uses a compact hero/advisor/result shell, dense responsive stat grids, and nested advanced tabs for weekly operations, people/events, vision/incidents, and reports. Header and care-board commands use shared icon controls. Its feedback classifier now covers 21 school-specific transitions, including ordinary operation categories such as counseling, lessons, maintenance, teacher support, admissions, career guidance, clubs, rest, and vision as well as policy/week changes, incidents, crises, festivals, and semesters. All 19 pinned and tab-local result surfaces share the transition-specific icon, label, and tone, while state-changing controls suppress preliminary click cues so only one dedicated result sound plays. `check:school-simulator-feedback` validates the icon/cue matrix and wiring.
- SI Coding Sim save/load/record actions now live in `client/src/app/games/si-coding-sim/_hooks/useSiCodingSimPersistence.js`.
- SI Coding Sim derived rows/current task/readiness assembly now lives in `client/src/app/games/si-coding-sim/_lib/siCodingSimPlayViewModel.js`.
- SI Coding Sim submission readiness calculation now lives in `client/src/app/games/si-coding-sim/_lib/siCodingSubmissionReadiness.js`.
- SI Coding Sim submission readiness panel and result row now live in `client/src/app/games/si-coding-sim/_components/SiCodingSubmissionReadinessPanel.js`.
- SI Coding Sim large feature tab JSX now lives in `client/src/app/games/si-coding-sim/_components/SiCodingSimFeatureTabs.js`.
- SI Coding Sim feature tabs are split into:
  - `client/src/app/games/si-coding-sim/_components/SiCodingFieldTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingTasksTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingDocsTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingCodeTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingCareerTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingAuditTab.js`
  - `client/src/app/games/si-coding-sim/_components/SiCodingAdvancedTab.js`
- SI Coding Sim now uses a compact hero, micro summary, minimal field coach, dense responsive stats, and horizontally scrollable icon tabs. All feature buttons use explicit action semantics; `client/src/app/games/si-coding-sim/_lib/siCodingSimFeedback.js` maps submission, project evaluation, task selection/reset, document review/undo, hint, hint-cost support, QA risk support, and next-project selection/deployment to 15 coding-theme result states. Log-free document checkbox changes receive persistent result text instead of falling back to an unrelated older log.
- Schale Idle RPG save/load/record actions now live in `client/src/app/games/schale-idle-rpg/_hooks/useSchaleIdlePersistence.js`.
- Schale Idle RPG derived rows/reports/selected entity assembly now lives in `client/src/app/games/schale-idle-rpg/_lib/schaleIdlePlayViewModel.js`.
- Schale Idle RPG equipment tuning helpers now live in `client/src/app/games/schale-idle-rpg/_lib/schaleEquipmentTuning.js`.
- Schale Idle RPG large feature tab JSX now lives in `client/src/app/games/schale-idle-rpg/_components/SchaleIdleFeatureTabs.js`.
- Schale Idle RPG feature tabs are split into:
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdlePlanTab.js`
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdleSeasonTab.js`
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdleSyncTab.js`
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdleDutyTab.js`
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdleGearTab.js`
  - `client/src/app/games/schale-idle-rpg/_components/SchaleIdleRecordsTab.js`
- Schale Idle RPG now uses a compact hero, ten primary micro metrics, a one-line growth coach, dense responsive stat cells, explicit feature-tab icons, and contained mobile scrollers. The default tab order starts with duty and equipment rather than reports. `schale-idle-rpg-v2` stores every equipment instance in a UID inventory, migrates both the previous site save shape and the original v1.34 `inventory.stack/equip` shape, and supports direct equip, UID presets, lock/favorite protection, and safe salvage. The original v1.34 enhancement rules are now live: per-item costs and penalties, soft pity, a ten-failure hard pity, automatic/specialized protection-ticket selection, configurable protection priority, configurable post-protection pity handling, downgrade, and true destruction with preset cleanup. The duty tab previews effective success rate, pity, penalty, all costs, protection stock, and planned protection use while guarding unaffordable attempts. `schaleIdleFeedback.js` separates normal success/failure from hard-pity success, protection activation, downgrade, and destruction with dedicated icons and synthesized cues; login-only sync guidance remains in the sync tab.
- Dual Academy TCG zone-inspection/page helper logic now lives in `client/src/app/games/dual-academy-tcg/_lib/tcgPlayPageRuntime.js`.
- Dual Academy TCG deck load/save/room sync/record persistence now lives in `client/src/app/games/dual-academy-tcg/_hooks/useDualAcademyTcgPersistence.js`.
- Dual Academy TCG large feature tab JSX now lives in `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgFeatureTabs.js`.
- Dual Academy TCG feature tabs are split into:
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgBoardTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgAdvisorTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgInspectTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgLogsTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgHandTab.js`
- Dual Academy TCG now uses a compact turn coach, an icon-led live duel event pulse, explicit header/deck/board action icons, two-column mobile match metrics, and accessible card-count controls. `dualAcademyTcgFeedback.js` maps match snapshots to the shared duel cues plus dedicated Mika cost/negate/burst, Hina discipline/recovery, and Yuuka guard/search feedback. The engine ports Mika's costed quick negate and battle boost, Hina's battle recovery, and Yuuka's turn-based target protection with deterministic regression coverage. Client-only duel rendering also prevents random match/event IDs from causing character-quote hydration mismatches.
- Primitive Archive page helper logic now lives in `client/src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js`.
- Primitive Archive save/load/record actions now live in `client/src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js`.
- Primitive Archive large feature tab JSX now lives in `client/src/app/games/primitive-archive/_components/PrimitiveArchiveFeatureTabs.js`.
- Primitive Archive feature tabs are split into:
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveActionWorkspace.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveWorldMap.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchivePartyWorkspace.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveCampWorkspace.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveReportTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveGrowthTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveTribeTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveInventoryTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveRunTab.js`
- The user-facing game name is now `Civilization Archive` / `문명 아카이브`; the `primitive-archive` route, save identifiers, and `PrimitiveArchive*` implementation names remain unchanged for save and link compatibility. `원시` remains the opening era name.
- Primitive Archive now exposes actions, map, party, camp/report, archive, research, tribe, inventory, and run management in one top-level tab row. The latest result is inside the action dock, the turn forecast follows the controls, and difficulty/record/settlement controls moved into run management. At 1024x900 the action panel starts near 458px rather than 1,070px and the document is about 1,015px tall; mobile hero controls, metrics, and tabs use contained horizontal scrolling instead of extending the page width.
- Primitive Archive play route content now lives in `client/src/app/games/primitive-archive/_components/PrimitiveArchivePlayContent.js`; `play/page.js` is now a thin entrypoint.
- Primitive Archive ancient research branches now include preserved rations, precision carving, obsidian gear, megafauna hide armor, clay-tablet records, and weather lore; auto craft, research passives, food handling, hunt risk, and unlock labels are wired through the engine/UI helpers.
- Primitive Archive research planner now has an expandable detail modal, and `researchPlannerRows` applies ancient-era pressure weighting for food scarcity, cold exposure, rare resources, megafauna risk, and archive progression.
- Primitive Archive development now separates 150 technologies from 94 social institutions. The Growth tab exposes a `Technology / Civics` switch: technologies use RP and Eureka, civics use CP and Inspiration, while cross-tree prerequisites remain visible and enforceable. Legacy unified research saves migrate civic progress into the civics state during normalization.
- Primitive Archive research spans T1-T38 and C1-C32. The classical era has 17 technologies and 13 social institutions, while the medieval, early-modern, early modern-period, and late-modern expansions each add 24 technologies and 18 social institutions across faith, natural philosophy, literature, military, survival, and engineering branches. The late-modern layer adds electrical generation, telephony, organic chemistry, antiseptic surgery, internal combustion, periodic law, electric grids, X-rays, wireless telegraphy, automobiles, powered flight, motion pictures, blood typing, research universities, social insurance, mass journalism, standard time, international law, labor unions, universal suffrage, and religious pluralism. Every technology has an eureka and every social institution has an inspiration. Same-track prerequisites always point to a lower stage, cross-track requirements remain explicit inspector gates, automatic target selection favors the lowest available stage, and the record branch continues from mass publishing through telephone and phonograph into wireless telegraphy and motion pictures. Campfire + shelter + workbench Lv.1 unlock target selection and turn/day automatic RP; completing T1 Gathering + Hunting unlocks the manual research action.
- Primitive Archive's research map shows track-specific T/C headers with stage names and node counts, includes those labels in nodes/dropdowns/recommendations, and keeps only the map canvas horizontally scrollable on narrow screens. Before research unlocks, `PrimitiveArchiveResearchTreePreview.js` exposes all 244 advancements, prerequisites, follow-ups, eureka/inspiration conditions, and unlock effects as read-only T1-T38 and C1-C32 trees; the gate includes a direct jump button while target assignment and research remain locked. Classical through late-modern nodes expose branch-specific text and icons, and the first completion in each later era triggers a dedicated era-advance sound cue.
- Primitive Archive advancement lore applies 60 compact Civilization-style display-name overrides without changing save IDs. All 244 technology and civic nodes receive an explicit topic-matched quotation with author, work, and source URL. The 78-theme, 66-source map has no generic fallback or duplicate assignment and is rendered in both the locked tree preview and live research inspector. Dedicated guards now also cover late-modern electricity, telephony, periodic law, pasteurization, powered flight, motion pictures, welfare, journalism, international law, suffrage, and pluralism.
- Primitive Archive research layout is branch-aware and compact per stage. Early technology density is 2/4/4/3 across T1-T4, dependency paths use orthogonal column gutters, skipped-stage links use a low-emphasis dashed header bus, and selected-node links override those styles for inspection. The 457 full prerequisites split into 191 rendered technology links, 116 rendered civic links, and 150 cross-track inspector gates; automated geometry checks prove that rendered paths do not cross unrelated nodes. Long conceptual progressions such as Hunting -> Military Tradition -> Trapping are shown as cross-track follow-ups instead of forced lines across unrelated technology columns.
- Primitive Archive stores eureka and inspiration separately, shows prerequisites/follow-up technologies in the SVG tree, briefly highlights completed nodes, randomizes gather/hunt zones before Cartography, enables zone selection afterward, and shows per-action expected returns in the survival tab.
- Primitive Archive now has a 13-region fog-of-war world map, connected frontier discovery, region danger/yield/landmark/visit data, four six-day seasons, a compact "one more turn" forecast, and six resource-committed multi-turn tribe projects. Cartography changes known-region random actions into direct region selection; project and season effects are wired into food, discovery, gathering, research, hunt/weather defense, and score. The new discovery/project/season controls use object-only Lucide icons and dedicated synthesized cues.
- Primitive Archive now connects research and exploration to a tribe economy: population capacity and growth, forager/hunter/builder/scholar assignment, deterministic daily production and food consumption, builder project work, scholar research, three discoverable rival tribes, and once-per-day trade/gift/knowledge-exchange/raid diplomacy. The dedicated tribe/diplomacy tab uses object-only icons, fixed-size assignment controls, responsive rival cards, and distinct assignment/growth/diplomacy cues.
- Primitive Archive action feedback now uses 23 action profiles and 12 milestone profiles across seven local result panels. Action, camp, growth/project, tribe/diplomacy, and equipment controls share dynamic icons, labels, tones, persistent text, and click-sound suppression; save/load/auth messages use the same presentation. `check-primitive-archive-feedback.mjs` protects the matrix and a latest-state wrapper prevents rapid consecutive actions from applying to stale run state.
- Primitive Archive now has seven original dynamic soundtrack scenes: survival, frontier, insight, settlement, crisis, era advance, and legacy. The controlled feature tab selects exploration/research/settlement music, survival vitals can override any working tab with the crisis track, and milestone cues temporarily crossfade into discovery, breakthrough, settlement, or era music before returning to the current state. The 32-40 bar arrangements use A/B/C motif rotation, eight-bar harmony, extended chords, string ensemble, synth pulse, ghost snare, ride cymbal, and late key shifts. `check:primitive-archive-soundtrack` guards scene priority, milestone timing, loop depth, orchestration, and UI wiring.
- The shared audio popover now displays the active soundtrack title and its object-only scene icon. Every base BGM profile and both dynamic soundtracks expose icon metadata, while the compact fixed utility dock keeps this added context out of the game viewport until opened.
- All 14 registered games now use the global route-aware `GameTutorialLauncher`. Game-specific tutorial content lives in `client/src/app/games/_lib/gameTutorials.js`; each route gets six ordered steps with a concrete action, completion check, reminders, mistakes, per-game local progress, object icons, and theme-specific cues. The launcher is absent on non-game routes and does not add another header item.
- BA Vanguard large feature tab JSX now lives in `client/src/app/games/ba-vanguard/_components/BaVanguardFeatureTabs.js`.
- BA Vanguard feature tabs are split into:
  - `client/src/app/games/ba-vanguard/_components/BaVanguardDuelTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardTacticsTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardHandLogTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardDeckTab.js`
- BA Vanguard save/load/record and room synchronization actions now live in `client/src/app/games/ba-vanguard/_hooks/useBaVanguardPersistence.js`.
- BA Vanguard playtest summary builder now lives in `client/src/app/games/ba-vanguard/_lib/baVanguardPageRuntime.js`.
- BA Vanguard play route content now lives in `client/src/app/games/ba-vanguard/_components/BaVanguardPlayContent.js`; `play/page.js` is now a thin Suspense shell.
- BA Vanguard now uses a compact hero, nine primary micro metrics, a minimal duel coach, a pinned latest result, icon-led feature tabs, and icon controls for save/load/record/replay/room/detail commands. `baVanguardFeedback.js` maps duel snapshots to 23 result states backed by 22 distinct cues, including call/retire, deck out, and replay feedback; the duel and hand tabs repeat the shared latest result next to their controls. Ride actions enforce normal-unit grade progression and one ride per turn, expose readiness/rejection reasons in both action tabs, and use a one-for-one deck exchange ride assist when the required next grade is missing from hand. Its route now uses a dedicated `vanguard` audio theme with wider stereo/reverb ride, stride, attack, guard, trigger, hit, damage, deck-out, victory, and defeat cues. Seven original soundtrack scenes span ready, ride, battle, guard, trigger/climax, victory, and defeat states; 28-44 bar, 65-second-or-longer arrangements use three rotating motifs, four-note voicing, eight-bar harmony, late key shifts, and the full 22-role orchestration. Controlled tabs and live duel pressure choose the base track, while feedback results temporarily crossfade into matching action music. `check-ba-vanguard-feedback.mjs` drives real engine transitions for phase, draw, direct/assisted/invalid ride, call, retire, stride, skill, attack, guard, perfect guard, block, hit, damage, turn, victory, defeat, and deck out, and `check:ba-vanguard-soundtrack` verifies all seven profiles, transition priorities, route isolation, scene icons, and themed cues. Production-browser verification covered new duel, invalid AI progress, draw, phase, successful ride, result icons/tones, zero console errors, and a 375px content viewport with no page-level horizontal overflow or clipped control labels.
- Tonkatsu Teacher large feature tab JSX now lives in `client/src/app/games/tonkatsu-teacher/_components/TonkatsuTeacherFeatureTabs.js`.
- Tonkatsu Teacher feature tabs are split into:
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuOperationsTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuTutorialTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuProductionTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuKitchenTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuStudentsTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuGrowthTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuJudgeTab.js`
  - `client/src/app/games/tonkatsu-teacher/_components/TonkatsuAdvancedTab.js`
- Tonkatsu Teacher now imports all six source cooking methods and eight students, migrates legacy five-student saves, and tracks method mastery that affects success and production. Its actionable tab order starts with kitchen, students, and growth; compact method tracks expose process icons, sound previews, and deterministic result cues for fry, grill, boil, simmer, sauce, dessert, craft failure, and mastery gain. Student crit, evasion, attack speed, preferences, and weaknesses now affect the shared battle forecast used by both UI and combat. `tonkatsuTeacherFeedback.js` also classifies 24 management outcomes across purchasing, sales, orders, serving, facilities, research, cosmetics, business mode, combat, tournaments, judging, day rollover, completion, and blocked actions. The pinned result row receives the matching Lucide icon and tone, while state-changing buttons suppress their preliminary click cue so only the actual outcome sound plays.
- BA SRPG large feature tab JSX now lives in `client/src/app/games/ba-srpg/_components/BaSrpgFeatureTabs.js`.
- BA SRPG feature tabs are split into:
  - `client/src/app/games/ba-srpg/_components/BaSrpgMissionTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgCampaignExpansionTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgTownTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgBattleTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgInventoryTab.js`
- BA SRPG battle tab now has a mission overlay fed by `getBattleMissionOverlay`, showing active objective, star conditions, turn pressure, power gap, rewards, priority threats, and recommendations.
- BA SRPG mission prep now has mission-specific formation presets fed by `formationPresetRows` and applied through `applyFormationPresetAction`, so lineup order can be tuned for balanced, assault, guard, or ranged openings before starting a mission.
- BA SRPG roster now expands from the initial four-person sample to eight selectable students, and each student owns a limited tactical skill list. Formation cards show each student's usable skills/profile, while tactical skill rows, forecasts, HUD action recommendations, and execution now filter by the selected student's owned skills instead of exposing every global skill to everyone.
- BA SRPG town/economy tab now has district-based facility tiles for guild/shop/craft/inn property state plus edict affordances. The tiles surface ownership, rental, leasing, active effects, costs, and direct action buttons while keeping the existing detailed property/edict forms.
- BA SRPG property state now persists upgrade levels per facility. Owned active facilities can be upgraded for credits, and upgrades scale shop discounts, inn rest cost reduction, craft cost reduction, guild reputation bonuses, lease income, score, town summary, and facility tile/detail labels.
- BA SRPG source tactical effects are now live: destructible cover HP, smoke zones, overwatch reaction shots, HighestOnly buffs/debuffs, area flash, burst fire, marking, suppression, rally, and advance-on-hit all persist through the battle state and forecasts. The board displays smoke, cover durability/destruction, and overwatch state, while each result class has a dedicated icon and synthesized cue. The global operation result now follows both battle results and the newest state log, so formation, deployment, rest, property purchase/rent/lease/upgrade, edicts, shop refresh/purchase, crafting, equipment, quest claims, and blocked outcomes replace stale battle text and play one outcome cue without a preliminary click. Town tiles use facility-specific object icons and selection signatures instead of one-letter placeholders, and mission, campaign, town, battle, and inventory tabs retain explicit semantic icons.
- BA SRPG missions now require both enemy elimination and mission-specific objective-tile capture. All eight missions define a scheduled one-shot event and every enemy receives one of six periodic skill patterns. Event smoke, reinforcement, supply, command buffs, and hazards mutate actual battle state; target analysis, suppression, bulwark, barrage, command, and assault patterns execute in enemy turns and appear in forecasts. The mission overlay exposes objective coordinates/status, event timing, pattern readiness, semantic icons, and dedicated synthesized cues. Legacy saves normalize the new fields, and enemy turns now preserve non-default player formations instead of silently rebuilding the default roster.
- BA SRPG now has seven original dynamic soundtrack scenes for command, deployment, town, battle, crisis, victory, and defeat. Controlled feature tabs select the persistent scene, while forecast danger, low squad HP, mission events, enemy patterns, objective capture, deployment, economy actions, and combat outcomes temporarily crossfade into matching music. The 28-44 bar loops last at least 65 seconds and use three rotating motifs, four-note harmony, eight-bar chord variation, late key shifts, strings, synth pulse, cymbals, and ghost snare. Seven object-only scene icons and a widened tactical SFX mix accompany multi-layer deploy, formation, objective, event, barrage, combat, reaction-shot, elimination, unit-down, victory, and defeat cues. `npm run check:ba-srpg-soundtrack` guards profile depth, scene priority, tab wiring, icons, and dedicated effects.
- MyAnimeCraft Starleague large feature tab JSX now lives in `client/src/app/games/myanimecraft/_components/MyAnimeCraftFeatureTabs.js`.
- MyAnimeCraft Starleague feature tabs are split into:
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftLeagueTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftCupsTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftTeamTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftMarketTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftRecordsTab.js`
- MyAnimeCraft Personal League V2 preliminary reports now include seed-tier distribution, race distribution, form/rating averages, and lower-seed breakthrough notes.
- MyAnimeCraft rivalry archive now derives head-to-head records from regular league, postseason, Personal League, and Winners League set history, then surfaces it in the league advisor, league tab, and records tab.
- MyAnimeCraft Starleague now routes 26 state transitions through `starleagueFeedback.js`, covering regular matches, season rollover, Personal League, Winners League, sponsor/training/weekly actions, FA/contract/release, shop/equipment/consumables, trades, and blocked outcomes. Personal cups, Winners sets, FA signing, release, equipment removal, and rejected trades have dedicated synthesized cues and object icons. All four actionable tabs share the same result icon/label/tone, state-changing controls play only the actual outcome cue, save/load errors stay in the persistent result surface, and rapid actions use the latest state ref. `check:starleague-feedback` exercises engine actions, transition priority, source wiring, icons, and all 26 referenced cues.
- MyAnimeCraft Starleague now has seven original dynamic soundtrack scenes: front office, regular broadcast, Personal League, Winners League, finals, championship ceremony, and records archive. Tabs and postseason state choose the persistent scene, while regular/cup/Winners/championship outcomes temporarily crossfade into their event track before returning. Every 32-44 bar loop lasts at least 65 seconds and includes A/B/C motif rotation, 4-note voicings, eight-bar chord variation, late key shifts, and the shared 22-role arrangement stack. The broadcast SFX override adds stereo crowd beds and longer match, comeback, ace-set, cup, Winners, victory/defeat, and championship stingers. `check:starleague-soundtrack` validates profiles, state priority, timed transitions, icons, and themed result cues.
- Racing Logos Demo shared logo/event row panels now live in `client/src/app/games/racing-logos-demo/_components/RacingLogosPlayPanels.js`.
- Racing Logos Demo large feature tab JSX now lives in `client/src/app/games/racing-logos-demo/_components/RacingLogosFeatureTabs.js`.
- Racing Logos Demo feature tabs are split into:
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosAuditTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosLocalPackTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosTracksTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosCalendarTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosDataPackTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosEventsTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosMatrixTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosLogTab.js`
  - `client/src/app/games/racing-logos-demo/_components/RacingLogosAdvancedTab.js`
- Racing Logos Demo now uses a compact hero, eight micro metrics, a minimal asset coach, pinned latest result, and nine icon-led feature tabs. `racingLogosFeedback.js` classifies 10 state transitions, including first full data-pack readiness, filters, and blocked results. The page routes every child-tab state update through a latest-state wrapper, while six result panels share action icons/tones and outcome-driven controls suppress their preliminary click cue. `npm run check:racing-logos-feedback` exercises the real audit, pack, card, release, filter, and blocked flows.
- Rail3D Sim large feature tab JSX now lives in `client/src/app/games/rail3d-sim/_components/Rail3dFeatureTabs.js`.
- Rail3D Sim feature tabs are split into:
  - `client/src/app/games/rail3d-sim/_components/Rail3dOperationsTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dMapTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dTrainsTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dAnalysisTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dScheduleTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dBlocksTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dLogTab.js`
  - `client/src/app/games/rail3d-sim/_components/Rail3dAdvancedTab.js`
- Rail3D Sim result-state selection lives in `client/src/app/games/rail3d-sim/_lib/rail3dFeedback.js`. It compares arrivals, departures, STOP/token states, block conflicts, token handoffs, junction passage, whole-network release, minute-band wait escalation, delayed arrivals, lookahead, and completion, then maps 17 transitions to dedicated synthesized cues, Lucide icons, labels, and result tones. The minimap renders station/train/signal/token object icons, supports keyboard and pointer train selection, and exposes a responsive selected-train status strip. Outcome-driven controls suppress preliminary click sounds; `check:rail3d-feedback` covers the transition matrix and shared map/icon/sound wiring.
- Rail3D Sim normalizes old `pose.sM` saves to `pose.headS` in `rail3dEngine.js`; preserve this migration when the original route cache is imported.
- Board detail normalization helpers now live in `client/src/app/board/_lib/boardUtils.js`.
- Board detail rendering is split into:
  - `client/src/app/board/_components/BoardDetailPostView.js`
  - `client/src/app/board/_components/BoardReportPanel.js`
  - `client/src/app/board/_components/BoardCommentsSection.js`
- Board detail `useMemo` and async status loader effects now satisfy the runtime React Hooks/Compiler lint rules.
- Board list helpers now live in `client/src/app/board/_lib/boardListUtils.js`.
- Board list toolbar/write/table rendering now lives in `client/src/app/board/_components/BoardListPanels.js`.
- Board list URL sync and logged-out writer reset effects now satisfy the runtime React Hooks/Compiler lint rules.
- Twenty Questions room content now lives in `client/src/app/twenty-questions/_components/TwentyQuestionsRoomContent.js`; `[id]/page.js` is now a thin entrypoint.
- Twenty Questions room loader effect now satisfies the runtime React Hooks/Compiler lint rules.
- Twenty Questions now routes room creation, refresh, questions, guesses, hints, host answers, room closure, and invalid requests through `twentyQuestionsFeedback.js`. Eleven result branches select dedicated synthesized cues and matching object icons; a sticky live feedback row keeps async outcomes visible. Listing/header/filter controls and room actions use shared icon controls, mobile header/filter groups use two columns, and room summary metrics remain a dense two-column mobile grid.
- Games hub utility helpers now live in `client/src/app/games/_lib/gamesHubUtils.js`.
- Games hub cards and activity list rendering now live in `client/src/app/games/_components/GamesHubCards.js`.
- Games hub initial loader effect now satisfies the runtime React Hooks/Compiler lint rules.
- Game detail route content now lives in `client/src/app/games/_components/GameDetailPageContent.js`; `[slug]/page.js` is now a thin entrypoint.
- Game room detail normalization/save/record helpers now live in `client/src/app/games/rooms/_lib/gameRoomDetailUtils.js`.
- Game room detail rendering is split into:
  - `client/src/app/games/rooms/_components/GameRoomOverviewPanels.js`
  - `client/src/app/games/rooms/_components/GameRoomSavePanels.js`
  - `client/src/app/games/rooms/_components/GameRoomRecordPanel.js`
  - `client/src/app/games/rooms/_components/GameRoomPlayersPanel.js`
- Game room detail room-player memoization and room-state effects now satisfy the runtime React Hooks/Compiler lint rules.
- Simulation page orchestration now lives in `client/src/app/simulation/_lib/useSimulationPageController.js`; `client/src/app/simulation/page.js` is now a thin hydration/view shell.
- Account page utility helpers now live in `client/src/app/account/_lib/accountUtils.js`.
- Account page rendering is split into:
  - `client/src/app/account/_components/AccountProfileDashboard.js`
  - `client/src/app/account/_components/AccountSecurityPanels.js`
  - `client/src/app/account/_components/AccountActivityPanels.js`
- Account activity reset effect now satisfies the runtime React Hooks/Compiler lint rules.
- Home page utility helpers and dashboard constants now live in `client/src/app/_lib/homePageUtils.js`.
- Home page progress rows now live in `client/src/app/_components/HomeProgressPanels.js`.
- Home page hub/ranking rows now live in `client/src/app/_components/HomeHubPanels.js`.
- Home progress reset effect now satisfies the runtime React Hooks/Compiler lint rules.
- Runtime ESLint sweep can be run in smaller parts with `npm run check:runtime:simulation` and `npm run check:runtime:utils`.
- Last verified checks before commit:
  - targeted `node --check`
  - targeted ESLint
  - `git diff --check`
  - `npm run build`

## Completed: Company Report Splitting

`CompanyReportDetailPanels.js` is now a thin layout coordinator. Its feature groups were split into:

1. `CompanyReportVatInventoryPanels.js`
   - VAT schedule
   - VAT payment history
   - inventory valuation and write-down panels

2. `CompanyReportManagementPanels.js`
   - management report
   - sales analysis
   - risk checklist
   - snapshot diff
   - restore dry-run

3. `CompanyReportGlobalCapitalPanels.js`
   - global performance
   - foreign receivables and imports
   - capital market
   - disclosure and financing history

4. `CompanyReportArchiveLedgerPanels.js`
   - financial summary
   - snapshots
   - restore history
   - report archive
   - export history
   - order ledger
   - receivables ledger
   - inventory ledger
   - operation log

Goal completed: `CompanyReportDetailPanels.js` is no longer a 700+ line component.

## Completed: Company Report Page Runtime Coupling Reduction

After the panel and hook split, page-local runtime logic was moved out of `play/page.js` where it made the page easier to reason about:

1. Done: create a hook for save/load/record actions.
   - Candidate name: `useCompanyReportPersistence`.
   - Moved `saveRun`, `loadRun`, `recordRun`, `busy`, and `message` handling.

2. Done: create a hook for controlled selections.
   - Candidate name: `useCompanyReportSelections`.
   - Moved partner/product/order/receivable/VAT/global/capital selection state and reset helpers.

3. Done: group derived row/selected entity assembly into a read-only view-model helper.
   - File: `client/src/app/games/company-report/_lib/companyReportPlayViewModel.js`.

4. Current decision: keep actual ledger mutations in one visible place unless the action list becomes clearly reusable.

## Priority 1: Simulation Skill Layer

Resume the skill AI work after UI splitting is stable:

1. Character skill slots:
   - Passive
   - Q
   - W
   - E
   - R

2. In progress: Text-to-skill compiler:
   - Parse effect text into damage, cooldown, range, area, repeat-cast, and scaling keywords.
   - Keep a preview panel that shows generated behavior before applying it.
   - Store both original text and compiled behavior.
   - Done: `client/src/utils/characterSkillCompiler.js` was normalized back to readable Korean/English patterns.
   - Done: second-stage fields are only generated when the text explicitly contains a recast/second-hit marker.
   - Done: `npm run check:skills` validates attack, recast, passive, heal, shield, and built-in Bihyung Q parsing/runtime behavior.

3. In progress: Runtime skill AI:
   - usage conditions
   - target selection
   - cast range
   - pre-delay and post-delay
   - cooldown tracking
   - skill-enabled and skill-disabled simulation modes through one shared battle engine layer
   - Done: basic attack enhancement skills still require a real base hit, while attack/heal/shield active skills can pass AI/cooldown checks even when base counter damage is 0.
   - Done: character skill combat log fragments in `characterSkillRuntime.js` are readable Korean.
   - Done: character skill cast/recovery delay now reserves phase action time during PvP combat.
   - Done: runtime check covers skill-enabled/disabled mode, heal/shield active skills, Bihyung Q 1st single-target hit, and Bihyung Q 2nd splash hit.
   - Done: heal/shield support skills can now pick same-zone allies from the combat roster instead of always applying to the caster.
   - Done: support skill target scope is now compiled, editable, saved, and respected at runtime (`self`, `ally`, `team`, `auto`).
   - Done: explicit heal/shield skill-amplification coefficients scale healing/shields without creating ally damage or splash hits.

4. Sample target:
   - Bihyeong Q should support first cast single-target bonus damage and second cast within 5 seconds as area damage with current-health percent scaling.

## Priority 2: Simulation Map And Movement UX

The simulation is still mostly text-driven. Next visual target:

1. Put a large minimap at the center of the simulation view.
2. Render characters as icons on zones.
3. Animate movement, farming, hyperloop movement, combat, deaths, and revives.
4. Make hyperloop usage visible and strategic.
5. Keep the existing log as a secondary panel, not the primary experience.

## Priority 3: Simulation Economy And Survival Rules

Re-check and finish the remaining simulation behavior requests:

1. AI credit spending:
   - Buy meteorite, Tree of Life, force core, and mithril from kiosk from day 2 daytime.
   - Buy VF blood sample from day 4 daytime.
   - Prioritize legendary gear before transcendence when transcendence material is unavailable.
   - Prioritize transcendence weapon first once VF blood sample is available.

2. Squad revive rules:
   - Corpse remains for 30 seconds.
   - Damage to corpse reduces remaining corpse timer by damage proportion.
   - Teammate interaction revives after 5 seconds.
   - Prevent full squad wipe until day 2 daytime.
   - From day 2 night through day 3 night, revive after level-scaled delay if team is not wiped.
   - Later, allow kiosk revive for 200 credits, drawing from teammates if needed.

3. Developer-tool restriction:
   - Runs manipulated by developer tools should not enter Hall of Fame.
   - Runs manipulated by developer tools should not grant rewards.
   - Show warning before enabling developer tools.

## Priority 4: Game UI/UX Follow-up

Continue the game-by-game polish pass:

1. Done: convert 11 shared-shell games to a desktop `100dvh` play workspace with compact chrome and tab-local scrolling.
2. Done: apply the same bounded workspace pattern to Dual Academy TCG and the Twenty Questions lobby/room; Eternal Hunger already used a viewport shell.
3. Done: add `npm run check:game-viewport` to guard shared/custom viewport classes and mobile document-flow fallback.
4. Ensure each game has a useful guidance level or advisor panel where it makes sense.
5. Make tutorial/help density respect the intended user level.
6. Avoid landing-page style layouts for playable tools.
7. Keep game screens focused on the playable surface first.
8. Run the app visually after each major game page change.

## Priority 5: Continue Game Page Splitting

Company Report is the reference pattern. School Simulator has started following that pattern:

1. Done: move School Simulator feature tabs into `SchoolSimulatorFeatureTabs.js`.
2. Done: move School Simulator care report calculation into `schoolSimulatorCareReport.js`.
3. Done: split the detailed School Simulator operation tab into grouped advanced components.
4. Done: move save/load/record actions into `useSchoolSimulatorPersistence`.
5. Done: move selected controls into `useSchoolSimulatorSelections`.
6. Done: move derived rows and selected entities into `schoolSimulatorPlayViewModel`.
7. Next for School Simulator:
   - optionally move page shell metrics/messages/advisor payloads into a small page runtime helper if the page grows again.
   - split remaining `SchoolSimulatorFeatureTabs.js` tab groups only if they start growing again.

After School Simulator, continue applying the same page split to:

1. In progress: `client/src/app/games/si-coding-sim/play/page.js`
   - Done: persistence hook
   - Done: play view-model helper
   - Done: submission readiness helper/panel split
   - Done: extract the large `GameFeatureTabs` JSX into `SiCodingSimFeatureTabs.js`.
   - Done: split `SiCodingSimFeatureTabs.js` into tab-group components.
   - Next: split `SiCodingAdvancedTab.js` further only if feature work touches the advanced/detail panels.
2. In progress: `client/src/app/games/schale-idle-rpg/play/page.js`
   - Done: persistence hook
   - Done: play view-model helper
   - Done: equipment tuning helper split
   - Done: extract the large `GameFeatureTabs` JSX into `SchaleIdleFeatureTabs.js`.
   - Done: split `SchaleIdleFeatureTabs.js` into tab-group components (`plan`, `season`, `sync`, `duty`, `gear`, `records`).
   - Done: migrate the simplified slot-object equipment model to the original-style UID inventory with legacy save compatibility.
   - Done: add direct equipment swapping, lock/favorite protection, UID presets, safe salvage, recipe readiness, and state-driven equipment feedback cues.
   - Done: port the original per-item enhancement cost, soft/hard pity, protection preference, post-protection pity policy, downgrade, and destruction rules with a live readiness UI and dedicated feedback.
   - Next: split `SchaleIdleGearTab.js` into vault/tuning/preset/salvage panels before expanding the equipment catalog and long-run enhancement balance.
3. In progress: `client/src/app/games/dual-academy-tcg/play/page.js`
   - Done: zone-inspection/page helper split
   - Done: extract the large feature tab JSX into `DualAcademyTcgFeatureTabs.js`
   - Done: split `DualAcademyTcgFeatureTabs.js` into tab-group components (`board`, `advisor`, `inspect`, `logs`, `hand`).
   - Done: split save/load/room synchronization effects into `useDualAcademyTcgPersistence`.
   - Done: port Hina/Mika/Yuuka signature effects, Mika's Trinity cost prompt, AI response handling, target protection, and dedicated feedback cues.
   - Next: port extra-deck/special-summon variants and the remaining original card-specific effects before growing the page view-model again.
4. In progress: `client/src/app/games/primitive-archive/play/page.js`
   - Done: page helper/runtime split
   - Done: persistence hook
   - Done: extract the large `GameFeatureTabs` JSX into `PrimitiveArchiveFeatureTabs.js`.
   - Done: split `PrimitiveArchiveFeatureTabs.js` into tab-group components.
   - Next: split `PrimitiveArchiveSurvivalTab.js` further only if survival/camp/equipment panels grow again.
5. In progress: `client/src/app/games/ba-vanguard/play/page.js`
   - Done: extract the large `GameFeatureTabs` JSX into `BaVanguardFeatureTabs.js`.
   - Done: split `BaVanguardFeatureTabs.js` into tab-group components (`duel`, `tactics`, `hand/log`, `deck`).
   - Done: move save/load/room synchronization into `useBaVanguardPersistence`.
   - Done: move playtest summary assembly into `baVanguardPageRuntime`.
   - Next: leave the remaining duel action handlers in page unless future changes make them reusable.
6. In progress: `client/src/app/games/tonkatsu-teacher/play/page.js`
   - Done: extract the large `GameFeatureTabs` JSX into `TonkatsuTeacherFeatureTabs.js`.
   - Done: split `TonkatsuTeacherFeatureTabs.js` into tab-group components.
   - Next: split `TonkatsuAdvancedTab.js` further only if the detailed kitchen/inventory/judge panel grows again.
7. In progress: `client/src/app/games/ba-srpg/play/page.js`
   - Done: extract the large `GameFeatureTabs` JSX into `BaSrpgFeatureTabs.js`.
   - Done: split `BaSrpgFeatureTabs.js` into tab-group components.
   - Done: add the battle-tab mission overlay through `getBattleMissionOverlay`.
   - Next: split `BaSrpgBattleTab.js` or `BaSrpgMissionTab.js` further only if tactical HUD/mission setup grows again.

## Suggested Validation Commands

Run targeted checks while editing:

```powershell
cd client
npm run check:skills
npm run check:runtime:simulation
npm run check:runtime:utils
npm run check:eternal-hunger-feedback
npm run check:twenty-questions-feedback
npm run check:game-viewport
npm run lint -- src/utils/characterSkillCompiler.js src/utils/characterSkillCompilerCore.js src/app/simulation/_lib/characterSkillDefinitionRuntime.js src/app/simulation/_lib/characterSkillRuntime.js src/app/simulation/_lib/characterSkillAiRuntime.js src/app/characters/_components/CharacterSkillConfigModal.js src/app/characters/_components/CharacterSkillConfigFields.js src/app/characters/_lib/useCharacterSkillConfigEditor.js
npm run lint -- src/app/games/company-report/play/page.js src/app/games/company-report/_lib/companyReportPlayViewModel.js src/app/games/company-report/_lib/companyReportFeedback.js src/app/games/company-report/_hooks/useCompanyReportPersistence.js src/app/games/company-report/_hooks/useCompanyReportSelections.js src/app/games/company-report/_components/CompanyReportDetailPanels.js src/app/games/company-report/_components/CompanyReportFeatureTabs.js src/app/games/company-report/_components/CompanyReportGuidancePanel.js src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js src/app/games/company-report/_components/CompanyReportGlobalCapitalPanels.js src/app/games/company-report/_components/CompanyReportVatInventoryPanels.js src/app/games/company-report/_lib/companyReportPageRuntime.js
npm run lint -- src/app/games/school-simulator/play/page.js src/app/games/school-simulator/_hooks/useSchoolSimulatorPersistence.js src/app/games/school-simulator/_hooks/useSchoolSimulatorSelections.js src/app/games/school-simulator/_lib/schoolSimulatorPlayViewModel.js src/app/games/school-simulator/_components/SchoolSimulatorFeatureTabs.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedTab.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedVisionEvents.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedOperations.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedReports.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedPeople.js src/app/games/school-simulator/_lib/schoolSimulatorCareReport.js
npm run lint -- src/app/games/si-coding-sim/play/page.js src/app/games/si-coding-sim/_components/SiCodingSimFeatureTabs.js src/app/games/si-coding-sim/_components/SiCodingFieldTab.js src/app/games/si-coding-sim/_components/SiCodingTasksTab.js src/app/games/si-coding-sim/_components/SiCodingDocsTab.js src/app/games/si-coding-sim/_components/SiCodingCodeTab.js src/app/games/si-coding-sim/_components/SiCodingCareerTab.js src/app/games/si-coding-sim/_components/SiCodingAuditTab.js src/app/games/si-coding-sim/_components/SiCodingAdvancedTab.js src/app/games/si-coding-sim/_components/SiCodingSubmissionReadinessPanel.js src/app/games/si-coding-sim/_hooks/useSiCodingSimPersistence.js src/app/games/si-coding-sim/_lib/siCodingSimPlayViewModel.js src/app/games/si-coding-sim/_lib/siCodingSubmissionReadiness.js src/app/games/si-coding-sim/_lib/siCodingSimFeedback.js
npm run lint -- src/app/games/rail3d-sim/play/page.js src/app/games/rail3d-sim/_components/Rail3dFeatureTabs.js src/app/games/rail3d-sim/_components/Rail3dOperationsTab.js src/app/games/rail3d-sim/_components/Rail3dTrainsTab.js src/app/games/rail3d-sim/_components/Rail3dAnalysisTab.js src/app/games/rail3d-sim/_components/Rail3dAdvancedTab.js src/app/games/rail3d-sim/_lib/rail3dEngine.js src/app/games/rail3d-sim/_lib/rail3dFeedback.js src/app/games/_lib/useGameSfx.js
npm run lint -- src/app/games/schale-idle-rpg/play/page.js src/app/games/schale-idle-rpg/_components/SchaleIdleFeatureTabs.js src/app/games/schale-idle-rpg/_components/SchaleIdlePlanTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleSeasonTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleSyncTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleDutyTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleGearTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleRecordsTab.js src/app/games/schale-idle-rpg/_hooks/useSchaleIdlePersistence.js src/app/games/schale-idle-rpg/_lib/schaleIdlePlayViewModel.js src/app/games/schale-idle-rpg/_lib/schaleEquipmentTuning.js src/app/games/schale-idle-rpg/_lib/schaleIdleFeedback.js
npm run lint -- src/app/games/dual-academy-tcg/play/page.js src/app/games/dual-academy-tcg/_hooks/useDualAcademyTcgPersistence.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgFeatureTabs.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgBoardTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgAdvisorTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgInspectTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgLogsTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgHandTab.js src/app/games/dual-academy-tcg/_lib/tcgPlayPageRuntime.js
npm run check:dual-academy-feedback
npm run lint -- src/app/games/primitive-archive/play/page.js src/app/games/primitive-archive/_components/PrimitiveArchiveFeatureTabs.js src/app/games/primitive-archive/_components/PrimitiveArchiveSurvivalTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveReportTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveGrowthTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveResearchTreePreview.js src/app/games/primitive-archive/_components/PrimitiveArchiveInventoryTab.js src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js
npm run check:primitive-archive
npm run check:schale-idle-feedback
npm run check:ba-vanguard-soundtrack
npm run check:ba-srpg-soundtrack
npm run lint -- src/app/games/ba-vanguard/play/page.js src/app/games/ba-vanguard/_hooks/useBaVanguardPersistence.js src/app/games/ba-vanguard/_lib/baVanguardPageRuntime.js src/app/games/ba-vanguard/_components/BaVanguardFeatureTabs.js src/app/games/ba-vanguard/_components/BaVanguardDuelTab.js src/app/games/ba-vanguard/_components/BaVanguardTacticsTab.js src/app/games/ba-vanguard/_components/BaVanguardHandLogTab.js src/app/games/ba-vanguard/_components/BaVanguardDeckTab.js src/app/games/ba-vanguard/_components/BaVanguardBoard.js src/app/games/ba-vanguard/_lib/baVanguardCatalog.js
npm run lint -- src/app/games/tonkatsu-teacher/play/page.js src/app/games/tonkatsu-teacher/_components/TonkatsuTeacherFeatureTabs.js src/app/games/tonkatsu-teacher/_components/TonkatsuOperationsTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuTutorialTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuProductionTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuKitchenTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuStudentsTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuGrowthTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuJudgeTab.js src/app/games/tonkatsu-teacher/_components/TonkatsuAdvancedTab.js src/app/games/tonkatsu-teacher/_lib/tonkatsuTeacherEngine.js src/app/games/tonkatsu-teacher/_lib/tonkatsuTeacherData.js
npm run lint -- src/app/games/ba-srpg/play/page.js src/app/games/ba-srpg/_components/BaSrpgFeatureTabs.js src/app/games/ba-srpg/_components/BaSrpgMissionTab.js src/app/games/ba-srpg/_components/BaSrpgCampaignExpansionTab.js src/app/games/ba-srpg/_components/BaSrpgTownTab.js src/app/games/ba-srpg/_components/BaSrpgBattleTab.js src/app/games/ba-srpg/_components/BaSrpgInventoryTab.js src/app/games/ba-srpg/_lib/baSrpgEngine.js src/app/games/ba-srpg/_lib/baSrpgData.js
npm run build
```

Before committing:

```powershell
git diff --check
git status -sb
```

Commit and push:

```powershell
git add <changed-files>
git commit -m "<short message>"
git push origin main
```
