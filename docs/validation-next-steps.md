# Integrated Next Steps validation

Validated on 2026-10-10 with Claude Code 2.1.296. The baseline was be0e0e0.

## Automated checks

- `./scripts/check.sh`: formatting, plugin validation, TypeScript, mod tests,
  Codex bundle reproducibility, Codex types, and Codex tests all passed.
- Mod suite: 203 tests passed. Codex companion: 19 tests passed.
- Real-hook integration with Image View and Prompt Rail: all six plugin loading
  orders passed, including stopped, working, returning-session, empty and survey
  states. The integration harness does not call a model or open a real terminal.
- Explicit OLED text colors have a minimum 7.77:1 contrast ratio across the
  body, card, raised and selection backgrounds. Host-drawn button text still
  follows the host's dark palette. Light and ANSI fallback palettes remain.

The new regression checks cover:

- One ordinary completion and zero forks, including when Next steps is enabled.
- Empty-session Inbox access and badge navigation.
- Draft append preserving text and image references, concurrent typing, repeated
  clicks, composer refusal, visible feedback, and no automatic submission.
- Late model replies after a newer prompt or clear, and suppression across a
  hot reload. New or resumed conversations drop stale suggestion cards.
- Malformed/truncated JSON, unknown and session-changing commands, duplicate
  prompts, invisible/control characters, and oversized UTF-8 output.
- Large Unicode input, complete request envelopes, many fenced code blocks,
  failed-check priority, bounded skill lists, and recovery retaining newest text.
- OLED/default and light-theme rendering trees, narrow inline tabs, disabled
  Next steps, existing questions, PR actions, and check tracking.

## Real Sonnet comparisons

The comparison script used synthetic exchanges only, with tools, MCP,
customizations and session persistence disabled. It did not load a plugin or
touch Inbox's state. Both versions used the current Claude sign-in and
`--model sonnet --effort low`; the CLI reported `claude-sonnet-5-5`.
The baseline instructions came from the unchanged shared ledger module.

| Fixture | Baseline trials | Integrated trials | Expected outcome | Result |
| --- | ---: | ---: | --- | --- |
| Finished task | 3 | 3 | No new question; no suggested busywork | All passed |
| Explicit optional follow-up | 3 | 3 | No required question; integrated reply offers a useful draft | All passed |
| Required choice | 3 | 3 | Preserve the question; no competing suggestion | All passed |
| Dismissed publishing choice | 3 | 3 | Do not re-add the question or suggest publishing | All passed |
| Recovery, old question unmentioned | 3 | 3 | Keep the unanswered question | All passed |
| Recovery, old question answered | 3 | 3 | Close the answered question | All passed |

Thirty-six calls passed these fixture assertions. This is a bounded behavioral
sample, not proof that probabilistic model output is always correct. Deterministic
validation rejects unsafe output shapes independently.

For the 24 ordinary-update comparisons, total input (fresh plus cache read/write)
was 2,720–2,753 tokens for baseline and 3,206–3,245 for integration. The paired
increase was 486–492 tokens. Integrated output was 55–200 tokens. These short
English fixtures do not predict the cost of long or multilingual exchanges.
CLI cache accounting can differ from the mod runtime's cached system block.
No currency estimate or settled billing claim is made.

Reproduction:

```sh
npm --prefix codex ci
./scripts/check.sh
node scripts/evaluate-prompts.mjs --run --output=/tmp/inbox-prompts.json
node scripts/evaluate-prompts.mjs --run --recovery-only --output=/tmp/inbox-recovery.json
```

Model comparisons consume the current account's usage. They are opt-in and are
not part of `check.sh`.

## Limits and live verification

Hook tests exercise the host's UI descriptions and actions; they do not verify
physical terminal paint or mouse coordinates. No claim of a live Ghostty visual
test is made for this revision. A wide terminal can dock the pane; on narrow
terminals the host may place it inline or defer opening it. Existing sessions
should run `/reload-plugins`.

Recovery reads only the newest bounded excerpt. It can miss an old decision
that fell outside that excerpt; it must not infer closure from absence.
Ordinary replies and the model's view of long item titles are clipped too.
The complete durable ledger is retained, so manual action remains possible.

Dismissal suppression keeps the last 12 normalized prompts in the current
conversation's transient state. Reworded prompts and a new process can produce
similar suggestions again. Optional drafts are never written into the durable
ledger, counted as required work, or injected as approved instructions.
