// @plan B2-PR-4
import { useState } from 'react'
import type { VariableReference } from '@agentflow/core'

export interface AvailableVariable {
  node_id: string
  node_label: string
  variable: string
  type?: string
}

interface VariableReferencePickerProps {
  value: VariableReference | string | null
  onChange: (val: VariableReference | string | null) => void
  availableVariables: AvailableVariable[]
  placeholder?: string
}

function toRefString(ref: VariableReference): string {
  const parts = [ref.node_id, ref.variable, ...ref.path]
  return `{{#${parts.join('.')}#}}`
}

export function VariableReferencePicker({
  value,
  onChange,
  availableVariables,
  placeholder = 'Select variable or enter literal…',
}: VariableReferencePickerProps) {
  const [literalMode, setLiteralMode] = useState(
    value !== null && typeof value === 'string',
  )
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = availableVariables.filter(
    (v) =>
      v.variable.toLowerCase().includes(query.toLowerCase()) ||
      v.node_label.toLowerCase().includes(query.toLowerCase()),
  )

  const grouped: Record<string, AvailableVariable[]> = {}
  for (const v of filtered) {
    ;(grouped[v.node_id] ??= []).push(v)
  }

  const displayValue =
    value === null
      ? ''
      : typeof value === 'string'
        ? value
        : toRefString(value)

  if (literalMode) {
    return (
      <div className="flex gap-1">
        <input
          className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Literal value"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
          onClick={() => { setLiteralMode(false); onChange(null) }}
        >
          ⬡ Ref
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <button
          type="button"
          className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-left text-sm text-gray-100 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onClick={() => setOpen((o) => !o)}
        >
          {displayValue || <span className="text-gray-500">{placeholder}</span>}
        </button>
        <button
          type="button"
          className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
          onClick={() => { setLiteralMode(true); onChange('') }}
        >
          Aa
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded border border-gray-600 bg-gray-850 shadow-lg" style={{ backgroundColor: '#1a1f2e' }}>
          <div className="p-2">
            <input
              autoFocus
              className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-100 placeholder-gray-500 focus:outline-none"
              placeholder="Search variables…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {Object.entries(grouped).length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-500">No variables found</div>
            )}
            {Object.entries(grouped).map(([nodeId, vars]) => (
              <div key={nodeId}>
                <div className="px-3 py-1 text-xs font-semibold uppercase text-gray-500">
                  {vars[0]?.node_label ?? nodeId}
                </div>
                {vars.map((v) => {
                  const ref: VariableReference = { node_id: v.node_id, variable: v.variable, path: [] }
                  return (
                    <button
                      key={`${v.node_id}.${v.variable}`}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
                      onClick={() => { onChange(ref); setOpen(false) }}
                    >
                      <span className="font-mono text-blue-400">{`{{#${v.node_id}.${v.variable}#}}`}</span>
                      {v.type && (
                        <span className="ml-auto text-xs text-gray-500">{v.type}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
