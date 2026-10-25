# Civilization Archive handoff verification — 2026-10-24

## Scope

Reviewed Claude's local changes against the user's pasted handoff. The referenced
`claude/civilization-archive-fixes-2026-10-24.md` was not present in this checkout;
this document records the verification performed here, not that missing document.

Preserved developer visibility and sticky `devTools.used` exclusions; Set/follower
indexes and growth-only row building; eleven literal `next/dynamic` imports;
explicit corrupt-checkpoint recovery; compact save status; quick-action auto-day
control; outside/Escape menu closing; catalog naming; and all four era assets.
No `normalizeState`/`normalizeResearch` object cache, automatic-survival balance
change, or `PrimitiveArchiveCampWorkspace.js` change was introduced.

## Additional fixes

- Updated the soundtrack checker to validate the existing controlled native
  navigation buttons and their selected-panel/music wiring, rather than require
  an obsolete `onTabChange` prop.
- Corrupt recovery now refuses to remove original bytes if backup storage fails.
  The hook remains corrupt and retryable with a specific explanatory message.
- Decode the captured bytes using the same decoder as ordinary checkpoint reads.
  Recheck the live bytes after backup, returning conflict if another tab changed
  them. `localStorage` still cannot make the final comparison and removal atomic.
- The confirmation explicitly says the single unreadable-backup slot replaces
  an older backup. Owner isolation remains unchanged.
- Added seven checkpoint cases for byte-exact recovery, revision 1, failure
  preservation, normal/missing guards, changed-live-record detection, one-slot
  backup behavior, and actual hook recovery/retry. Checkpoint total: 37 passed.

## Verification performed

- `npm run check:primitive-archive`: all thirteen scripts passed, including
  developer-adjusted run settlement/record exclusion and navigation visibility.
- Shared checks passed: game-feedback-shell, game-viewport-shell,
  ba-vanguard-feedback, starleague-feedback, starleague-broadcast.
- `npm run check:primitive-archive-soundtrack`: sample validation, seven soundtrack
  profiles, and seven rendered tracks passed.
- `npm run lint`: exit 0; only the existing Babel large-generated-file notice.
- `npm run build`: prebuild, webpack, all 62 pages, and both postbuild checks
  passed. Build ID: `QRugHHoM544fA6Z4K44c4`. The first restricted attempt stopped
  on a local EPERM directory error; rerunning with the needed permission passed.
- Local production browser smoke on `/games/primitive-archive/play` and
  `/myanime/primitive-archive/play`: primitive era presentation; save chip without
  a routine warning row; native menus; Escape/outside closing; no developer screen
  for a guest; growth-screen transition; and the relocated auto-day action.
  Auto-day advanced Day 1 to Day 2 with four real actions. No browser error logs
  were observed. The temporary tab and loopback-only server were then closed.

These checks are not human enjoyment acceptance, a new performance benchmark,
an independent reproduction of Claude's 840-day comparison, or browser coverage
of every later-era theme. No public account/save/record was written.

## Storage receipt

Counted only `.local`, `artifacts`, `client/.next`, `client/.verification-runs`,
and `client/audio-source`, deduplicating file identity and excluding symlinks.
These are logical bytes, not whole-repository physical disk allocation.

- Initial numeric-file-identity subtotal: 954,491,231 bytes. Rechecking with exact
  BigInt device/inode identities found six distinct files that numeric identities
  had incorrectly merged. Do not treat that initial subtotal as an exact baseline.
- Final cleanup tally with BigInt identities: 11,407 files / 954,068,491 bytes
  (about 0.89 GiB), below the 2 GiB threshold. An exact before/after delta is not
  asserted because the initial identity accounting was less precise.
- Removed only this verification's regenerable `client/.next/cache`: 11 files,
  637,798,390 bytes. SHA-256 of sorted `path<TAB>size<TAB>fileSHA256` rows:
  `59b3f6da150573455b7c6c2b81f9977696d57134e3b47072213d9a969ade93b5`.
  Removal verified. It is regenerable, not a backed-up runtime or save.
- Retained the new runtime, existing verified runtime backups, source, assets,
  user saves, and unrelated untracked files. Noncache current-build manifest:
  1,277 files / 26,623,312 bytes / SHA-256
  `bebb2bc03f6703b315be1ddf2a20810551aa34f36c74e9547d0fad4457d75e75`.

## Still unchanged

Placeholder party portraits and automatic-operation survival balance remain as
handed off. Decimal expected values are retained; the follow-up below now labels
their meaning rather than round them into fictitious integer payouts.
Local build verification alone does not establish that a public deployment has
finished; deployment status must be checked separately after the push.

## Follow-up: expected harvest meaning

- Added `1회 평균:` and item units to the existing expected-harvest formatter.
  Kept both original rounding precisions, empty-result text, success/drop/bonus
  probability calculations, actual integer payouts, logs and balance unchanged.
