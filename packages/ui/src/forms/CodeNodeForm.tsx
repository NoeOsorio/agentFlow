// @plan B2-PR-4
import type { CodeNode, VariableReference } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'
import { CodeEditor } from './widgets/CodeEditor'

interface CodeNodeFormProps {
  value: Partial<CodeNode>
  onChange: (val: Partial<CodeNode>) => void
  availableVariables: AvailableVariable[]
}

export function CodeNodeForm({ value, onChange, availableVariables }: CodeNodeFormProps) {
  const inputs: VariableReference[] = value.inputs ?? []

  function addInput() {
    onChange({ ...value, inputs: [...inputs, { node_id: '', variable: '', path: [] }] })
  }

  function updateInput(idx: number, ref: VariableReference | string | null) {
    if (!ref || typeof ref === 'string') return
    onChange({ ...value, inputs: inputs.map((v, i) => (i === idx ? ref : v)) })
  }

  function removeInput(idx: number) {
    onChange({ ...value, inputs: inputs.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-5">
      {/* Language */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Language</label>
        <div className="flex gap-2">
          {(['python', 'javascript'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              className={`rounded px-3 py-1 text-xs font-medium capitalize ${
                value.language === lang
                  ? 'bg-orange-600 text-white'
                  : 'border border-gray-600 text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => onChange({ ...value, language: lang })}
            >
              {lang === 'javascript' ? 'JavaScript' : 'Python'}
            </button>
          ))}
        </div>
      </div>

      {/* Code editor */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Code</label>
        <CodeEditor
          value={value.code ?? ''}
          onChange={(code) => onChange({ ...value, code })}
          language={value.language ?? 'python'}
        />
      </div>

      {/* Inputs */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Inputs</label>
          <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addInput}>
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {inputs.map((ref, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="flex-1">
                <VariableReferencePicker
                  value={ref}
                  onChange={(v) => updateInput(idx, v)}
                  availableVariables={availableVariables}
                />
              </div>
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-red-400"
                onClick={() => removeInput(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Timeout */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Timeout (seconds)</label>
        <input
          type="number"
          min={1}
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value.timeout_seconds ?? ''}
          placeholder="No timeout"
          onChange={(e) =>
            onChange({ ...value, timeout_seconds: e.target.value ? parseInt(e.target.value) : undefined })
          }
        />
      </div>
    </div>
  )
}
