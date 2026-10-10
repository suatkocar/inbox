# Integrated Next Steps Implementation Plan

> Execute inline with the executing-plans workflow. No delegated workers. Design and publication were approved by the user.

**Goal:** Add optional next-action drafts to Inbox's existing update, clickable status navigation, and an OLED dark panel.

**Architecture:** Keep the shared ledger protocol intact. A Claude-only request module bounds all dynamic model input and appends a small NEXT JSON protocol. A separate transient state holds suggestions, never approvals or tasks. The existing four-tab pane and prompt band own navigation.

**Tech stack:** TypeScript, Claude Code mod SDK, existing CLI test harness, Codex compatibility suite.

## Constraints and design

- One tool-less Sonnet completion per Inbox update. No next-step fork, retry, or full conversation. Recovery also uses a bounded recent text excerpt.
- Dynamic input at most 24,000 UTF-8 bytes; command catalog at most 1,200 bytes; at most three suggestions, with 360-byte prompts. Existing ledger instructions remain cached. Output limit 2,200 tokens is a ceiling, not a target.
- Prefer no suggestions to speculative busywork. No duplicate of open questions, findings, completed work, dismissed suggestions, or a request to stop. Use the person's language. Command names must exist locally.
- Recommendations are drafts. Append to the composer without replacing typed text or attachments; never submit. Prevent duplicate clicks, expire on new input and session changes, and ignore late responses.
- Suggestions live in transient, versioned UI state; they are not written into the shared ledger or injected as instructions. Core ledger/Codex behavior remains compatible.
- The bottom band always offers Inbox (except surveys), with clickable nonzero tab counts and no global numeric hotkeys. Clicking a badge opens that tab and its first row.
- OLED colors: body #000000, cards #101010, selected #19232d, raised #202020, muted #aeb6c0, next-step accent #8fc9f8. Preserve host fonts and existing light/ANSI accessibility fallbacks. A compact wrapping tab strip preserves room for content.
- Click-to-open is the default. No unsolicited panel popup. Host chooses dock versus inline layout.
- Keep global source untouched until all validation is complete. Do not write real Inbox store data in test runs.

## Task 1: Bounded shared requests and lifecycle

- [x] Add failing unit tests for UTF-8 budgets, malformed NEXT lines, unknown commands, duplicate/dismissed prompts and code-preserving prompt validation.
- [x] Add `hooks/next-steps.ts`: request budgets, command ranking, NEXT instructions/parser, versioned state helpers.
- [x] Integrate one existing model request in `hooks/register.tsx`; replace full-context recovery with a bounded recent transcript; reset state on input/reload/conversation transitions and gate late results by revision.
- [x] Add hook tests proving one completion, zero forks, unchanged core ledger, failed-generation isolation and no stale suggestions.

## Task 2: Panel, navigation and safe drafting

- [x] Add failing hook tests for empty-session Inbox button, badge-to-tab navigation, safe append with attachments, fill refusal, and repeated clicks.
- [x] Add a fourth Next steps tab, row prompt preview, Draft and Dismiss actions with immediate result feedback.
- [x] Add OLED default and follow-theme option; compact wrapping tabs, clear empty/loading/failure states.
- [x] Verify theme changes, narrow inline layouts and shared-band composition with Image View and Prompt Rail.

## Task 3: Behavioral verification and publication

- [x] Compare baseline versus extended prompts on identical synthetic exchanges in repeated real Sonnet calls. Record measured usage and ledger/suggestion outcomes without session content or private paths.
- [x] Run `./scripts/check.sh`, integration hook harness, and `git diff --check`. Inspect every failure and fix causes.
- [x] Document budgets, limitations, controls, validation, and reload instructions in English.
- Publication procedure after the validated implementation commit: fast-forward the unchanged canonical checkout, push the personal fork, and verify that the globally enabled plugin resolves to that source. Back up configuration before any configuration mutation.

## Acceptance checks

`expect(modelCompletions).toBe(1)` and `expect(modelForks).toBe(0)` per normal update; `Buffer.byteLength(prompt, 'utf8') <= 24000` even with long Unicode content; existing drafts including `[Image #3]` survive Draft; all core checks remain green. Real terminal paint is a separate manual observation from hook-layout tests.