- The existing collapsed forecast panel explains that failure/drop chance is
  included and that a single action does not guarantee every listed resource.
  No additional persistent warning or panel was added to the first view.
- The focused check now has eleven cases. Its fresh real-state forecast is
  rendered in the basic hint and expanded card, and the actual successful gather
  still pays integer items with a normal result log. Source state is unchanged.
  An initial new test incorrectly called the log field `logs`; it was corrected
  to the actual `log` field, then the full thirteen-step suite passed again.
- Changed runtime files and the final checker passed ESLint. Production build
  `fVDExj3vzybyZpHipLrx0`, including both postbuild checks, passed. In the actual
  local guest browser the previous Day 2 AP 4/4 checkpoint remained intact; both
  the basic hint and expanded explanation displayed the new wording. No paid
  gameplay action or public account write was used in this follow-up smoke.
- GitHub reported the preceding `70314266` Vercel deployment successful. This
  observation does not establish the status of this later wording change.
- Before this follow-up: 954,068,491 logical bytes over the same five roots using
  exact BigInt file identities. After build and recovery rotation, before cache
  removal: 1,572,595,085 bytes. Removed only eight regenerable `.next/cache` files,
  618,423,765 bytes, relative-path/size/file-SHA manifest SHA-256
  `f4d1bd0a552fc4abd45fbc46b0ea473bf2cab29b6ac2966de86635f2f4839fe9`.
  The retired oldest successful recovery `_VQ1ZsSoRHfoC8Zgrh-8i` was replaced;
  its noncache 1,274 files / 27,583,489 bytes had relative manifest SHA-256
  `4e9a6a4cc5e770e59255eb388e26ad5bcf7956f499bc7068669185b7bc78ad5f`.
  The previous runtime was moved, not copied, to the fixed recent recovery.
  Retained recoveries: `QRugHHoM544fA6Z4K44c4` and `5hXGLX0aCkxyeKwFQi08S`.
  The new runtime's noncache manifest is 1,277 files / 27,686,682 bytes / SHA-256
  `d7865b2ef6cddc721ddfd8887f413f2452297985dd3f932b5306cd155e22dd33`.
  Post-cleanup exact-identity recheck confirmed 954,171,320 bytes / 11,408 files
  (about 0.89 GiB), with the cache absent and all three retained noncache build
  fingerprints unchanged. Source, saves and paused-work recoveries are retained.

Actual natural account-session expiry/recovery and new human understanding /
readability feedback remain unverified. The original nine 1/5 scores are not
overwritten, and this wording change is not human acceptance or a balance fix.

## Follow-up: opening-clue notification and natural response

The helper already produced a new-chain opening message, but both successful
gather/hunt exploration-event branches discarded that message. Appended its text
to the existing event log, without changing probability, reward, AP, RNG calls,
state schema or camp layout. A duplicate unresolved chain returns empty text and
is not reannounced. New cave-gather and plains-hunt assertions failed before the
patch; after the patch all ten project/event cases passed, including duplicate,
ordinary non-chain event and failed-action negative cases. All thirteen archive
steps, changed-file ESLint and production build `jcpMhfEOMFvfck4NirBs9` passed,
including both postbuild checks. Opening-message coverage is controlled engine
evidence, not a claim that every random branch was observed in a browser.

A real local guest continuation resumed the previously verified Day 2 checkpoint.
Using normal controls, sixteen automatic-day operations, one workbench action,
four manual Cartography research actions, two map surveys and eleven targeted
cave gatherings reached a naturally opened obsidian chain at Day 21 AP 2/4.
Care days are included in the automatic-day count. Research, discovery, costs,
weather and RNG were not forced; developer tools and public account writes were
not used. The first three eras were reached through ordinary play, not injection.
The chain showed three days left and an enabled `광맥 회수` action. Reload retained
the same day/AP and pending chain. The new production build restored that state.

The actual response failed: the log reported HP -4 and extra stamina -8, AP
decreased 2 to 1, rare stock remained 5, and the response button disappeared.
Reload retained Day 21 AP 1/4 and the resolved state. The recent-result panel then
showed the later passive completion of Trapping, not the prior failure sentence;
the browser check therefore does not claim that exact failure text was redisplayed
after reload. No retry, reward, all-outcome or human-comprehension claim is made.
Both temporary tabs and the loopback server were closed after the checks.

The user said a new play evaluation is currently difficult and no natural login
expiry has occurred. Preserve these as missing observations, not acceptance, and
keep the original completed nine-item 1/5 assessment intact.

