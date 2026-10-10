// Explicit opt-in: synthetic, tool-less Sonnet comparisons. Never reads session data.
import { build } from '../codex/node_modules/esbuild/lib/main.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

if (!process.argv.includes('--run')) {
  console.log(
    'Opt in with --run. Runs 24 synthetic Sonnet calls; uses your current Claude sign-in and usage allowance.',
  )
  process.exit(0)
}
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = await mkdtemp(join(tmpdir(), 'inbox-prompt-eval-'))
const output = process.argv.find(s => s.startsWith('--output='))?.slice(9)
if (!output) throw new Error('Supply --output=/path/to/results.json')
try {
  const bundle = join(temp, 'prompts.mjs')
  await build({
    stdin: { contents: "export * from './hooks/ledger'; export * from './hooks/next-steps'", resolveDir: root },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  })
  const {
    EMPTY,
    CLAUDE_CODE,
    systemText,
    buildPrompt,
    boundedUpdatePrompt,
    boundedRecoveryPrompt,
    transcriptCatchUpPrompt,
    NEXT_INSTRUCTIONS,
    commandCatalog,
    parseReply,
    parseSuggestions,
    byteLength,
  } = await import(pathToFileURL(bundle))
  const dismissed = {
    id: 'i1',
    kind: 'question',
    ask: 'Publish the branch now?',
    outcome: 'Not now',
    how: 'dismissed',
    at: 1,
  }
  const fixtures = [
    {
      name: 'finished',
      person: 'Fix the off-by-one error only. No further work.',
      reply: 'Fixed the off-by-one error. All tests pass. The requested work is complete.',
      expectedNew: 0,
      suggestions: 'none',
    },
    {
      name: 'optional-follow-up',
      person: 'Fix the timeout bug. Afterwards I might review the retry test coverage.',
      reply:
        'The timeout bug is fixed and all existing tests pass. An optional next action is to review whether the retry tests cover cancellation and the timeout boundary.',
      expectedNew: 0,
      suggestions: 'some',
    },
    {
      name: 'required-choice',
      person: 'Plan the database migration.',
      reply:
        'Before I can implement the migration: 1. Keep the local database or use a hosted database? I recommend keeping it local.',
      expectedNew: 1,
      suggestions: 'none',
    },
    {
      name: 'dismissed-choice',
      person: 'I already dismissed publishing. Keep the branch local; stop here.',
      reply: 'The changes are ready locally. Do you want to publish the branch now?',
      expectedNew: 0,
      suggestions: 'none',
      closed: [dismissed],
    },
  ]
  const results = []
  const waiting = {
    id: 'i1',
    kind: 'question',
    label: '1',
    ask: 'Use local or hosted storage?',
    options: ['local', 'hosted'],
    rec: 'local',
    helps: [],
    turn: 1,
    at: 1,
  }
  const recovery = [
    {
      name: 'recovery-unmentioned',
      person: 'Fix the typo.',
      reply: 'Fixed the typo.',
      transcript: 'Person: Fix the typo.\nAgent: Fixed the typo.',
      expectedNew: 0,
      expectedClosed: 0,
      suggestions: 'none',
      items: [waiting],
    },
    {
      name: 'recovery-answered',
      person: 'Use local storage.',
      reply: 'Configured local storage.',
      transcript: 'Person: Use local storage.\nAgent: Configured local storage.',
      expectedNew: 0,
      expectedClosed: 1,
      suggestions: 'none',
      items: [waiting],
    },
  ]
  for (const fixture of process.argv.includes('--recovery-only') ? recovery : fixtures) {
    const ledger = { ...EMPTY, closed: fixture.closed ?? [], items: fixture.items ?? [] }
    const ex = {
      ...fixture,
      trigger: null,
      activity: [],
      turn: 1,
      press: null,
      screen: 'Inbox is closed.',
      checks: ['tests: passed; after the last edit'],
    }
    const catalog = commandCatalog(
      [{ name: 'review-tests', description: 'Review retry test coverage', source: 'plugin' }],
      ex.person + ' ' + ex.reply,
    )
    for (let attempt = 1; attempt <= 3; attempt++) {
      for (const mode of ['baseline', 'integrated']) {
        const system = systemText(CLAUDE_CODE) + (mode === 'integrated' ? NEXT_INSTRUCTIONS : '')
        const prompt = fixture.transcript
          ? mode === 'integrated'
            ? boundedRecoveryPrompt(ledger, ex.screen, fixture.transcript)
            : transcriptCatchUpPrompt(ledger, ex.screen, fixture.transcript)
          : mode === 'integrated'
            ? boundedUpdatePrompt(ledger, ex, catalog, [])
            : buildPrompt(ledger, ex)
        const response = await new Promise((resolve, reject) => {
          const child = spawn(
            'claude',
            [
              '-p',
              '--safe-mode',
              '--model',
              'sonnet',
              '--effort',
              'low',
              '--tools',
              '',
              '--strict-mcp-config',
              '--mcp-config',
              '{"mcpServers":{}}',
              '--no-session-persistence',
              '--output-format',
              'json',
              '--max-budget-usd',
              '0.15',
              '--system-prompt',
              system,
            ],
            { cwd: temp, stdio: ['pipe', 'pipe', 'pipe'] },
          )
          let stdout = '',
            stderr = ''
          const timeout = setTimeout(() => child.kill('SIGTERM'), 120_000)
          child.stdout.on('data', b => {
            stdout += b
          })
          child.stderr.on('data', b => {
            stderr += b
          })
          child.on('error', reject)
          child.on('close', code => {
            clearTimeout(timeout)
            if (code !== 0) reject(new Error('Claude failed: ' + code + ' ' + stderr.slice(-500)))
            else {
              try {
                resolve(JSON.parse(stdout))
              } catch {
                reject(new Error('Invalid JSON result'))
              }
            }
          })
          child.stdin.end(prompt)
        })
        if (response.is_error) throw new Error('Model call failed: ' + response.result)
        const parsed = parseReply(response.result, ex.reply)
        const suggestions = parseSuggestions(response.result, catalog.known, [])
        const passed =
          parsed !== null &&
          parsed.added.length === fixture.expectedNew &&
          (fixture.expectedClosed === undefined || parsed.closed.length === fixture.expectedClosed) &&
          (mode === 'baseline' || (fixture.suggestions === 'some' ? suggestions.length > 0 : suggestions.length === 0))
        const result = {
          fixture: fixture.name,
          attempt,
          mode,
          passed,
          promptBytes: byteLength(prompt),
          systemBytes: byteLength(system),
          added: parsed?.added.length ?? null,
          closed: parsed?.closed.length ?? null,
          next: suggestions.length,
          usage: response.usage,
          modelUsage: response.modelUsage,
          result: response.result,
        }
        results.push(result)
        await writeFile(output, JSON.stringify(results, null, 2) + '\n')
        console.log(
          JSON.stringify({
            fixture: fixture.name,
            attempt,
            mode,
            passed,
            added: result.added,
            next: result.next,
            usage: result.usage,
          }),
        )
      }
    }
  }
  if (results.some(r => !r.passed)) process.exitCode = 1
} finally {
  await rm(temp, { recursive: true, force: true })
}
