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