Storage before this follow-up was 954,171,320 logical bytes over the same five
roots. The oldest verified recovery `5hXGLX0aCkxyeKwFQi08S` was retired after path,
link, BUILD_ID and manifest checks (1,274 noncache files / 27,605,585 bytes /
SHA-256 `67cbcf52c9870c5b51cd067598913ec965384db236d46ba384ef3c4181c4aea4`).
The prior runtime was moved, not copied; retained recoveries are now
`fVDExj3vzybyZpHipLrx0` and `QRugHHoM544fA6Z4K44c4`. After build and rotation,
before cache removal, the subtotal was 1,572,639,554 bytes. Removed eight
regenerable `client/.next/cache` files / 618,387,495 bytes / relative manifest
SHA-256 `dbfa417f436d8025356d877bb9d3cbc05e3f7b01021ad8c14efcda9fbd428f5e`.
The new runtime noncache manifest has 1,277 files / 27,686,688 bytes / SHA-256
`07cd0ef46cd03f22d01296beaacd5495c1f7bae69db1c0ca81c38092d06d7cb2`.
The exact-identity post-cleanup recheck confirmed 954,252,059 bytes / 11,409 files,
still about 0.89 GiB, with the cache absent and retained runtime manifests intact.

## Follow-up: visible current holdings and action inventory changes

The later user screenshots identified a missing basic affordance: the action
screen showed neither current resource quantities nor useful confirmation of
resource gains. This is new human defect feedback, not a new scored evaluation.

Added a persistent current-stock bar between the objective/night panel and the
screen buttons, outside the tab-owned scrolling region. It shows wood, stone,
fiber, hide, berries, meat, herbs and clay even at zero. An inline disclosure
lists all positive holdings, including other foods, equipment and custom items.
Desktop widths of at least 1100px use one eight-resource row; narrower styles
wrap the row. Era tokens and a bounded full-stock disclosure preserve the theme
without changing AppShell or camp ordering.

Action feedback now compares the actual previous/current inventories and shows
signed changes plus before/after quantities. A paid action with no stock change
says so; a day transition explicitly labels the comparison as including daily
settlement rather than claiming every increase came from that action's harvest.
Additional changes collapse after the first five. Unrelated save/auth messages
do not display an old action's delta, and restored runs do not invent a missing
before-action snapshot. The old first-matching-log boundary was also replaced:
repeated identical log strings and capped logs must retain the correct new
result while an unchanged/no-op state must not repeat an old success.

All thirteen `check:primitive-archive` steps passed, with 254 PASS lines and no
FAIL lines (captured output SHA-256
`2efeb9bb8192024a14eaf1b4991d9ac44c5562ad5038bcc92954b89a1dade699`).
The focused actual-JSX checker now passes sixteen cases. Targeted ESLint and
`git diff --check` passed. Final production build `3yoQjeFtfuYhQgnfshO2D` passed,
including the 23 module-resolution checks and isolated ordinary-globals Node VM
Worker first-phase check (one completion, no failures). Build output SHA-256 is
`6b185d22d72e7dcfb0537550f54ac6d56b0cdf9956b69d34212be14e45c068a1`.
The first sandbox build hit an output-directory EPERM; the same source passed
when built outside that restriction. Worker VM evidence is not browser speed
or human acceptance evidence.

The final production runtime was exercised in a fresh local guest browser at
1280px, without account writes or state/RNG injection. Initial holdings were
wood/stone/fiber/berries 2 each, with the other four core resources zero. The
first ordinary gather changed stone 2 to 4, clay 0 to 1 and herbs 0 to 1, and
both the persistent totals and signed comparisons matched. Full holdings opened
and closed inline; navigating to camp and back retained the stock bar without
spending AP. Four manual gathers reached Day 2 AP 4/4 naturally. The fourth
result showed the day-settlement note and a collapsed sixth change. Reload
retained wood 3, stone 11, fiber 3, hide 0, berries 2, meat 1, herbs 4 and clay 7;
the obsolete per-action comparison was not presented as a reconstructed delta.
A screenshot confirmed the desktop placement. The successful test tab and
owned loopback server were closed afterward; the earlier failed connection tab
could not be closed through the browser's data-page policy and was not retried.

Engine calculations, balance, developer-tool permission/record exclusion,
growth-only calculations, checkpoint conflict/corruption safeguards and literal
dynamic imports are unchanged. A fresh human readability reassessment and
actual natural account-expiry/recovery observation remain outstanding.

After the final browser check, removed only the retired `fVDExj3vzybyZpHipLrx0`
runtime (27,686,682 bytes) and sixteen regenerable build-cache files
(693,243,265 bytes), after exact resolved path, link, build-ID, size and hash
checks. The immediate previous `jcpMhfEOMFvfck4NirBs9` runtime was moved, not
copied, into the fixed recovery location. The unique paused map-shift
reproduction remains an explicit exception. All three retained runtime manifests
were unchanged after cleanup. The same five disjoint artifact roots decreased
from 1,233,507,970 to 512,578,023 logical bytes / 4,856 unique files, excluding
the new small cleanup receipt. These totals use exact BigInt file identities,
not physical allocation or whole-workspace size. The ignored local receipt is
`.local/build-recovery/archive-owned-inventory-release.json`; source, saves,
current desktop runtime, the checkpoint recovery and Git/internal session data
were not deleted.

