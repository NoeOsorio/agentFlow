// @plan B2-PR-4
import type { IterationNode } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { VariableReferencePicker } from './widgets/VariableReferencePicker'

interface IterationNodeFormProps {
  value: Partial<IterationNode>
  onChange: (val: Partial<IterationNode>) => void
  availableVariables: AvailableVariable[]
}

export function IterationNodeForm({ value, onChange, availableVariables }: IterationNodeFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Input list</label>
        <VariableReferencePicker
          value={value.input_list ?? null}
          onChange={(ref) => {
            if (ref && typeof ref !== 'string') {
              onChange({ ...value, input_list: ref })
            }
          }}
          availableVariables={availableVariables}
          placeholder="Select list variable…"
        />
        <p className="mt-1 text-xs text-gray-600">
          Each item in this list will be passed to the body nodes as the iterator variable.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Iterator variable name</label>
        <input
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 font-mono text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="item"
          value={value.iterator_var ?? ''}
          onChange={(e) => onChange({ ...value, iterator_var: e.target.value })}
        />
        <p className="mt-1 text-xs text-gray-600">
          Available inside the iteration body as <code className="text-blue-400">{'{{#loop.' + (value.iterator_var || 'item') + '#}}'}</code>
        </p>
      </div>
    </div>
  )
}
