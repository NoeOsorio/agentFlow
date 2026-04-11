// @plan B2-PR-4
import { useState, useRef } from 'react'
import type { Prompt } from '@agentflow/core'
import type { AvailableVariable } from './VariableReferencePicker'
import { VariableReferencePicker } from './VariableReferencePicker'
import type { VariableReference } from '@agentflow/core'

interface PromptEditorProps {
  value: Prompt
  onChange: (prompt: Prompt) => void
  availableVariables?: AvailableVariable[]
  /** When false, only the user tab is shown (e.g. for template nodes) */
  showSystemTab?: boolean
}

const VAR_PATTERN = /\{\{#[^#]+#\}\}/g

/** Render text with highlighted {{#...#}} references */
function highlightRefs(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  // reset
  VAR_PATTERN.lastIndex = 0
  const re = new RegExp(VAR_PATTERN.source, 'g')
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    parts.push(
      <mark key={match.index} className="rounded bg-blue-900 px-0.5 text-blue-300">
        {match[0]}
      </mark>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export function PromptEditor({
  value,
  onChange,
  availableVariables = [],
  showSystemTab = true,
}: PromptEditorProps) {
  const [tab, setTab] = useState<'system' | 'user'>(showSystemTab ? 'system' : 'user')
  const [pickerOpen, setPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const tabs: Array<'system' | 'user'> = showSystemTab ? ['system', 'user'] : ['user']

  function getVal(t: 'system' | 'user'): string {
    return t === 'system' ? (value.system ?? '') : value.user
  }

  function setVal(t: 'system' | 'user', text: string) {
    if (t === 'system') onChange({ ...value, system: text })
    else onChange({ ...value, user: text })
  }

  function insertVariable(ref: VariableReference | string | null) {
    if (!ref || typeof ref === 'string') return
    const refStr = `{{#${ref.node_id}.${ref.variable}${ref.path.length ? '.' + ref.path.join('.') : ''}#}}`
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const current = getVal(tab)
    const next = current.slice(0, start) + refStr + current.slice(end)
    setVal(tab, next)
    setPickerOpen(false)
    // restore cursor after the insert
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + refStr.length
      ta.focus()
    })
  }

  const currentText = getVal(tab)

  return (
    <div className="space-y-2">
      {/* Tabs */}
      {showSystemTab && (
        <div className="flex gap-1 border-b border-gray-700">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              className={`px-3 py-1 text-xs font-medium capitalize ${
                tab === t
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={6}
          placeholder={tab === 'system' ? 'System prompt…' : 'User message…'}
          value={currentText}
          onChange={(e) => setVal(tab, e.target.value)}
        />
        {/* Highlight preview (read-only overlay — just show highlighted text in a div below) */}
      </div>

      {/* Preview with highlights */}
      {currentText && (
        <div className="rounded border border-gray-700 bg-gray-900/50 px-3 py-2 font-mono text-sm leading-relaxed text-gray-300">
          {highlightRefs(currentText)}
        </div>
      )}

      {/* Insert variable */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:border-blue-500 hover:text-blue-400"
          onClick={() => setPickerOpen((o) => !o)}
        >
          {'{ }'} Insert Variable
        </button>
      </div>

      {pickerOpen && (
        <VariableReferencePicker
          value={null}
          onChange={insertVariable}
          availableVariables={availableVariables}
          placeholder="Pick a variable to insert…"
        />
      )}
    </div>
  )
}