## Follow-up: three prioritized gameplay and history bugs

1. Ended runs: a vacant party slot previously allowed recruitment after total
   defeat, changing the result from failure to incomplete settlement and raising
   the score. Candidate availability, the party button and the engine now reject
   this action. Live recruitment retains the existing free-action and party-cap
   rules. A denied action may add a notice/timestamp but changes no gameplay,
   score, party, inventory, meta rewards or record classification.
2. Dead actors: research, civics and project work previously accepted a selected
   HP-zero actor. The engine now requires the specified living actor before
   progress/cost/RNG processing. The live page passes a living-actor gate to its
   manual feature controls while the separate automatic-day control retains the
   run-wide gate. Automatic operation still acts with living companions and does
   not revive the dead actor. No survival/production balance was changed.
3. History: the only log view previously sliced at eighteen entries with no way
   to read older saved entries. It now reveals eighteen more per click, shows the
   visible/stored count, supports returning to recent entries, handles empty
   history and resets the expansion when the run ID changes. This is view state
   only; the stored log, run schema and AP are unchanged.

Added the fresh-fixture `check-primitive-archive-action-guards.mjs` to the main
chain. Before correction, the ended-recruitment and dead-actor assertions failed;
the history JSX assertions also failed before its controls existed. The repaired
chain passes fourteen steps / 263 PASS lines / zero FAIL lines, output SHA-256
`e9a0984fc0703c11d08485df6ede85bf1b1d306b22d29455ff6c72b0350d2c88`.
There are five action-guard scenarios and twenty focused UI cases, including
actual JSX control callbacks for 30/55-entry histories and replacement runs.
These fixtures do not depend on an old downloaded game log or prior result file.
Changed-file ESLint and shared feedback-shell, action-vocabulary and viewport
checks passed. Final production build `lAXKd5Eb9llfo-DmievlT` passed both
postbuild gates; output SHA-256 is
`2ad4e36d01d241c9c72c8f16269de3dc4088559938907e993cee012e84d3682c`.
The Worker first-phase smoke is isolated Node VM evidence, not browser speed
or human comprehension evidence.

The actual local guest browser restored the prior Day 2 AP 4/4 checkpoint with
thirteen logs. One normal automatic day produced twenty-seven logs at Day 3
AP 4/4. The real history controls changed 18/27 to 27/27 and revealed the first
arrival entry, then returned to 18/27. Day, AP and resource totals remained
unchanged during history navigation, and a screenshot checked the layout. The
terminal/dead-state protections were exercised in controlled engine/actual-JSX
fixtures, not by forcing a death into this live browser state. No public account
write, save/RNG injection or paid AI call was used. The owned tab and loopback
server were closed after verification. Natural account-expiry/recovery and a
new human readability assessment remain separate outstanding observations.

After closing the owned test server, retired only the old `jcpMhfEOMFvfck4NirBs9`
runtime (27,686,688 bytes) and this build's eight regenerable cache files
(618,954,349 bytes). The prior `3yoQjeFtfuYhQgnfshO2D` runtime was moved into
the fixed recovery location, not copied. Exact paths, links, build IDs, sizes
and SHA-256 manifests were checked; the new runtime, retained previous runtime
and unique map reproduction retained identical manifests after cleanup. Five
disjoint artifact roots decreased from 1,159,236,550 to 512,595,513 logical bytes
/ 4,857 unique files, excluding the new small receipt, with no duplicate
hardlinks. Receipt: `.local/build-recovery/archive-action-guards-release.json`.
Originals, saves, current desktop runtime and internal session/Git data remain.

## 2026-10-25: low-HP survival, malformed saves and post-settlement equipment

Completed the next three repairs in the requested priority order:

1. The page now uses `hasLivingPartyMember` instead of rounded average HP to
   decide defeat. A party with HP [1, 0, 0] can still perform recovery; a truly
   defeated or ended run stays blocked. Display averages and balance are unchanged.
2. The checkpoint validator checks required runtime log/weather/advancement
   structures. Local writes reject invalid in-memory states, local reads mark
   invalid current/previous snapshots corrupt without overwriting their bytes,
   and the existing hook exposes its corrupt warning/recovery path instead of
   restoring them. Server loads use the same validation before normalization so
   missing research cannot silently turn into invented default progress. Optional
   metadata can still be backfilled. No save schema/version bump, silent discard,
   WeakMap normalization cache or real-storage repair was introduced.
