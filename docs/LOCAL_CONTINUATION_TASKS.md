# Local Continuation Tasks

Updated: 2026-07-06 KST
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
   - Done: `npm run check:skills` validates attack, recast, passive, heal, shield, and built-in Bihyung Q parsing.

3. In progress: Runtime skill AI:
   - usage conditions
   - target selection
   - cast range
   - pre-delay and post-delay
   - cooldown tracking
   - skill-enabled and skill-disabled simulation modes through one shared battle engine layer
   - Done: basic attack enhancement skills still require a real base hit, while attack/heal/shield active skills can pass AI/cooldown checks even when base counter damage is 0.
   - Done: character skill combat log fragments in `characterSkillRuntime.js` are readable Korean.

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

## Suggested Validation Commands

Run targeted checks while editing:

```powershell
cd client
npm run check:skills
npm run lint -- src/utils/characterSkillCompiler.js src/utils/characterSkillCompilerCore.js src/app/simulation/_lib/characterSkillDefinitionRuntime.js src/app/simulation/_lib/characterSkillRuntime.js src/app/simulation/_lib/characterSkillAiRuntime.js src/app/characters/_components/CharacterSkillConfigModal.js src/app/characters/_components/CharacterSkillConfigFields.js src/app/characters/_lib/useCharacterSkillConfigEditor.js
npm run lint -- src/app/games/company-report/play/page.js src/app/games/company-report/_lib/companyReportPlayViewModel.js src/app/games/company-report/_hooks/useCompanyReportPersistence.js src/app/games/company-report/_hooks/useCompanyReportSelections.js src/app/games/company-report/_components/CompanyReportDetailPanels.js src/app/games/company-report/_components/CompanyReportFeatureTabs.js src/app/games/company-report/_lib/companyReportPageRuntime.js
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
