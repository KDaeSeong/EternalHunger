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

- Before: 954,491,231 bytes.
- After cleanup: 953,508,595 bytes (982,636 bytes smaller).
- Removed only this verification's regenerable `client/.next/cache`: 11 files,
  637,798,390 bytes. SHA-256 of sorted `path<TAB>size<TAB>fileSHA256` rows:
  `59b3f6da150573455b7c6c2b81f9977696d57134e3b47072213d9a969ade93b5`.
  Removal verified. It is regenerable, not a backed-up runtime or save.
- Retained the new runtime, existing verified runtime backups, source, assets,
  user saves, and unrelated untracked files. Noncache current-build manifest:
  1,277 files / 26,623,312 bytes / SHA-256
  `bebb2bc03f6703b315be1ddf2a20810551aa34f36c74e9547d0fad4457d75e75`.

## Still unchanged

Fractional expected harvest presentation (for example, wood 0.8), placeholder
party portraits, and automatic-operation survival balance remain as handed off.
Local build verification alone does not establish that a public deployment has
finished; deployment status must be checked separately after the push.
