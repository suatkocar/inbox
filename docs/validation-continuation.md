# Visible continuation validation

Validated on 2026-10-10 with Claude Code 2.1.296, against baseline c996efc.

## Cause and behavior

The previous-session button only set `isBroughtIn`. `notePrompt` later attached
the saved summary as hidden context to the next user message. It did not fill
the composer, resume a transcript or start a turn. The feedback "Added to your
next message" therefore left an empty message box and could carry the old
summary into a subsequent unrelated message.

The replacement, **Continue in draft**, appends an editable continuation and
the saved summary through `prompt.fill(mode: 'append')`. Only a successful fill
shows "Added to draft"; refusal leaves a retryable notice. It never submits,
runs a command or calls a model. The old hidden context path is removed.

Inbox navigation and count buttons now use the host's visible button chrome.
The nearby numbered prompt preview belongs to Prompt Rail and remains its own
conversation navigation; it is not an Inbox record.

## Checks

- The initial regression run reproduced the empty composer, missing retry
  feedback and hidden summary on an unrelated next message.
- All 212 mod tests passed after the repair, including nine new continuation
  cases: visible summary, preserved text/images and concurrent edits, duplicate
  clicks, refusal/retry, deletion, dismissal, reload, and interruption during a
  composer read by clear, dismiss or a new prompt.
- `./scripts/check.sh` passed formatting, plugin validation, TypeScript, mod
  tests, Codex bundle reproducibility, Codex types and Codex tests.
- Image View, Prompt Rail and Inbox coexist in all six loading orders in the
  real-hook integration harness.

## Model-facing text comparison

`scripts/evaluate-continuation.mjs` compared the old hidden-summary-plus-continue
text and the new visible draft, using synthetic data only. Three scenarios
(complete work, an unanswered decision and an unfinished review), two versions,
and three repetitions produced 18 passing trials with `claude-sonnet-5-5`.

Tools, MCP servers, customizations and session persistence were disabled. No
Inbox plugin or real session store was loaded. The trials consumed the current
Claude account's usage; the application feature itself adds no model call.

The comparison checks how a model classifies the immediate next step. It is not
an end-to-end guarantee of a main coding agent's behavior with tools enabled.

```sh
./scripts/check.sh
node scripts/evaluate-continuation.mjs --run --output=/tmp/inbox-continuation.json
```

## Limits

The feature carries the saved ledger summary, not the entire old transcript.
The user controls the final text and submits it explicitly. Dismiss only hides
the card; it does not delete text already added to the composer. Existing
sessions should run `/reload-plugins`.

Hook tests verify UI descriptions, actions and draft results. They do not prove
physical terminal painting or mouse coordinates. No live Ghostty click test is
claimed for this revision.
