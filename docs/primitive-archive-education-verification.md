# Optional public education and actual paper production

## Scope and rules

This change connects one later civic to a persistent institution using real
settlement labor and materials. Existing food, lineage, ancestor faith, manual
assignments, automatic workforce policy, permanent bonuses and run rewards stay
in place. It does not complete every later institution or replace settlement
rounds with historical years.

- `PAPERMAKING` unlocks the papermaking process: one wood and one fiber produce
  two paper. Manual execution uses the existing utility-action cost; the
  persistent artisan plan uses actual assigned artisans and no personal AP/ST.
  Target stock and paid processing-tradition rules apply to this process too.
- `PUBLIC_EDUCATION` is a civic, including its supported legacy research mirror.
  After its completion, `tribe.educationPlan = { teachers }` stores an upper
  bound of 0–24 teachers. Zero disables it. Configuration itself costs no
  materials, AP/ST, RNG or labor and grants no progress.
- At the next actual morning settlement, teachers are taken from the existing
  scholar pool. Each participating teacher consumes one paper for up to two CP
  toward an eligible incomplete civic, capped to its remaining progress.
- Teachers cannot also produce ordinary scholar RP that day. Staff not used
  because of missing paper, an unavailable target or the quota remain available
  for general research. Existing automatic research and civic progress are
  independent and retain their previous rules.
- Education runs after construction and before ordinary scholar research and
  meals. Artisan processing runs later, so paper made on that same morning is
  available to the school at the next day's settlement, not retroactively.
- Defined paper stock must be a finite nonnegative numeric quantity within the
  safe range. A missing paper key means zero. Boolean, string, array, null and
  other malformed values cannot finance teaching or be overwritten by paper
  production. Fractional valid stock is preserved; only whole sheets are spent.

## Save and screen behavior

The checkpoint envelope version remains unchanged. Missing old education plans
normalize to disabled and do not manufacture a historical receipt. Explicit
malformed plans or receipts fail closed through both ordinary normalization and
checkpoint validation, preserving the existing corrupt-record recovery policy.

The optional dated `lastProduction.education` receipt preserves the requested
quota, actual scholar pool, participating teachers, remaining general scholars,
civic progress before/after, requested/applied CP, actual paper before/after,
paper spent and the reason. Historical receipt amounts are validated as their
own observations, not recalculated from today's production ratios or current
worker assignments.

The tribe panel separates the input draft, saved quota, current-stock preview
and last actual receipt. Inventory/day refreshes preserve an unsaved draft;
changing the run or saved quota resets it. Applying a plan rechecks the latest
run, terminal status and saved quota, with the existing exclusive-operation,
checkpoint and shop guards. This new callback uses the education-specific
read-only summary rather than normalizing the entire run again.

## Verification and limits

Current-source engine, checkpoint, component and shared-shell verification is
recorded locally under `.local/code-audit/pa-education-*`. These verification
scripts use current fixtures, not prior match-result files. Focused checks cover
actual staffing/material deltas, partial stock and remaining CP, no duplicate
RP, paper-production ordering, disabled legacy behavior, save/resume parity,
same-day settlement protection, corrupt bytes and screen input guards.

The first focused harness attempt exposed fixture assumptions about the legacy
civic/research mirror and previous-checkpoint rotation. It also observed the
pre-existing whole-run `normalizeState -> createNewState -> rollWeather` RNG
draw. The harness corrections preserve those initial failures rather than
claiming that all were product defects. Education-specific configuration and
preview must consume no RNG; full tribe summaries must add no draws relative
to the existing disabled-plan path. Refactoring the old whole-run normalization
behavior is a separate compatibility task.

An independent engine review reproduced malformed `paper: true` funding one
teacher and two CP. Strict observation of the new paper resource fixes that
path, and regression cases cover malformed stock in both school operation and
paper output. Existing non-paper legacy resource coercion was not broadened.

Passing Node components, current-source checks, production build or public
asset delivery does not prove an actual browser play session, human readability,
general balance, natural authentication expiry, a historical calendar, or all
later institutions. Those acceptance boundaries remain open in the backlog.

### Current-source verification receipts

- Focused school engine: 11 groups, including eleven malformed raw-stock values,
  whole-sheet availability, a target with only 0.5 CP remaining, same-day worker
  exclusion and next-day use of newly processed paper.
- Focused school components: five groups, including controlled input submission,
  draft identity, real rendered receipts and extracted current-page callbacks.
  The new guard/mutation path draws no RNG. The full shared action wrapper still
  draws existing normalization RNG: ten draws for education versus fourteen for
  the older processing callback in the fixed comparison.
