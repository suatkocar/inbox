import { expect, test } from 'claude-code/testing'
import { adjacentOffset, caretPosition, cells, insertText, moveCaret, offsetAt, wrapReply } from '../hooks/reply-text'

test('wrapping preserves spaces, explicit newlines and graphemes at narrow widths', () => {
  for (const text of [
    'one two three four',
    'longunbrokenword',
    'ğış İ\n👩🏽‍💻你好e\u0301\n',
    '     space',
    ' aaa界',
    ' 1️⃣2️⃣',
  ]) {
    for (const width of [2, 4, 8, 32]) {
      const lines = wrapReply(text, width)
      expect(
        lines
          .flatMap(line => line.cells)
          .map(cell => cell.text)
          .join(''),
      ).toBe(text.replace(/\n/g, ''))
      for (const line of lines) expect(line.cells.reduce((n, c) => n + c.width, 0)).toBeLessThanOrEqual(width)
    }
  }
  expect(wrapReply('one two three', 8).map(line => line.cells.map(c => c.text).join(''))).toEqual(['one two ', 'three'])
  expect(caretPosition(wrapReply('abcd', 4), 4)).toEqual({ row: 1, column: 0 })
})

test('editing deletes whole Unicode graphemes and never splits the caret into one', () => {
  const text = 'ğ👩🏽‍💻e\u0301'
  const edit = { text, cursor: text.length, anchor: null }
  const previous = adjacentOffset(edit, -1)
  expect(insertText({ ...edit, anchor: previous }, '').text).toBe('ğ👩🏽‍💻')
  expect(adjacentOffset({ ...edit, cursor: previous }, -1)).toBe(1)
  expect(cells(text).map(c => c.text)).toEqual(['ğ', '👩🏽‍💻', 'e\u0301'])
  expect(insertText(moveCaret(edit, 0, true), 'New text')).toEqual({ text: 'New text', cursor: 8, anchor: null })
})

test('pointer and word navigation reach the end of a line and the final word', () => {
  const text = 'one two'
  const edit = { text, cursor: 0, anchor: null }
  expect(adjacentOffset(edit, 1, true)).toBe(4)
  expect(adjacentOffset({ ...edit, cursor: 4 }, 1, true)).toBe(7)
  expect(adjacentOffset({ ...edit, cursor: 7 }, -1, true)).toBe(4)
  expect(offsetAt(wrapReply('你好test', 20)[0]!, 2)).toBe(1)
  expect(offsetAt(wrapReply(text, 20)[0]!, 50)).toBe(7)
})
