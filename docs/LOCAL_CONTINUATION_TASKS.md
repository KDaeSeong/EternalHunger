# Local Continuation Tasks

Updated: 2026-07-07 KST
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

- `client/src/app/games/company-report/play/page.js` is roughly 380 lines and delegates panels, persistence, selections, and derived view data.
- Company Report tab UI now lives in `client/src/app/games/company-report/_components/CompanyReportFeatureTabs.js`.
- Company Report lower detail panel layout now lives in `client/src/app/games/company-report/_components/CompanyReportDetailPanels.js`.
- Company Report lower detail feature groups now live in:
  - `client/src/app/games/company-report/_components/CompanyReportArchiveLedgerPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportGlobalCapitalPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportManagementPanels.js`
  - `client/src/app/games/company-report/_components/CompanyReportVatInventoryPanels.js`
- Company Report shell metrics and message builders now live in `client/src/app/games/company-report/_lib/companyReportPageRuntime.js`.
- Company Report read-only play view model now lives in `client/src/app/games/company-report/_lib/companyReportPlayViewModel.js`.
- Company Report save/load/record actions now live in `client/src/app/games/company-report/_hooks/useCompanyReportPersistence.js`.
- Company Report controlled selections now live in `client/src/app/games/company-report/_hooks/useCompanyReportSelections.js`.
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
- Dual Academy TCG zone-inspection/page helper logic now lives in `client/src/app/games/dual-academy-tcg/_lib/tcgPlayPageRuntime.js`.
- Dual Academy TCG deck load/save/room sync/record persistence now lives in `client/src/app/games/dual-academy-tcg/_hooks/useDualAcademyTcgPersistence.js`.
- Dual Academy TCG large feature tab JSX now lives in `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgFeatureTabs.js`.
- Dual Academy TCG feature tabs are split into:
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgBoardTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgAdvisorTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgInspectTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgLogsTab.js`
  - `client/src/app/games/dual-academy-tcg/_components/DualAcademyTcgHandTab.js`
- Primitive Archive page helper logic now lives in `client/src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js`.
- Primitive Archive save/load/record actions now live in `client/src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js`.
- Primitive Archive large feature tab JSX now lives in `client/src/app/games/primitive-archive/_components/PrimitiveArchiveFeatureTabs.js`.
- Primitive Archive feature tabs are split into:
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveSurvivalTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveReportTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveGrowthTab.js`
  - `client/src/app/games/primitive-archive/_components/PrimitiveArchiveInventoryTab.js`
- BA Vanguard large feature tab JSX now lives in `client/src/app/games/ba-vanguard/_components/BaVanguardFeatureTabs.js`.
- BA Vanguard feature tabs are split into:
  - `client/src/app/games/ba-vanguard/_components/BaVanguardDuelTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardTacticsTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardHandLogTab.js`
  - `client/src/app/games/ba-vanguard/_components/BaVanguardDeckTab.js`
- BA Vanguard save/load/record and room synchronization actions now live in `client/src/app/games/ba-vanguard/_hooks/useBaVanguardPersistence.js`.
- BA Vanguard playtest summary builder now lives in `client/src/app/games/ba-vanguard/_lib/baVanguardPageRuntime.js`.
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
- BA SRPG large feature tab JSX now lives in `client/src/app/games/ba-srpg/_components/BaSrpgFeatureTabs.js`.
- BA SRPG feature tabs are split into:
  - `client/src/app/games/ba-srpg/_components/BaSrpgMissionTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgCampaignExpansionTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgTownTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgBattleTab.js`
  - `client/src/app/games/ba-srpg/_components/BaSrpgInventoryTab.js`