- Final complete `check:primitive-archive` child command: exit 0, with no source
  change during execution. Shared game-feedback checks also exit 0. The outer
  host retained a failed status because it then used a nonexistent viewport
  alias; the existing viewport checker was executed separately and exits 0 with
  the same source manifest. Changed-source lint exits 0.
- Earlier full-chain attempts are retained. Older JSX harnesses needed the new
  imported component registered. The papermaking action now has its own icon
  instead of sharing the weaving identifier. Original economy fingerprints and
  weather/RNG counts remain unchanged: their compatibility projection asserts a
  zero teacher plan and no education receipt before excluding only that neutral
  new field. The existing reservation UI now identifies one processing form and
  one separate education form, retaining the no-nested-reservation-form check.

Final manifest and logs: `.local/code-audit/pa-education-frozen-suite-result.json`,
`pa-education-viewport-result.json` and `pa-education-frozen-lint-result.json`.
The failed wrapper is not relabeled as a successful invocation. Production
build, release and public delivery have separate receipts in the same directory.

The isolated production build exits 0 with build ID `EzKfXKsUW6as_ucCVINjE`,
an unchanged 1,229-file source manifest and the required production Worker
first-phase check. The Worker executes in Node VM, not a browser or a foreground
speed test. This client-only change keeps the Eternal Hunger engine identifier
`4f56ccc77a1cfb80c23f58d0a571f4e14cd0ac19712a3f0a0f3545cfbd577d4f`.

## Paid ancestral education reservation — 2026-11-11

The existing study favor can now be reserved for the saved public-education
plan. This uses one of the existing two study charges immediately, shares the
one-reservation-per-day slot with construction and processing, and does not add
AP, stamina, material, elapsed-time or RNG costs. A living executor with at
least one AP and an actually qualified founder remain required. Legacy runs do
not acquire a new ancestral history through normalization.

The reservation pins the civic and saved teacher ceiling for the immediately
following morning. Actual teachers must first consume existing paper and apply
positive base CP. Only then can the existing study bonus add up to two CP in
total, bounded by the same civic's remaining requirement. The bonus is not paid
per teacher and cannot move to a subsequent civic. Newly processed paper still
becomes available after that morning's teaching, under the existing order.
Changed plans or targets, unavailable teaching, a completed target, an expired
morning, cancellation or an ended run grant no replacement, rollover or refund.

The existing teacher panel contains a collapsible reservation section. It
separates the saved plan from an unsaved draft, current projections from actual
base/bonus CP, and reservation costs from the ordinary lesson's paper cost.
Reserve and cancel callbacks revalidate the latest run, day, actor, teacher
ceiling, civic and provider through the existing protected action wrapper.

Optional new education records count actual applications separately from CP.
They preserve bounded recent/previous observed dates and CP rather than
recalculating historical amounts from current teacher ratios. This allows
consecutive lessons and reuse after a gap while still checking the latest
actual lesson after cancellation replaces the shared reservation receipt.
Old construction, processing and education receipts keep their prior meaning.
This is consistency validation, not an assertion that locally editable saves
provide cryptographic anti-cheat protection.

Focused current-source checks pass 18 tradition groups and 11 component groups;
existing education checks pass 11 groups and processing checkpoint checks pass
13 groups. The preserved RED observations cover the originally missing APIs
and an actual second-morning settlement failure. Subsequent regressions cover
four consecutive lessons, a later reuse after a gap, fractional remaining CP,
no target spillover, cancellation provenance, and forged receipt dates or CP.

The complete `check:primitive-archive`, shared feedback shell, viewport shell
and changed-source lint all exit 0 under
`.local/code-audit/archive-education-tradition-checks-result.json`. All 1,257
declared source files remain unchanged during that execution. Build and public
delivery have separate receipts; no browser, natural login-expiry, human
readability, historical-calendar or general-balance acceptance is inferred.

The new production build also exits 0 with ID `b5PSS_qDtpH4zLOkUU0bS` and the
same unchanged 1,257-file manifest. Its module-resolution checks pass 23 cases
and the isolated Node VM Worker completes one fresh first phase. The Eternal
Hunger engine remains `e8e8b934a677f183d9918e605aa42982cfb627479ce51983b095ab176b6db0a0`.
The build receipt is `archive-education-tradition-build-result.json`; this does
not substitute for the separate foreground spectator-performance test.
