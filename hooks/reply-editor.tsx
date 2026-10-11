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
  open: boolean
  label: string
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
  pending: boolean
  error: string
  open: boolean
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
  const columns = () => Math.max(6, surface.columns || props.columns)
  const width = () => columns() - 4
  const send = (kind: 'open' | 'change' | 'submit' | 'cancel', state: Local) =>
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
    if (!state || !state.open || state.pending || !state.edit.text.trim()) return
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
      pending: false,
      error: '',
      open: props.open,
    })
    surface.onKey(e => {
      let state = surface.state
      if (!state || state.pending) return
      if (!state.open) {
        state = { ...state, open: true }
        surface.setState(state)
        send('open', state)
      }
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
    // Registering a pointer listener enables pixel mouse reports in the host.
    // Terminals with fractional cell sizes can then misplace clicks throughout
    // the pane. A keyboard-only Client still receives focus from a native click.
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
      pending: false,
      error: '',
      open: props.open,
    })
    return <Text dimColor>Opening reply editor…</Text>
  }
  if (state.live.open !== props.open) {
    state.open = props.open
    state.pending = false
  }
  if (!state.open && props.value !== state.live.value) {
    state.edit = { text: props.value, cursor: props.value.length, anchor: null }
    state.history = []
    state.redo = []
    state.top = 0
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
      <Box
        key="reply-field"
        flexDirection="column"
        borderStyle="round"
        borderColor={props.muted}
        hover={{ borderColor: props.accent }}
        paddingX={1}
      >
        {Array.from({ length: count }, (_, i) => {
          const row = state.top + i
          const line = lines[row]
          if (!state.edit.text && i === 0 && !state.open) return <Text color={props.muted}>{props.label}…</Text>
          if (!line) return <Text> </Text>
          // Group runs so long lines stay well within the Client's tree budget.
          const runs: { text: string; inverse: boolean }[] = []
          for (const cell of line.cells) {
            const inverse =
              (cell.start >= selectedStart && cell.start < selectedEnd) ||
              (state.open && row === position.row && cell.start === state.edit.cursor)
            const previous = runs.at(-1)
            if (previous?.inverse === inverse) previous.text += cell.text
            else runs.push({ text: cell.text, inverse })
          }
          const text = runs.map(run => <Text inverse={run.inverse}>{run.text}</Text>)
          const atEnd = state.open && row === position.row && state.edit.cursor === line.end
          return (
            <Text wrap="truncate-end">
              {text}
              {atEnd ? <Text inverse> </Text> : null}
              {!text.length && !atEnd ? ' ' : ''}
            </Text>
          )
        })}
      </Box>
      {state.open ? (
        <Box flexDirection="row" flexWrap="wrap" justifyContent="space-between" columnGap={2}>
          <Button
            key="reply-keep"
            label="Keep draft"
            onPress={() => {
              const current = surface.state
              if (!current || current.pending) return
              surface.setState({ ...current, open: false })
              send('cancel', current)
            }}
          />
          {state.edit.text.trim() && !state.pending ? (
            <Button key="reply-send" label="Send" onPress={submit} />
          ) : (
            <Text color={props.muted}>{state.pending ? 'Sending…' : 'Send'}</Text>
          )}
        </Box>
      ) : null}
      <Text color={props.muted} wrap="wrap">
        {state.open
          ? 'Enter sends · Shift+Enter adds a line · Arrow keys move the cursor'
          : state.edit.text
            ? 'Draft saved · Click inside to continue.'
            : 'Click inside to write · Enter sends'}
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
