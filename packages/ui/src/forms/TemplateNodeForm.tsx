// @plan B2-PR-4
import type { TemplateNode, VariableReference } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'
import { PromptEditor } from './widgets/PromptEditor'

interface TemplateNodeFormProps {
  value: Partial<TemplateNode>
  onChange: (val: Partial<TemplateNode>) => void
  availableVariables: AvailableVariable[]
}

export function TemplateNodeForm({ value, onChange, availableVariables }: TemplateNodeFormProps) {
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
      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-300">Template</label>
        <PromptEditor
          value={{ user: value.template ?? '' }}
          onChange={(p) => onChange({ ...value, template: p.user })}
          availableVariables={availableVariables}
          showSystemTab={false}
        />
      </div>

      {/* Input bindings */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Input bindings</label>
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
    </div>
  )
}