3. Manual equip, role/weather auto-equip and full unequip reject ended runs in
   the engine. Editing controls are also disabled with an explanatory read-only
   notice, while equipment and inventory remain inspectable. Tests cover both
   bagged and equipped items across settled/failed/clear states, unchanged scores,
   record classification, rewards and ownership. Ongoing low-HP redistribution
   retains its free-action and carry-weight rules.

The new malformed-save and ended-equipment assertions failed before the fixes.
The complete fourteen-step archive chain now passes 272 PASS lines / zero FAIL
lines; output SHA-256:
`8c9dbee0633ba7e2da6d3ee32f65f4ea251d19c84506284b1684593cd3376b72`.
There are 41 checkpoint scenarios, eight action-guard scenarios and 22 focused
UI cases. New corruption scenarios use only isolated in-memory storage, never
the user's saved bytes or old downloaded result files. Changed-file ESLint,
`git diff --check` and shared feedback-shell/action-vocabulary/viewport checks
passed. Production build `mMsiHQ4I863Dk-bG5DyHN` passed both postbuild gates;
build output SHA-256:
`ffbb57fb409a27b714644d7f994150ada9fbf43d12cb386349756d6de0b75660`.
The isolated Node VM Worker smoke is not browser performance evidence.

The local production game route returned HTTP 200. Actual browser inspection
could not begin because the browser tool failed to write its kernel assets;
one documented session reset followed by one fresh initialization had the same
failure. No browser gameplay was performed or injected in this follow-up. The
owned loopback server was stopped. Controlled engine/hook/actual-JSX proof is
kept separate from the unavailable live-browser check, natural account expiry
and outstanding human readability feedback. No public account write occurred.

Build cleanup after verification removed the superseded `3yoQjeFtfuYhQgnfshO2D`
build (26,640,617 bytes) and the new regenerable cache (618,967,493 bytes):
645,608,110 bytes total, about 0.60 GiB. The five disjoint managed artifact roots
decreased from 1,159,265,542 to 513,657,432 file bytes before the small cleanup
receipt; this is not a whole-workspace allocation measurement. The current
`mMsiHQ4I863Dk-bG5DyHN` build, immediate previous `lAXKd5Eb9llfo-DmievlT`
build and unique `lwp9_vqTI-Ed-Tou0wGgP` map-shift reproduction were rehashed and
preserved. The previous build was moved into the existing fixed recovery path,
not copied. Exact paths, byte counts, manifests and processing results are in
the ignored `.local/build-recovery/archive-survival-release-2026-10-25.json`
receipt. No source, save, original or unrelated artifact was deleted.

## 2026-10-25 follow-up: numeric saves, maintained-fire history and academic debate

Fixed the next three audited defects in priority order:

1. The shared save validator now requires an action-counter record containing
   finite nonnegative numbers and the four core camp values (fire, shelter,
   workbench and fuel). The later archive-room, scribe-desk and library-shelf
   values remain optional but must be valid numbers when present. Local reads
   check both current and previous runs, local writes reject invalid live state,
   and server loads reject malformed data before normalization. Original corrupt
   bytes are preserved for the existing explicit recovery flow. Older healthy
   counter maps and absent later facilities remain readable without a schema or
   save-version change. This closes the missing-counter crash and nonnumeric
   camp-score gap left by the preceding structure-only repair.
2. Maintained-fire research history now uses whether the fire was active that
   night, independently of fuel payment. Eight ordinary paid rests over two nights
   count two maintained fires and grant the archive eureka with or without pottery;
   fuel remains 3 with pottery and 2 without, from an initial 4. Unbuilt and
   unfueled fires grant zero nights. Fuel use, protection and production balance
   were not tuned.
3. Academic debate preview and execution share available unfinished research and
   civic targets. When both tracks are complete, the action and its forecast are
   locked and an engine call adds no progress, fatigue, cost or RNG draw. An
   inactive camp research system also blocks it. Technology-only, civic-only and
   mixed unfinished targets retain +5 RP / +3 CP for their respective tracks and
   the existing 1 AP / 12 ST cost. Context and result logs no longer promise points
   for a completed track. The existing nineteen-action positive balance fixture
   now includes the actual built camp required for research; its full expected
   action set is retained, with a separate negative check for an unready camp.

The missing/invalid-save, saved-fuel-night and completed-target assertions failed
before their corresponding fixes. The fourteen-step `check:primitive-archive`
chain now passes 281 PASS lines / zero failures; captured output SHA-256:
`961e3409d7c43438b4984eed463f99bbe7e23da146a1ea335fd343e1a2c1953e`.
It includes 45 checkpoint cases, 28 night-survival cases, 18 decision cases and
22 focused UI cases. The new save cases exercise in-memory current/previous
envelopes, the actual checkpoint hook, server-load rejection and healthy legacy
controls without reading an old result file or touching real saved data.
Changed-file ESLint and `git diff --check` passed. Production build
`MM4IaHJZm9yKWVTUP7c3a` and both required postbuild gates passed; output SHA-256:
`15ea964ed8a0183e2a3cfb13f8336c5a647b2658a4352187aad84342f5fdeb9e`.
The shared isolated Node VM Worker smoke is separate from archive browser play.
No actual browser, account write or fresh human-readability assessment was
performed for this follow-up. No unrelated gameplay balance or Claude handoff
invariant was changed.

