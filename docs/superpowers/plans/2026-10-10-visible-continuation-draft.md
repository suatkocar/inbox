# Visible continuation draft implementation plan

**Goal:** Make the previous-session card visibly append an editable continuation
summary instead of silently arming hidden context for the next message.

**Architecture:** Keep the existing per-folder saved ledger and recent-session
eligibility. Build the draft locally with `carryText`, append through
`prompt.fill`, and remove the old hidden continuation injection from `notePrompt`.
No model call is added. The main agent executes and reviews this repair.

**Scope:** `hooks/register.tsx`, `hooks/continuation.ts`, `types/index.d.ts`,
`tests/hooks.test.ts`, `README.md`, and a synthetic comparison script. The shared
ledger protocol and Codex companion stay unchanged. The Inbox navigation
controls use visible button chrome to distinguish them from Prompt Rail text.

## Acceptance and verification

- [x] Reproduce the missing draft and unrelated-message context leak in hook tests.
- [x] Append the summary visibly, keeping existing text and image references.
- [x] Prevent repeated clicks and reloads from duplicating the draft.
- [x] Show a retryable failure if the composer refuses the fill.
- [x] Drop stale actions after clear, dismissal, or a newer prompt.
- [x] Remove automatic hidden continuation injection, including legacy armed state.
- [x] Keep a successful draft for the user to inspect and submit manually.
- [x] Compare the prior and new model-facing text on repeated synthetic Sonnet trials.
- [x] Run `./scripts/check.sh` and the shared-band integration checks.
- [x] Document the behavior and verification results.

Publication follows the final checks: commit the reviewed files, fast-forward
the canonical checkout, push the personal fork, and update the user-scoped
plugin. Preserve the pre-update configuration files in a local backup.

## Regression procedure

Seed the mocked store at `p:/tmp/project` with a synthetic completed-session
ledger. Start an empty interactive session, mount `AbovePrompt`, and press
`bring`. Before repair the composer remains empty and `notePrompt` adds the old
summary to an unrelated next message. After repair, `prompt.fill` appends the
summary exactly once and submission contains no hidden previous-session block.

Run `claude plugin test .` before and after the repair. The test suite also
covers composer refusal, concurrent edits, reload, dismissal and clear during
an asynchronous composer read. Physical terminal painting is a separate live
check and must not be claimed from the hook harness.
