// @plan B2-PR-4
import type { VariableAggregatorNode } from '@agentflow/core'

interface VariableAggregatorFormProps {
  value: Partial<VariableAggregatorNode>
  onChange: (val: Partial<VariableAggregatorNode>) => void
}

const STRATEGY_LABELS: Record<string, string> = {
  first: 'First — use the first completed branch',
  merge: 'Merge — deep-merge all branch outputs',
  list: 'List — collect all into an array',
}

export function VariableAggregatorForm({ value, onChange }: VariableAggregatorFormProps) {
  const branches = value.branches ?? []

  function addBranch() {
    onChange({ ...value, branches: [...branches, ''] })
  }

  function updateBranch(idx: number, val: string) {
    onChange({ ...value, branches: branches.map((b, i) => (i === idx ? val : b)) })
  }

  function removeBranch(idx: number) {
    onChange({ ...value, branches: branches.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-4">
      {/* Branches */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Input branches</label>
          <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addBranch}>
            + Add branch
          </button>
        </div>
        <div className="space-y-1.5">
          {branches.map((branch, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-sm text-gray-300 focus:outline-none"
                placeholder="branch_id"
                value={branch}
                onChange={(e) => updateBranch(idx, e.target.value)}
              />
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-red-400"
                onClick={() => removeBranch(idx)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Output key */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Output key</label>
        <input
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="aggregated_output"
          value={value.output_key ?? ''}
          onChange={(e) => onChange({ ...value, output_key: e.target.value })}
        />
      </div>

      {/* Strategy */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Strategy</label>
        <div className="space-y-1">
          {(['first', 'merge', 'list'] as const).map((s) => (
            <label key={s} className="flex cursor-pointer items-start gap-2 rounded border border-gray-700 p-2 hover:border-gray-500">
              <input
                type="radio"
                className="mt-0.5 accent-blue-500"
                name="strategy"
                value={s}
                checked={value.strategy === s}
                onChange={() => onChange({ ...value, strategy: s })}
              />
              <div>
                <span className="text-sm font-medium capitalize text-gray-200">{s}</span>
                <p className="text-xs text-gray-500">{STRATEGY_LABELS[s]}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