After build verification, removed only the retired `lAXKd5Eb9llfo-DmievlT` build
(27,701,404 bytes) and this build's eight regenerable cache files (619,032,000
bytes). The immediate previous `mMsiHQ4I863Dk-bG5DyHN` build was moved into the
fixed recovery path. Current, previous and unique map-shift reproduction manifests
were rehashed and unchanged by cleanup. Five disjoint managed artifact roots
measured 513,659,949 file bytes before building, peaked at 1,160,391,381 before
cleanup, and ended at 513,657,977 before the small receipt (1,972 fewer than the
start). These are logical file bytes with BigInt file-identity deduplication, not
whole-workspace physical allocation. Receipt:
`.local/build-recovery/archive-numeric-and-progress-release-2026-10-25.json`.
User originals, saves, unrelated artifacts, Git and internal session data remain.

## 2026-10-25 follow-up: distinct advancement quotations

The 150 technologies and 94 civics shared only 77 distinct quotation texts.
Added 167 fixed ID-specific quotations, retaining one original per distinct text
and the existing theme keys. The current 244-row tree has 244 distinct texts,
including after Unicode normalization and removal of punctuation, symbols and
whitespace. Selection does not depend on list order, randomness or earlier reads.
The catalogue and ID resolver remain in the existing standalone lore module so
data-URL-based verification does not acquire a relative-import dependency.

Three Luna research subtasks supplied original-text passages. The final source
review corrected reused passages, unsupported summaries, attribution, work and
chapter mismatches, and a refrigeration mistranslation. All 167 replacement
anchors matched the checked primary-text caches, representing 65 source URLs;
no replacement anchor wholly contains another. New records carry a source
location and `direct translation` marker, displayed alongside the existing
author/work/source link. Gutenberg links use the stable book page. The existing
Hippocratic aphorism now links to the original work rather than a secondary
history of medicine. An actual-JSX render check covers the 167 replacements,
escaped text, optional metadata on older quotes and the empty-quote case.

The full fourteen-step archive verification chain passed 281 PASS lines with no
FAIL lines; output SHA-256:
`5c2babfe6d0855605ec9601ed86ead9f6d685c3f3e81c2654b0f0fb6f7ffec95`.
Changed-file ESLint and `git diff --check` passed. Comparing every advancement
with the pre-change commit after excluding its quotation gives the unchanged
SHA-256 `17c80cee603088429c6ddf7db288776046c66ee9bcd70ff2f9f278371d0cdcc3`.
No balance, save schema, account data or Claude handoff invariant was changed.
This is source, engine/data and actual-component evidence, not fresh browser
gameplay, human readability acceptance or natural account-expiry evidence.

Production build `KngB9ollY3F3saKRvivmY` and both required postbuild gates passed;
build output SHA-256:
`a6323c5754b6744678140b5378afa4c34e7e4efef80d581a6a1b5db2924ca961`.
The initial restricted execution stopped at a build-directory creation denial;
the same unchanged source passed when rerun with normal build permissions.
The isolated Node VM Worker smoke is not a browser or performance result.

After all research agents and verification processes finished, removed only
the retired `mMsiHQ4I863Dk-bG5DyHN` build (27,699,256 bytes), this build's cache
(620,841,731 bytes) and this task's research workspace (71,822,067 bytes):
720,363,054 bytes total, about 0.67 GiB. Source locations, original-text anchors
and source hashes remain in the small ignored source-audit receipt; verification
and build logs also remain. The focused civics check passed again after deleting
the research workspace, confirming that production data and verification do not
depend on those temporary inputs or a historical result file.

The current `KngB9ollY3F3saKRvivmY` build, immediate previous
`MM4IaHJZm9yKWVTUP7c3a` build (moved into the fixed recovery location) and unique
`lwp9_vqTI-Ed-Tou0wGgP` map-shift reproduction were rehashed unchanged. The five
disjoint managed roots measured 1,233,658,707 file bytes before cleanup and
513,299,212 afterward, including the final receipt (about 0.48 GiB). These are
logical file bytes with file-identity deduplication, not whole-workspace physical
allocation. Exact targets, manifests and outcomes:
`.local/build-recovery/archive-unique-quotes-release-2026-10-25.json`.

## 2026-10-25 follow-up: ended workforce edits and visible action costs

