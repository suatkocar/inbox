import type { ClientModule } from 'claude-code'
import {
  adjacentOffset,
  caretPosition,
  insertText,
  MAX_REPLY_LENGTH,
  moveCaret,
  offsetAt,
  wrapReply,
} from './reply-text'
import type { Edit } from './reply-text'

type Props = {
  sessionId: string
  rowId: string
  value: string
  columns: number
  accent: string
  muted: string
  demo: boolean
}
type Local = {
  edit: Edit
  history: Edit[]
  redo: Edit[]
  live: Props
  top: number
  column: number | null
  dragging: boolean
  pending: boolean
  error: string
}
const MAX_ROWS = 12
const SPECIAL = new Set([
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pageup',
  'pagedown',
  'return',
  'tab',
  'backspace',
  'delete',
  'escape',
])

const ReplyEditor: ClientModule<Props, Local> = (props, surface) => {
  const { Box, Text, Button } = surface.elements
  const width = () => Math.max(2, (surface.columns || props.columns) - 4)
  const send = (kind: 'change' | 'submit' | 'cancel', state: Local) =>
    surface.post({ kind, rowId: state.live.rowId, sessionId: state.live.sessionId, text: state.edit.text })
  const commit = (state: Local, edit: Edit, save = true) => {
    if (edit.text.length > MAX_REPLY_LENGTH) {
      surface.setState({
        ...state,
        error: `Reply limit: ${MAX_REPLY_LENGTH.toLocaleString()} characters. Your draft is unchanged.`,
      })
      return
    }
    const changed = edit.text !== state.edit.text
    const next = {
      ...state,
      edit,
      column: null,
      error: '',
      ...(changed && save ? { history: [...state.history, state.edit].slice(-40), redo: [] } : {}),
    }
    surface.setState(next)
    if (changed) send('change', next)
  }
  const submit = () => {
    const state = surface.state
    if (!state || state.pending || !state.edit.text.trim()) return
    surface.setState({ ...state, pending: !state.live.demo })
    send('submit', state)
  }
  if (!surface.state) {
    surface.setState({
      edit: { text: props.value, cursor: props.value.length, anchor: null },
      history: [],
      redo: [],
      live: props,
      top: 0,
      column: null,
      dragging: false,
      pending: false,
      error: '',
    })
    surface.onKey(e => {
      const state = surface.state
      if (!state || state.pending) return
      const { edit } = state
      const key = e.key.toLowerCase()
      if (key === 'return') {
        if (e.shift || e.meta) commit(state, insertText(edit, '\n'))
        else submit()
        return
      }
      if (e.ctrl || e.meta) {
        if (key === 'a') {
          surface.setState({ ...state, edit: { ...edit, cursor: edit.text.length, anchor: 0 } })
          return
        }
        if (key === 'z' || (e.ctrl && key === 'y')) {
          const redo = e.shift || key === 'y'
          const stack = redo ? state.redo : state.history
          const previous = stack.at(-1)
          if (previous)
            commit(
              {
                ...state,
                history: redo ? [...state.history, edit] : stack.slice(0, -1),
                redo: redo ? stack.slice(0, -1) : [...state.redo, edit],
              },
              previous,
              false,
            )
          return
        }
      }
      if (key === 'left' || key === 'right') {
        const direction = key === 'left' ? -1 : 1
        const selected = edit.anchor !== null && edit.anchor !== edit.cursor
        const target =
          selected && !e.shift && !e.meta && !e.ctrl
            ? direction < 0
              ? Math.min(edit.anchor!, edit.cursor)
              : Math.max(edit.anchor!, edit.cursor)
            : adjacentOffset(edit, direction, e.meta || e.ctrl)
        commit(state, moveCaret(edit, target, e.shift))
        return
      }
      const lines = wrapReply(edit.text, width())
      const position = caretPosition(lines, edit.cursor)
      if (key === 'home' || key === 'end') {
        const target =
          e.ctrl || e.meta
            ? key === 'home'
              ? 0
              : edit.text.length
            : key === 'home'
              ? lines[position.row]!.start
              : lines[position.row]!.end
        commit(state, moveCaret(edit, target, e.shift))
        return
      }
      if (key === 'up' || key === 'down' || key === 'pageup' || key === 'pagedown') {
        const direction = key === 'up' || key === 'pageup' ? -1 : 1
        const row = Math.max(
          0,
          Math.min(lines.length - 1, position.row + direction * (key.startsWith('page') ? MAX_ROWS : 1)),
        )
        const column = state.column ?? position.column
        surface.setState({ ...state, column, edit: moveCaret(edit, offsetAt(lines[row]!, column), e.shift) })
        return
      }
      if (key === 'backspace' || key === 'delete') {
        const selected = edit.anchor !== null && edit.anchor !== edit.cursor
        const range = selected
          ? edit
          : { ...edit, anchor: adjacentOffset(edit, key === 'backspace' ? -1 : 1, e.meta || e.ctrl) }
        commit(state, insertText(range, ''))
        return
      }
      if (key === 'tab') {
        commit(state, insertText(edit, '    '))
        return
      }
      if (!e.ctrl && !e.meta && !SPECIAL.has(key)) commit(state, insertText(edit, e.key === 'space' ? ' ' : e.key))
    })
    surface.onPointer(e => {
      const state = surface.state
      if (!state || state.pending) return
      if (e.type === 'up') {
        surface.setState({ ...state, dragging: false })
        return
      }
      if (e.button !== 'left' || (e.type !== 'down' && !(e.type === 'move' && state.dragging))) return
      const lines = wrapReply(state.edit.text, width())
      const rowCount = Math.min(MAX_ROWS, Math.max(2, lines.length))
      if (e.type === 'down' && (e.y < 1 || e.y > rowCount)) return
      const row = Math.max(0, Math.min(lines.length - 1, state.top + e.y - 1))
      const cursor = offsetAt(lines[row]!, Math.max(0, e.x - 2))
      const anchor = e.type === 'down' && !e.shift ? cursor : (state.edit.anchor ?? state.edit.cursor)
      surface.setState({ ...state, edit: { ...state.edit, cursor, anchor }, column: null, dragging: true })
    })
    return <Text dimColor>Opening reply editor…</Text>
  }
  const state = surface.state
  if (state.live.sessionId !== props.sessionId || state.live.rowId !== props.rowId) {
    surface.setState({
      ...state,
      live: props,
      edit: { text: props.value, cursor: props.value.length, anchor: null },
      history: [],
      redo: [],
      top: 0,
      column: null,
      dragging: false,
      pending: false,
      error: '',
    })
    return <Text dimColor>Opening reply editor…</Text>
  }
  state.live = props
  const lines = wrapReply(state.edit.text, width())
  const position = caretPosition(lines, state.edit.cursor)
  const count = Math.min(MAX_ROWS, Math.max(2, lines.length))
  state.top = Math.max(0, Math.min(state.top, position.row, Math.max(0, lines.length - count)))
  if (position.row >= state.top + count) state.top = position.row - count + 1
  const selectedStart = Math.min(state.edit.cursor, state.edit.anchor ?? state.edit.cursor)
  const selectedEnd = Math.max(state.edit.cursor, state.edit.anchor ?? state.edit.cursor)
  return (
    <Box flexDirection="column" width="100%">
      <Box flexDirection="column" borderStyle="round" borderColor={props.accent} paddingX={1}>
        {Array.from({ length: count }, (_, i) => {
          const row = state.top + i
          const line = lines[row]
          if (!line) return <Text> </Text>
          // Group runs so long lines stay well within the Client's tree budget.
          const runs: { text: string; inverse: boolean }[] = []
          for (const cell of line.cells) {
            const inverse =
              (cell.start >= selectedStart && cell.start < selectedEnd) ||
              (row === position.row && cell.start === state.edit.cursor)
            const previous = runs.at(-1)
            if (previous?.inverse === inverse) previous.text += cell.text
            else runs.push({ text: cell.text, inverse })
          }
          const text = runs.map(run => <Text inverse={run.inverse}>{run.text}</Text>)
          const atEnd = row === position.row && state.edit.cursor === line.end
          return (
            <Text wrap="truncate-end">
              {text}
              {atEnd ? <Text inverse> </Text> : null}
              {!text.length && !atEnd ? ' ' : ''}
            </Text>
          )
        })}
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <Button key="save-reply" label="Keep draft" onPress={() => send('cancel', surface.state!)} />
        <Button key="send-reply" label={state.pending ? 'Sending…' : 'Send'} onPress={submit} />
      </Box>
      <Text color={props.muted} wrap="wrap">
        {state.edit.text ? 'Enter sends · Shift+Enter adds a line' : 'Click inside to write · Enter sends'}
      </Text>
      {lines.length > count ? (
        <Text color={props.muted}>
          Lines {state.top + 1}–{state.top + count} of {lines.length} · ↑ ↓
        </Text>
      ) : null}
      {state.error ? (
        <Text color="yellow" wrap="wrap">
          {state.error}
        </Text>
      ) : null}
    </Box>
  )
}

export default ReplyEditor