- MyAnimeCraft Starleague large feature tab JSX now lives in `client/src/app/games/myanimecraft/_components/MyAnimeCraftFeatureTabs.js`.
- MyAnimeCraft Starleague feature tabs are split into:
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftLeagueTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftCupsTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftTeamTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftMarketTab.js`
  - `client/src/app/games/myanimecraft/_components/MyAnimeCraftRecordsTab.js`
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
- Board detail normalization helpers now live in `client/src/app/board/_lib/boardUtils.js`.
- Board detail rendering is split into:
  - `client/src/app/board/_components/BoardDetailPostView.js`
  - `client/src/app/board/_components/BoardReportPanel.js`
  - `client/src/app/board/_components/BoardCommentsSection.js`
- Board detail `useMemo` and async status loader effects now satisfy the runtime React Hooks/Compiler lint rules.
- Board list helpers now live in `client/src/app/board/_lib/boardListUtils.js`.
- Board list toolbar/write/table rendering now lives in `client/src/app/board/_components/BoardListPanels.js`.
- Board list URL sync and logged-out writer reset effects now satisfy the runtime React Hooks/Compiler lint rules.
- Games hub utility helpers now live in `client/src/app/games/_lib/gamesHubUtils.js`.
- Games hub cards and activity list rendering now live in `client/src/app/games/_components/GamesHubCards.js`.
- Games hub initial loader effect now satisfies the runtime React Hooks/Compiler lint rules.
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

1. Ensure each game has a useful guidance level or advisor panel where it makes sense.
2. Make tutorial/help density respect the intended user level.
3. Avoid landing-page style layouts for playable tools.
4. Keep game screens focused on the playable surface first.
5. Run the app visually after each major game page change.

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
   - Next: split `SchaleIdleGearTab.js` further if gear/preset/shop/salvage panels grow again.
3. In progress: `client/src/app/games/dual-academy-tcg/play/page.js`
   - Done: zone-inspection/page helper split
   - Done: extract the large feature tab JSX into `DualAcademyTcgFeatureTabs.js`
   - Done: split `DualAcademyTcgFeatureTabs.js` into tab-group components (`board`, `advisor`, `inspect`, `logs`, `hand`).
   - Done: split save/load/room synchronization effects into `useDualAcademyTcgPersistence`.
   - Next: move remaining derived UI assembly into a small play view-model helper only if future edits make the page grow again.
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
   - Next: split `BaSrpgBattleTab.js` or `BaSrpgMissionTab.js` further only if tactical HUD/mission setup grows again.

## Suggested Validation Commands

Run targeted checks while editing:

```powershell
cd client
npm run check:skills
npm run check:runtime:simulation
npm run check:runtime:utils
npm run lint -- src/utils/characterSkillCompiler.js src/utils/characterSkillCompilerCore.js src/app/simulation/_lib/characterSkillDefinitionRuntime.js src/app/simulation/_lib/characterSkillRuntime.js src/app/simulation/_lib/characterSkillAiRuntime.js src/app/characters/_components/CharacterSkillConfigModal.js src/app/characters/_components/CharacterSkillConfigFields.js src/app/characters/_lib/useCharacterSkillConfigEditor.js
npm run lint -- src/app/games/company-report/play/page.js src/app/games/company-report/_lib/companyReportPlayViewModel.js src/app/games/company-report/_hooks/useCompanyReportPersistence.js src/app/games/company-report/_hooks/useCompanyReportSelections.js src/app/games/company-report/_components/CompanyReportDetailPanels.js src/app/games/company-report/_components/CompanyReportFeatureTabs.js src/app/games/company-report/_lib/companyReportPageRuntime.js
npm run lint -- src/app/games/school-simulator/play/page.js src/app/games/school-simulator/_hooks/useSchoolSimulatorPersistence.js src/app/games/school-simulator/_hooks/useSchoolSimulatorSelections.js src/app/games/school-simulator/_lib/schoolSimulatorPlayViewModel.js src/app/games/school-simulator/_components/SchoolSimulatorFeatureTabs.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedTab.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedVisionEvents.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedOperations.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedReports.js src/app/games/school-simulator/_components/SchoolSimulatorAdvancedPeople.js src/app/games/school-simulator/_lib/schoolSimulatorCareReport.js
npm run lint -- src/app/games/si-coding-sim/play/page.js src/app/games/si-coding-sim/_components/SiCodingSimFeatureTabs.js src/app/games/si-coding-sim/_components/SiCodingFieldTab.js src/app/games/si-coding-sim/_components/SiCodingTasksTab.js src/app/games/si-coding-sim/_components/SiCodingDocsTab.js src/app/games/si-coding-sim/_components/SiCodingCodeTab.js src/app/games/si-coding-sim/_components/SiCodingCareerTab.js src/app/games/si-coding-sim/_components/SiCodingAuditTab.js src/app/games/si-coding-sim/_components/SiCodingAdvancedTab.js src/app/games/si-coding-sim/_components/SiCodingSubmissionReadinessPanel.js src/app/games/si-coding-sim/_hooks/useSiCodingSimPersistence.js src/app/games/si-coding-sim/_lib/siCodingSimPlayViewModel.js src/app/games/si-coding-sim/_lib/siCodingSubmissionReadiness.js
npm run lint -- src/app/games/schale-idle-rpg/play/page.js src/app/games/schale-idle-rpg/_components/SchaleIdleFeatureTabs.js src/app/games/schale-idle-rpg/_components/SchaleIdlePlanTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleSeasonTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleSyncTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleDutyTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleGearTab.js src/app/games/schale-idle-rpg/_components/SchaleIdleRecordsTab.js src/app/games/schale-idle-rpg/_hooks/useSchaleIdlePersistence.js src/app/games/schale-idle-rpg/_lib/schaleIdlePlayViewModel.js src/app/games/schale-idle-rpg/_lib/schaleEquipmentTuning.js
npm run lint -- src/app/games/dual-academy-tcg/play/page.js src/app/games/dual-academy-tcg/_hooks/useDualAcademyTcgPersistence.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgFeatureTabs.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgBoardTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgAdvisorTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgInspectTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgLogsTab.js src/app/games/dual-academy-tcg/_components/DualAcademyTcgHandTab.js src/app/games/dual-academy-tcg/_lib/tcgPlayPageRuntime.js
npm run lint -- src/app/games/primitive-archive/play/page.js src/app/games/primitive-archive/_components/PrimitiveArchiveFeatureTabs.js src/app/games/primitive-archive/_components/PrimitiveArchiveSurvivalTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveReportTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveGrowthTab.js src/app/games/primitive-archive/_components/PrimitiveArchiveInventoryTab.js src/app/games/primitive-archive/_hooks/usePrimitiveArchivePersistence.js src/app/games/primitive-archive/_lib/primitiveArchivePageRuntime.js
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