Three Luna subtasks re-audited progression/endings, persistence and the player's
decision UI against the current acceptance list. The preceding quote release
was verified state-changing progress, not a completed human acceptance gate.

The ended-run audit reproduced a mutable workforce snapshot: job +/- remained
available and changed assignments after settlement, failure or completion.
`adjustTribeJobAction` now exits without a log or state edit for an ended run,
and `tribeSummary` supplies matching unavailable flags and an explanation.
Actual tribe-tab controls also disable while persistence is busy, with their
existing parent action lock retained. Production, food and population remain
inspectable. Active allocation stays free even at zero AP and only takes manual
ownership of the edited job's workers. Tests cover all terminal outcomes, using
the actual `completeArchiveAction` path for a clear, the full terminal snapshot,
score/record classification and unchanged input, alongside live positive cases.

The decision UI audit found that specialized livelihood costs were computed by
the engine but never rendered, while utility costs were only in mouse tooltips.
Both lists now show their existing `row.cost` within the button, underneath its
unchanged name/status. The same costs remain in the tooltips. CSS is scoped to
the era shell and inherits button text contrast, permits wrapping and preserves
the existing collapsed sections. No price, stamina, AP, outcome, unlock or
execution rule changed. Actual JSX tests inspect the visible button children,
tooltips, disabled state and original action dispatch using fresh real-engine
rows rather than historical result files.

Both engine and actual-JSX regression assertions failed before their respective
fixes. The fourteen-step archive chain passes 285 PASS lines / zero failures,
including 10 action-guard cases and 24 focused UI cases. Output SHA-256:
`20e8fbc43a80b6976ea8eddbb494ce030d17a9e66eaa865cd10a669cb1764353`.
Changed-file ESLint and `git diff --check` passed. No fresh browser or public
account write was performed for this repair. The independent review suggested
using the actual completion path in the fixture; this strengthening is included.
The new human readability assessment and natural session-expiry/recovery
observation remain open; the user's earlier 1/5 scores remain unchanged.

A separate controlled shared-save-route review found a concurrent slot-limit
race (nineteen existing slots plus two different creates can become twenty-one).
It is recorded in the backlog for a separate database-safe repair. This release
does not modify that route or claim database concurrency acceptance.

Production build `Je4atF2EbZfcIJ5xVwACu` and both postbuild gates passed; output
SHA-256 `d9607f3478d6934e82cf1136763cdd275ecabc0b5c0698f5ce08733c9d9aae85`.
The isolated Node VM Worker smoke remains distinct from browser/performance
acceptance. After process/path/link/size/hash checks, removed the retired
`MM4IaHJZm9yKWVTUP7c3a` build (27,699,432 bytes) and this build's cache
(620,952,895 bytes), 648,652,327 bytes total (about 0.60 GiB). Current build,
immediate previous `KngB9ollY3F3saKRvivmY` and unique map-shift reproduction
were rehashed unchanged; the previous build was moved, not copied.
Five disjoint managed roots decreased from 1,162,108,701 bytes before cleanup
to 513,458,882 afterward, including the small receipt (about 0.48 GiB).
These are file-identity-deduplicated logical bytes, not whole-workspace physical
allocation. Receipt:
`.local/build-recovery/archive-workforce-cost-release-2026-10-25.json`.

## Player feedback, evening maintenance and shared save slots (2026-10-25)

The manual player reached Day 207 / 244 advancements / six living companions
and ended the basic archive. Earlier screenshots and the supplied Day 103–145
text history expose sustained hunger/fire chores and late recruitment, not the
unrecorded early causes of Hina/Noa's deaths. New death records now capture the
actual night/action damage and date at the HP-positive→zero transition; old
deaths remain explicitly unclassified. A seven-scenario comparison against
`e215a8db` established that diagnosis-only changes preserved ordinary states,
logs and RNG apart from those new records/messages. The later authorized
survival changes below intentionally change balance and are not covered by
that equivalence claim.

Safe collection spends one AP, fixed ST 6 and hunger +1 for berries +2 or wood
+1, with none of ordinary gathering's chance, discovery, rare loot, success
counters or dialogue rolls. Day-end costs still apply. Only newly created
normal/easy/very-easy runs gain the requested opening buffer; hard/nightmare
and saved inventory normalization are unchanged. Scarce-stock opening fixtures
are explicit synthetic states, never references to prior player-result files.

Manual play now uses the existing population allocator after Settlement,
moving only automatic/unassigned workers and retaining all manual/legacy
assignments. Settlement plus Food Storage enables an evening pantry/fire plan
shared by preview and actual settlement. It uses only current real stock,
reserves the tribe's next ration, feeds living high-hunger companions using
existing food effects, excludes medicine, and pays wood 1→fuel 2 only when an
existing fire needs fuel. No party AP, new production, free inventory, healing
resurrection or additional random roll is granted. Forecast stock is reduced
by the planned evening consumption before its two-day projection. In fifteen
manual day-ending rests, 36 evening portions and 30 tribe portions reduced
berries 250→184 exactly; no meal action was issued. This is a controlled
engine scenario, not universal era balance or a new human satisfaction score.

