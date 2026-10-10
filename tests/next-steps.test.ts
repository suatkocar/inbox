import { expect, test } from 'claude-code/testing'
import { EMPTY } from '../hooks/ledger'
import {
  byteLength,
  boundedUpdatePrompt,
  boundedRecoveryPrompt,
  commandCatalog,
  parseSuggestions,
  suggestionKey,
  NEXT_INSTRUCTIONS,
  recentText,
} from '../hooks/next-steps'

const command = (name: string, description = name) => ({ name, description, source: 'plugin' as const })

test('bounds every dynamic request in UTF-8 bytes even for long Unicode input', () => {
  const huge = '画像🙂'.repeat(30_000)
  const prompt = boundedUpdatePrompt(
    EMPTY,
    {
      person: huge,
      trigger: null,
      activity: [huge],
      reply: huge,
      turn: 1,
      press: null,
      screen: huge,
      checks: [huge],
    },
    commandCatalog([command('test', huge)], 'test'),
    [huge],
  )
  expect(byteLength(prompt) <= 24_000).toBe(true)
  expect(prompt).toContain('</checks>')
  expect(prompt).toContain('<skills>')
  expect(prompt).not.toContain('data:image')
  expect(byteLength(boundedRecoveryPrompt(EMPTY, huge, huge)) <= 24_000).toBe(true)
})

test('ranks relevant installed skills within a small catalog instead of sending all definitions', () => {
  const commands = Array.from({ length: 500 }, (_, n) => command(`tool-${n}`, 'generic helper '.repeat(20)))
  commands.push(command('review-tests', 'Review tests and assertions'))
  const catalog = commandCatalog(commands, 'review the tests')
  expect(byteLength(catalog.text) <= 1200).toBe(true)
  expect(catalog.text).toContain('/review-tests')
  expect(catalog.known.has('review-tests')).toBe(true)
})

test('keeps core ledger output separate and rejects malformed, oversized and duplicate suggestions', () => {
  const row = (label: string, prompt: string) => 'NEXT: ' + JSON.stringify({ label, prompt })
  const text = [
    'GOAL: Finish the fix',
    'NEW: decide | - | Publish? | Yes / No | No',
    'NEXT: {broken',
    row('Inspect retry coverage', 'Inspect the retry tests.'),
    row('Duplicate', 'Inspect the retry tests.'),
    row('Too long', 'x'.repeat(361)),
    row('Unknown', '/imaginary fix it'),
    row('Known', '/review-tests src/retry.ts'),
    row('Quit', '/exit'),
    row('Control', 'look\u001b[31m here'),
  ].join('\n')
  expect(parseSuggestions(text, new Set(['review-tests', 'exit']), []).map(s => s.prompt)).toEqual([
    'Inspect the retry tests.',
    '/review-tests src/retry.ts',
  ])
  expect(
    parseSuggestions(row('Dismissed', 'Inspect the retry tests.'), new Set(), [
      suggestionKey('Inspect the retry tests.'),
    ]),
  ).toEqual([])
  expect(
    parseSuggestions('NEXT: ' + JSON.stringify({ label: 'valid', prompt: 'Check it', extra: true }), new Set(), []),
  ).toEqual([])
})

test('keeps code punctuation intact and fails closed for unknown slash commands', () => {
  const row = (prompt: string) => 'NEXT: ' + JSON.stringify({ label: 'Check behavior', prompt })
  expect(parseSuggestions(row('Check `x !== null` and "foo".'), new Set(), [])[0]?.prompt).toBe(
    'Check `x !== null` and "foo".',
  )
  expect(parseSuggestions(row('/review-tests'), new Set(), [])).toEqual([])
  expect(parseSuggestions('NEXT: []', new Set(), [])).toEqual([])
  expect(NEXT_INSTRUCTIONS).toContain('Never put a suggestion in NEW')
})

test('recovery keeps the newest Unicode text and strips image data before budgeting', () => {
  const transcript = 'old '.repeat(8000) + '\nPerson: 最新🙂 message\nAgent: data:image/png;base64,AAAAAA'
  const prompt = boundedRecoveryPrompt(EMPTY, '', transcript)
  expect(prompt).toContain('最新🙂 message')
  expect(prompt).toContain('[image data omitted]')
  expect(prompt).not.toContain('base64')
  expect(recentText('old🙂最新', 6)).toBe('最新')
})

test('many code fences and a full ledger cannot crowd out check evidence or closing tags', () => {
  const item = {
    id: 'i1',
    kind: 'question' as const,
    label: null,
    ask: 'q'.repeat(500),
    options: [],
    rec: null,
    helps: [],
    turn: 1,
    at: 1,
  }
  const ledger = {
    ...EMPTY,
    items: Array.from({ length: 20 }, (_, n) => ({ ...item, id: 'i' + n })),
    findings: Array.from({ length: 30 }, (_, n) => ({
      id: 'f' + n,
      kind: 'issue' as const,
      title: 'f'.repeat(1000),
      detail: '',
      path: null,
      at: 0,
    })),
    closed: Array.from({ length: 12 }, (_, n) => ({
      id: 'i' + n,
      kind: 'question' as const,
      ask: 'c'.repeat(1000),
      outcome: 'done'.repeat(400),
      how: 'dismissed' as const,
      at: 1,
    })),
  }
  const prompt = boundedUpdatePrompt(
    ledger,
    {
      person: 'person'.repeat(1000),
      trigger: null,
      activity: ['a'.repeat(4000)],
      reply: '```\nx\n```\n'.repeat(1200),
      turn: 1,
      press: null,
      screen: 'Inbox closed.',
      checks: [...Array.from({ length: 100 }, () => '✓ test passed: '.repeat(30)), '✗ REQUIRED_TEST_FAILED'],
    },
    { text: 'skill '.repeat(200), known: new Set() },
    [],
  )
  expect(byteLength(prompt) <= 24000).toBe(true)
  expect(prompt).toContain('REQUIRED_TEST_FAILED')
  expect(prompt).toContain('</checks>')
  expect(prompt).toContain('</dismissed>')
})
