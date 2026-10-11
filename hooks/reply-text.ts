/** Text positions are UTF-16 offsets; editing and wrapping keep grapheme clusters intact. */
export type Edit = { text: string; cursor: number; anchor: number | null }
export type Cell = { text: string; start: number; end: number; width: number }
export type Line = { start: number; end: number; cells: Cell[] }

export const MAX_REPLY_LENGTH = 20_000

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function cells(text: string): Cell[] {
  return [...segmenter.segment(text)].map(({ segment, index }) => {
    const code = segment.codePointAt(0) ?? 0
    const wide =
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(segment) ||
      (code >= 0x1100 &&
        (code <= 0x115f ||
          code === 0x2329 ||
          code === 0x232a ||
          (code >= 0x2e80 && code <= 0xa4cf) ||
          (code >= 0xac00 && code <= 0xd7a3) ||
          (code >= 0xf900 && code <= 0xfaff) ||
          (code >= 0xfe10 && code <= 0xfe6f) ||
          (code >= 0xff00 && code <= 0xff60) ||
          (code >= 0xffe0 && code <= 0xffe6) ||
          code >= 0x20000))
    return { text: segment, start: index, end: index + segment.length, width: segment === '\n' ? 0 : wide ? 2 : 1 }
  })
}

/** Keeps whitespace in the text while preferring a word boundary for soft wraps. */
export function wrapReply(text: string, columns: number): Line[] {
  const width = Math.max(2, columns)
  const lines: Line[] = []
  let row: Cell[] = []
  let start = 0
  let used = 0
  const flush = (end: number) => {
    lines.push({ start, end, cells: row })
    row = []
    used = 0
    start = end
  }
  for (const cell of cells(text)) {
    if (cell.text === '\n') {
      flush(cell.start)
      start = cell.end
      continue
    }
    if (used + cell.width > width) {
      const space = row.findLastIndex(c => c.text === ' ')
      const tail = row.slice(space + 1)
      const tailWidth = tail.reduce((n, c) => n + c.width, 0)
      if (space >= 0 && space < row.length - 1 && tailWidth + cell.width <= width) {
        row = row.slice(0, space + 1)
        flush(tail[0]!.start)
        row = tail
        used = tailWidth
      } else flush(cell.start)
    }
    row.push(cell)
    used += cell.width
  }
  flush(text.length)
  // A caret after an exactly full line belongs on the next visual line.
  if (lines.at(-1)!.cells.reduce((n, c) => n + c.width, 0) === width)
    lines.push({ start: text.length, end: text.length, cells: [] })
  return lines
}

export function caretPosition(lines: Line[], cursor: number): { row: number; column: number } {
  const row = Math.max(
    0,
    lines.findLastIndex(line => line.start <= cursor),
  )
  return { row, column: lines[row]!.cells.filter(c => c.end <= cursor).reduce((n, c) => n + c.width, 0) }
}

export function offsetAt(line: Line, column: number): number {
  let x = 0
  for (const cell of line.cells) {
    if (column < x + cell.width / 2) return cell.start
    x += cell.width
  }
  return line.end
}

export function moveCaret(edit: Edit, cursor: number, select = false): Edit {
  return {
    ...edit,
    cursor: Math.max(0, Math.min(edit.text.length, cursor)),
    anchor: select ? (edit.anchor ?? edit.cursor) : null,
  }
}

export function insertText(edit: Edit, inserted: string): Edit {
  const text = inserted
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
  const start = Math.min(edit.cursor, edit.anchor ?? edit.cursor)
  const end = Math.max(edit.cursor, edit.anchor ?? edit.cursor)
  return { text: edit.text.slice(0, start) + text + edit.text.slice(end), cursor: start + text.length, anchor: null }
}

export function adjacentOffset(edit: Edit, direction: -1 | 1, word = false): number {
  const parts = cells(edit.text)
  if (direction < 0) {
    let i = parts.findLastIndex(c => c.start < edit.cursor)
    if (word) {
      while (i > 0 && /^\s+$/u.test(parts[i]!.text)) i--
      while (i > 0 && !/^\s+$/u.test(parts[i - 1]!.text)) i--
    }
    return parts[i]?.start ?? 0
  }
  let i = parts.findIndex(c => c.end > edit.cursor)
  if (i < 0) return edit.text.length
  if (word) {
    while (i < parts.length && !/^\s+$/u.test(parts[i]!.text)) i++
    while (i < parts.length && /^\s+$/u.test(parts[i]!.text)) i++
    return parts[i]?.start ?? edit.text.length
  }
  return parts[i]!.end
}
