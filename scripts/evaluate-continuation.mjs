// Opt-in, synthetic meaning checks for the text a continuation gives Claude.
import { build } from '../codex/node_modules/esbuild/lib/main.js'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

if (!process.argv.includes('--run')) {
  console.log('Opt in with --run --output=/path/to/results.json. Runs 18 synthetic Sonnet calls using current sign-in.')
  process.exit(0)
}
const output = process.argv.find(s => s.startsWith('--output='))?.slice(9)
if (!output) throw new Error('Supply --output=/path/to/results.json')
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const temp = await mkdtemp(join(tmpdir(), 'inbox-continuation-eval-'))
try {
  const bundle = join(temp, 'continuation.mjs')
  await build({
    stdin: {
      contents: "export { EMPTY, carryText } from './hooks/ledger'; export * from './hooks/continuation'",
      resolveDir: root,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundle,
  })
  const { EMPTY, carryText, continuationDraft } = await import(pathToFileURL(bundle))
  const card = (now, done = []) => ({ goal: 'Review retry handling', done, now, running: [], updatedAt: 1 })
  const fixtures = [
    {
      name: 'completed',
      ledger: { ...EMPTY, card: card('The requested review is complete. Nothing pending.', ['Review completed']) },
      expected: 'complete',
    },
    {
      name: 'pending-decision',
      ledger: {
        ...EMPTY,
        card: card('Waiting on the user to choose the retry limit'),
        items: [
          {
            id: 'i1',
            kind: 'question',
            label: null,
            ask: 'Use three retries or five?',
            options: ['Three', 'Five'],
            rec: 'Three',
            helps: [],
            turn: 1,
            at: 1,
          },
        ],
      },
      expected: 'needs-user',
    },
    {
      name: 'unfinished-review',
      ledger: {
        ...EMPTY,
        card: card('Next: inspect cancellation behavior in the existing retry code', ['Review scope agreed']),
      },
      expected: 'inspect',
    },
  ]
  const system =
    'You are a coding assistant receiving a saved session summary. Classify the appropriate immediate next step. ' +
    'Reply only with JSON: {"state":"complete"|"needs-user"|"inspect","reason":"brief explanation"}. ' +
    'Use complete when no work remains, needs-user when an unanswered choice is required, or inspect when existing work should be checked before continuing.'
  const results = []
  for (const fixture of fixtures) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      for (const mode of ['baseline', 'draft']) {
        const prompt =
          mode === 'baseline'
            ? carryText(
                fixture.ledger,
                'inbox: the user chose to continue from the previous session in this folder (2m ago). Where it stood:',
              ) + '\n\nUser message: Continue.'
            : continuationDraft(fixture.ledger)
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
          child.on('error', e => {
            clearTimeout(timeout)
            reject(e)
          })
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
        let state = null
        try {
          state = JSON.parse(response.result.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()).state
        } catch {
          /* Malformed structured output fails this trial. */
        }
        const result = {
          fixture: fixture.name,
          mode,
          attempt,
          prompt,
          passed: state === fixture.expected,
          state,
          result: response.result,
          usage: response.usage,
          modelUsage: response.modelUsage,
        }
        results.push(result)
        await writeFile(output, JSON.stringify(results, null, 2) + '\n')
        console.log(JSON.stringify({ fixture: fixture.name, mode, attempt, state, passed: result.passed }))
      }
    }
  }
  if (results.some(r => !r.passed)) process.exitCode = 1
} finally {
  await rm(temp, { recursive: true, force: true })
}
