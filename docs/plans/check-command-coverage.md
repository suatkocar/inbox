# Check command coverage

## Goal and scope

Keep Python's built-in tests and explicitly classified project checks in the
Inbox ledger, with honest errors and stale-result tracking. Preserve existing
string-array callers, the Bash permission check, and the one-command rule.
Do not change finding dismissal, model selection, or the pane.

## Design

Automatically recognize `python -m unittest` and `python -m doctest`, including
versioned Python executables. Allow `run_check` to take an optional `kind`
(`tests`, `types`, `lint`, `build`, or `validate`) for commands it does not
recognize. Recognized commands keep their detected kind. Unknown commands
without a kind get a specific explanation; shell composition gets the existing
single-command explanation. An explicitly classified command keeps its full
command as its identity, so one custom check cannot clear another's failure.

Doctest and explicitly classified checks become stale after Markdown edits.
Keep the ordinary unit-test exemption for documentation-only changes. Derive
this from the saved command, without introducing a new persistent state shape.

## Implementation and verification

- [x] Add failing regression tests in `tests/checks.test.ts`,
      `tests/check-tracking.test.ts`, and `tests/hooks.test.ts`.
- [x] Extend recognition and declared-kind resolution in `hooks/checks.ts`.
- [x] Update Markdown invalidation in `hooks/check-tracking.ts`.
- [x] Add the optional kind, separate errors, and carry the resolved run through
      execution and recording in `hooks/register.tsx`.
- [x] Run the plugin tests, rebuild the shared Codex bundles, and run
      `./scripts/check.sh`.
- [x] Compare the old and new model-facing tool instructions on the same small
      exchanges, without tools or persistent plugin state.
- [x] Document explicit commands and limits in `README.md`.

## Validation

Before the implementation, the new regressions produced nine failures. After
the fix, 185 plugin tests and 19 Codex tests passed. `./scripts/check.sh` also
passed formatting, plugin validation, both type checks, and bundle verification.

A separate temporary Git repository exercised real Python processes: unittest,
doctest, and an explicitly classified wrapper each passed with exit 0 and failed
with exit 1 after their fixtures were broken. The actual Git content comparison
found the README edit; doctest and the custom check became stale, while ordinary
unit tests stayed current for that Markdown-only edit. All three failed checks
reached the waiting list, and the tracker rejected an incorrect passing claim.
The harness disables Python bytecode writes explicitly to avoid timestamp cache
reuse when equal-length fixtures are rewritten within the same second.

In three tool-free Sonnet trials per version, the old instructions repeated the
unrecognized command without a category; the new instructions used
`run_check` with `kind: "tests"` in all three. This is a focused prompt regression
check, not a claim about every future model response or live terminal rendering.

## Deployment

Review and commit locally, back up user plugin settings, move the checkout to
the approved mods workspace, keep a compatibility symlink, repair the linked
worktree, and install at user scope.

The existing `./scripts/check.sh` passed before changing the source. Installation
must preserve the enabled plugins and every unrelated setting.