The first-view reserve panel separates tribe ration units and party nutrition,
shows real planned use and points shortages to safe collection without
displacing urgent death/hunger/health/cold, replacement companions or a ready
ending. Party/map remain under the existing menu with a discoverable name.
Cooking results now retain the cooking event even when the last AP advances
the day and tribe feeding immediately consumes the cooked output; an explicit
consumption note explains a net-zero cooked-meat inventory. Production and
consumption themselves were not missing and were not duplicated by this fix.

Notifications now clear the fixed game dock. A real 1280×720 preview also
exposed a different obstruction: the tall sticky result/inventory wrapper
covered subsequent action controls inside a short pane. The result remains
first and keeps all inventory deltas, but now stays in normal flow. Final
browser observations and retained build/cleanup fingerprints are recorded in
the local release receipt; the overlap reproduction is retained only until
the corrected build is verified.

The previously documented save-slot race is repaired with a private User
mutation marker as the first transaction write, followed by slot lookup,
limit/count and upsert or deletion in that same session. Success is sent after
commit; failures abort without a success response or a process-only fallback.
Five current-source handler cases and 145 server unit cases passed. An opt-in
integration test against the installed MongoDB 8.2.3 used a disposable loopback
replica set and two independent HTTP processes with separate connections and
real authentication/routes/indexes. All ten cases passed, including nineteen
plus two creates, many creates, same-key writes, full and legacy-overfull
updates, deletion/retry, ownership isolation, private-marker projection,
injected rollback and transient retry. A setup-only overlong fixture nickname
was corrected before the complete successful run.

The installed Mongo executable was reused, not copied or downloaded; its
Authenticode status was NotSigned. Generated databases were dropped, workers
exited, normal Mongo shutdown completed, and host PID/listener absence was
verified before deleting 211,131,943 bytes of owned runtime files. Small logs,
manifest hash and cleanup proof remain in
`.local/build-recovery/archive-save-slots-acceptance-2026-10-25.json`.
No production account write, credential disclosure or new local database was
needed for the later client release. Real session-expiry timing and a new
human assessment of the corrected survival/readability remain open.

Final local release verification (finished October 26): all seventeen archive
checker steps passed, including 29 focused actual-JSX cases, 31 individual-night
cases and the 6/5/7 safe-collection/manual-workforce/evening-care cases. Targeted
ESLint, shared feedback/viewport/action-vocabulary gates and production build
`J0Obe-WfBDKDC4PVJqOBo` passed, including both required postbuild gates. Archive
log SHA-256 is `bd13aa6049327b1b935b2fb29f4c06c5a6949700ae2c8cd6cd4514afbec1903e`;
build log SHA-256 is `6c3fe9b1115860863ff135622b36cb57d5bceb7286eae51dc39f5462f10df3fa`.

The final actual 1280×720 guest preview successfully executed wood collection
and then berry collection while the new inventory-result strip remained
present; AP fell one per action and stock updated exactly. A hydrated reopened
tab retained Day 1 / AP 1/4 / wood 5 / berries 10 / ST 82 / hunger 15. A direct
DOM read immediately after reload briefly saw the prerendered default before
hydration; that is not evidence of saved progress loss. Notification-region
placement leaves 12 pixels above the real desktop dock and 6 pixels at a
390×844 viewport (375 pixels of layout width after its scrollbar), with no
horizontal overflow. The region was empty: this verifies layout geometry,
not a newly triggered authenticated duplicate-record message. One final screen
is retained at `artifacts/primitive-archive-player-feedback-20261025.png`;
the owned tabs and preview server were closed. No account was written.

After path/link/process/size/hash checks, removed only the new webpack cache,
retired `KngB9ollY3F3saKRvivmY` recovery and resolved action-overlap build
`A_GhxfiLOAx3LGIz60p61`: 1,298,295,192 bytes total (about 1.21 GiB). Current
1,277-file runtime remains 27,834,380 bytes with manifest SHA-256
`d0d6870f27f371cdf29d7bf583511f6bafb415b51a645f4d146510771c846847`.
Immediate previous `Je4atF2EbZfcIJ5xVwACu` was moved into the fixed recovery
location, not copied; its 27,809,361-byte manifest and the separate unique
map-shift reproduction are unchanged. The five disjoint managed artifact
roots contain 514,258,968 logical file bytes (about 0.48 GiB), deduplicated by
file identity; this is not the entire repository or physical allocation.
Paths, hashes, verification counts and cleanup outcomes are retained in
`.local/build-recovery/archive-player-feedback-release-2026-10-25.json`.
