# inbox, for claude code

A Claude Code mod that gathers questions, tasks, findings, PR reviews, and optional next-action drafts beside your session. Click **Inbox** above the prompt or use `/inbox`.

https://github.com/user-attachments/assets/560f80be-e6fb-484e-8a3f-7b4828b98fb2

## Install

In a Claude Code session, type:

```
/plugin install inbox --marketplace suatkocar/inbox
```

Answer `y` to add the marketplace, then choose a scope. It starts working in
that session.

- It makes one bounded Sonnet call after each eligible reply, including Next steps. See [Cost](#cost).
- The PRs tab needs the GitHub CLI, `gh`, signed in.
- This fork was checked with Claude Code 2.1.296.

To update, run `claude plugin update inbox`, then `/reload-plugins` in any
session that's already open.

For a local checkout with your own changes, register its directory and install
at user scope. Claude Code then loads that checkout across your local projects:

```sh
claude plugin marketplace add /absolute/path/to/inbox --scope user
claude plugin install inbox@inbox --scope user
```

Run `/reload-plugins` in existing sessions after installation. Keep local
changes committed before bringing in upstream updates.

## Using it

The terminal keeps a compact **MODS** row above your prompt. **Inbox** stays dim
when there are no pending items, and uses the accent color with a total when
there are questions, tasks, failed checks, findings, PR actions or available
Next steps. This is an item count, not an unread-message count. Individual tab
counts appear when the terminal is wide enough.

**Summary ▸** reveals the session's goal, recent progress and current work;
press it again to fold them away. It starts collapsed when a conversation
loads and stays collapsed after idle time. The control is absent when there
is nothing to summarize. Failed checks, stop notices and brief action feedback
remain visible. These display controls make no model calls.

Click a count to open its tab and first actionable row. The **Inbox** button is
available even before the first update. The panel stays closed until you open it;
new suggestions never pop it open or switch it away from the tab you are reading.
The host places the panel beside the chat when there is room, or inline otherwise.

**Close Inbox**, inside the panel at the top left, closes only the Inbox pane.
It is separate from a terminal host's tab-close button and works even when the
composer has keyboard focus. It does not submit or replace your draft.
With the default shortcuts, press **ctrl+x, then Tab** to focus the pane, then
**Esc** to close it; **ctrl+x, then x** also closes the focused pane. The hint
beside the button follows the pane's focus, and **Keys** lists both close paths.

The panel has four tabs:

- **Needs you**: questions Claude asked you, tasks only you can do, and tests
  or builds that failed.
- **Findings**: bugs, risks and ideas Claude noticed outside the task it's
  working on.
- **PRs**: pull requests from this session and your current branch, what's
  blocking each one, and review comments waiting on you.
- **Next steps**: up to three optional, concrete follow-up drafts, produced in
  the same update as the ledger. These do not count as things waiting on you.
  A finished task may have no suggestions.

Each item shows what you can do with it. To answer a question, press the
letter next to the answer you want, and it goes to Claude as your message. You
can also have Claude fix a finding, mark a task done, or dismiss anything you
don't need.

In the terminal, **Type an answer** and **Type a reply** open one wrapping
editor. Click inside to type. The field grows with the text, up to twelve
visible lines, then follows the cursor as you move through longer drafts.
Press **Enter** to send, or **Shift+Enter** (also Alt+Enter) to add a line.
Arrow keys, selection with Shift, mouse selection, and Ctrl+A / Ctrl+Z work
inside the field. Escape releases the keyboard back to the panel.

**Keep draft** closes the editor without sending. Unsent drafts survive
resizing and closing the panel during the same conversation. They are cleared
when sent or when you switch conversations. The desktop app retains its native
input field.

In the panel, `1`, `2`, `3` and `4` switch tabs, `j` and `k` move up and down, and
an action's letter runs it. You can also click. ctrl+x tab moves between the
panel and the session. When the tab you're on is empty and something new
arrives on another tab, the panel switches to it.

In **Next steps**, select a row to read the complete proposed message.
**Add to draft** (`a`) appends it to the message box, preserving existing text
and image references. It never sends a message or runs a command. Review the
draft, edit it if needed, and send it yourself. **Dismiss** (`x`) hides an
unwanted suggestion. Repeated clicks cannot append the same suggestion twice.
A blocked composer shows a retryable notice.

Suggestions expire when you submit another message, start a turn, run a work
command, or change conversations. Dismissed/drafted prompts are suppressed for
the rest of the running conversation, including a plugin reload (last 12 exact
normalized prompts); reworded suggestions can still recur. Suggestions are not
stored in the durable ledger. A fresh process starts without this suppression
history and waits for the next reply to suggest anything.

The default **OLED** appearance uses a black background, restrained dark cards,
and a compact tab strip in the standard dark theme. Light and ANSI themes retain
their readable palettes. In `/config`, the Inbox settings offer
`appearance: oled | follow-theme` and a `nextSteps` toggle. Turning off Next
steps removes its generation instructions; normal Inbox tracking continues.

After 15 minutes with no activity, the expanded terminal summary also shows
when the session was last active. The desktop app retains its existing summary
layout, including automatic expansion after idle time or a session resume.

On a fresh conversation, **Last session in this folder** can show the latest
saved summary for that folder, up to seven days old. **Continue in draft** puts
a continuation message and that summary visibly in the message box. It appends
to existing text and image references, and never sends automatically. Review
the draft and press Enter when ready. This uses the saved summary in the new
conversation; it does not reopen the old transcript. It makes no model call.
If adding the draft fails, the card shows a retryable notice. Deleting the draft
leaves no hidden continuation attached to your next message. **Dismiss** hides
the card without changing the message box, including a draft already added.

Claude runs each test or build as a command of its own, so the mod knows
exactly how it ended. If Claude says something passes when the last run
failed, or hasn't run since an edit, the mod asks Claude to run it again or
say the change is untested.

Python's built-in `python -m unittest` and `python -m doctest` commands are
recognized, including versioned executables such as `python3.14`. A Markdown
edit makes a previous doctest result stale, since the document can contain the
tested examples.

For a check that is not recognized automatically, Claude can supply an explicit
category to `mcp__inbox__run_check`:

```json
{ "checks": ["mvn test"], "kind": "tests" }
```

The categories are `tests`, `types`, `lint`, `build`, and `validate`.
`kind` applies only to unrecognized commands; recognized commands keep their
detected category. These commands still use Bash's permission checks, run one
at a time without pipes or redirects, and have their output and result saved.
Each distinct custom command has a separate result, and Markdown edits make
its result stale because Inbox cannot know all of its inputs.

Automatic observation of direct Bash calls still requires a recognized command.
If an unknown command has no explicit category, `run_check` explains how to add
one and warns that running it directly in Bash leaves its result untracked.

To see every part with sample items, run `/inbox demo`. Run it again to go
back to your own.

## Cost

Next steps adds **no separate model call**. The existing tool-less Sonnet call
returns the ledger first and optional NEXT records last. Its fixed instructions
request caching. Normal updates use the previous short ledger and one exchange,
not the full conversation.

Dynamic input has a hard **24,000 UTF-8 byte** ceiling (not 24,000 tokens).
Within it, the latest user message is capped at 2,400 bytes, activity at 1,200,
the numbered reply at 7,000, and check evidence at about 2,000. Failed and stale
checks are prioritized. The skill catalog includes only relevant command names
and short descriptions, at most 1,200 bytes; skill files are never included.
Images and full tool-result bodies are not supplied to this call.

Recovery after a missed update uses at most 10,000 bytes of recent conversation
text plus the bounded ledger, also within the total ceiling. It uses one Sonnet
completion, **never a full-context fork of the main model**. Recovery produces
no Next steps; those resume after the next normal update. Older missed details
outside the excerpt cannot be reconstructed reliably, so absence from the
excerpt is not evidence that an old item was resolved.

Output is capped at 2,200 tokens (1,600 with Next steps off), not padded to that
size. Suggestions are limited to three, with 60-byte labels and 360-byte prompts.
Invalid or cut-off NEXT records are dropped without discarding a valid ledger.
Shortening the model's input never truncates the actual saved items.

In 24 tool-less synthetic CLI comparisons, baseline input was 2,720–2,753 tokens
and integrated input 3,206–3,245 tokens, including cached input. Integrated
output was 55–200 tokens. These are measurements of short fixtures, not a
per-turn guarantee or a billing quote. The CLI comparison's cache handling can
differ from the mod runtime. See [validation](docs/validation-next-steps.md).

Inbox uses Claude Code's current provider and authentication. On a Claude plan,
these calls consume the plan's usage allowance; with an API/provider account,
that account's usage applies. One shared call still costs more tokens than the
same call without suggestion instructions. No new API key or service is added.

## Developing

The above-prompt status composes with other mods, including Prompt Rail and
Image View. Stop notices and previous-session continuation cards stay visible;
the current session's summary is opt-in in the terminal. Surveys still take
priority. The existing ledger protocol and
durable saved-state format remain compatible. The Codex companion's model
prompts, bundles and behavior are unchanged; these new UI features target the
Claude Code mod.

Run the mod from a clone:

```sh
claude --plugin-dir /path/to/inbox
```

The session reloads the mod when you change one of its files.
`./scripts/check.sh` runs Prettier, `claude plugin validate`, a type check and
the tests. The type check needs the types Claude Code writes to
`.claude-plugin/types/` the first time it loads the mod.

Prompt changes can be compared with synthetic exchanges, using your existing
Claude sign-in and usage allowance:

```sh
node scripts/evaluate-prompts.mjs --run --output=/tmp/inbox-prompts.json
node scripts/evaluate-prompts.mjs --run --recovery-only --output=/tmp/inbox-recovery.json
```

The first runs 24 comparisons, the second 12. They disable tools, customizations,
MCP servers and session persistence, and do not load the Inbox plugin or its store.
