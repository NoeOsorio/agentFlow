// @plan B2-PR-4
import type { VariableAssignerNode } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'

interface VariableAssignerFormProps {
  value: Partial<VariableAssignerNode>
  onChange: (val: Partial<VariableAssignerNode>) => void
  availableVariables: AvailableVariable[]
}

export function VariableAssignerForm({ value, onChange, availableVariables }: VariableAssignerFormProps) {
  const assignments = value.assignments ?? []

  function addAssignment() {
    onChange({ ...value, assignments: [...assignments, { key: '', value: { literal: '' } }] })
  }

  function updateKey(idx: number, key: string) {
    onChange({ ...value, assignments: assignments.map((a, i) => (i === idx ? { ...a, key } : a)) })
  }

  function updateValue(idx: number, ref: Parameters<typeof VariableReferencePicker>[0]['value']) {
    const val =
      ref === null
        ? { literal: '' as const }
        : typeof ref === 'string'
          ? { literal: ref }
          : ref
    onChange({ ...value, assignments: assignments.map((a, i) => (i === idx ? { ...a, value: val } : a)) })
  }

  function remove(idx: number) {
    onChange({ ...value, assignments: assignments.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-300">Assignments</label>
        <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addAssignment}>
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {assignments.map((a, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              className="w-28 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none"
              placeholder="key"
              value={a.key}
              onChange={(e) => updateKey(idx, e.target.value)}
            />
            <span className="text-gray-600">=</span>
            <div className="flex-1">
              <VariableReferencePicker
                value={'literal' in a.value ? String(a.value.literal) : a.value}
                onChange={(v) => updateValue(idx, v)}
                availableVariables={availableVariables}
              />
            </div>
            <button
              type="button"
              className="text-xs text-gray-600 hover:text-red-400"
              onClick={() => remove(idx)}
            >
              ✕
            </button>
          </div>
        ))}
        {assignments.length === 0 && (
          <div className="text-xs text-gray-600">No assignments. Click + Add to start.</div>
        )}
      </div>
    </div>
  )
}
