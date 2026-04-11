// @plan B2-PR-4
import type { Condition, ConditionGroup, ConditionOperator, VariableReference } from '@agentflow/core'
import type { AvailableVariable } from './VariableReferencePicker'
import { VariableReferencePicker } from './VariableReferencePicker'

const OPERATORS: Array<{ value: ConditionOperator; label: string; needsRight: boolean }> = [
  { value: 'eq', label: '= equals', needsRight: true },
  { value: 'ne', label: '≠ not equals', needsRight: true },
  { value: 'gt', label: '> greater than', needsRight: true },
  { value: 'gte', label: '≥ greater or equal', needsRight: true },
  { value: 'lt', label: '< less than', needsRight: true },
  { value: 'lte', label: '≤ less or equal', needsRight: true },
  { value: 'contains', label: '∋ contains', needsRight: true },
  { value: 'not_contains', label: '∌ not contains', needsRight: true },
  { value: 'starts_with', label: '⇤ starts with', needsRight: true },
  { value: 'ends_with', label: '⇥ ends with', needsRight: true },
  { value: 'is_empty', label: '∅ is empty', needsRight: false },
  { value: 'is_not_empty', label: '◉ is not empty', needsRight: false },
]

interface ConditionBuilderProps {
  groups: ConditionGroup[]
  onChange: (groups: ConditionGroup[]) => void
  availableVariables: AvailableVariable[]
  defaultBranch: string
  onDefaultBranchChange: (val: string) => void
}

function emptyCondition(branchId: string): Condition {
  return {
    left: { node_id: '', variable: '', path: [] },
    operator: 'eq',
    right: { literal: '' },
    branch_id: branchId,
  }
}

function emptyGroup(): ConditionGroup {
  const branchId = `branch_${Date.now()}`
  return { logic: 'and', conditions: [emptyCondition(branchId)], branch_id: branchId }
}

export function ConditionBuilder({
  groups,
  onChange,
  availableVariables,
  defaultBranch,
  onDefaultBranchChange,
}: ConditionBuilderProps) {
  function updateGroup(idx: number, patch: Partial<ConditionGroup>) {
    onChange(groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)))
  }

  function updateCondition(gIdx: number, cIdx: number, patch: Partial<Condition>) {
    const group = groups[gIdx]!
    const updated = group.conditions.map((c, i) => (i === cIdx ? { ...c, ...patch } : c))
    updateGroup(gIdx, { conditions: updated })
  }

  function addCondition(gIdx: number) {
    const group = groups[gIdx]!
    const newCond = emptyCondition(group.branch_id)
    updateGroup(gIdx, { conditions: [...group.conditions, newCond] })
  }

  function removeCondition(gIdx: number, cIdx: number) {
    const group = groups[gIdx]!
    if (group.conditions.length <= 1) return
    updateGroup(gIdx, { conditions: group.conditions.filter((_, i) => i !== cIdx) })
  }

  function addBranch() {
    onChange([...groups, emptyGroup()])
  }

  function removeBranch(idx: number) {
    onChange(groups.filter((_, i) => i !== idx))
  }

  function handleLeftChange(gIdx: number, cIdx: number, val: VariableReference | string | null) {
    if (val && typeof val !== 'string') {
      updateCondition(gIdx, cIdx, { left: val })
    }
  }

  function handleRightChange(gIdx: number, cIdx: number, val: VariableReference | string | null) {
    if (val === null) {
      updateCondition(gIdx, cIdx, { right: undefined })
    } else if (typeof val === 'string') {
      updateCondition(gIdx, cIdx, { right: { literal: val } })
    } else {
      updateCondition(gIdx, cIdx, { right: val })
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group, gIdx) => (
        <div key={group.branch_id} className="rounded border border-gray-700 p-3">
          {/* Branch header */}
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400">Branch</span>
            <span className="rounded bg-yellow-900 px-1.5 py-0.5 font-mono text-xs text-yellow-300">
              {group.branch_id}
            </span>
            {/* AND/OR toggle */}
            <div className="ml-auto flex gap-1">
              {(['and', 'or'] as const).map((logic) => (
                <button
                  key={logic}
                  type="button"
                  className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${
                    group.logic === logic
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-600 text-gray-400 hover:text-gray-200'
                  }`}
                  onClick={() => updateGroup(gIdx, { logic })}
                >
                  {logic}
                </button>
              ))}
              {groups.length > 1 && (
                <button
                  type="button"
                  className="ml-1 text-xs text-red-500 hover:text-red-400"
                  onClick={() => removeBranch(gIdx)}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            {group.conditions.map((cond, cIdx) => {
              const opDef = OPERATORS.find((o) => o.value === cond.operator)
              return (
                <div key={cIdx} className="flex items-start gap-1.5">
                  {/* Left */}
                  <div className="flex-1">
                    <VariableReferencePicker
                      value={cond.left}
                      onChange={(val) => handleLeftChange(gIdx, cIdx, val)}
                      availableVariables={availableVariables}
                      placeholder="Left value…"
                    />
                  </div>

                  {/* Operator */}
                  <select
                    className="rounded border border-gray-600 bg-gray-900 px-1 py-1.5 text-xs text-gray-200 focus:outline-none"
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(gIdx, cIdx, { operator: e.target.value as ConditionOperator })
                    }
                  >
                    {OPERATORS.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>

                  {/* Right */}
                  {opDef?.needsRight ? (
                    <div className="flex-1">
                      <VariableReferencePicker
                        value={
                          cond.right
                            ? 'literal' in cond.right
                              ? String(cond.right.literal)
                              : cond.right
                            : null
                        }
                        onChange={(val) => handleRightChange(gIdx, cIdx, val)}
                        availableVariables={availableVariables}
                        placeholder="Right value…"
                      />
                    </div>
                  ) : (
                    <div className="flex-1" />
                  )}

                  {/* Remove condition */}
                  <button
                    type="button"
                    className="mt-1.5 text-xs text-gray-600 hover:text-red-400"
                    onClick={() => removeCondition(gIdx, cIdx)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="mt-2 text-xs text-gray-500 hover:text-blue-400"
            onClick={() => addCondition(gIdx)}
          >
            + Add condition
          </button>
        </div>
      ))}

      {/* Add branch */}
      <button
        type="button"
        className="rounded border border-dashed border-gray-600 px-3 py-1.5 text-xs text-gray-500 hover:border-yellow-500 hover:text-yellow-400"
        onClick={addBranch}
      >
        + Add branch
      </button>

      {/* Default branch */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Default branch (fallback)</label>
        <input
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={defaultBranch}
          onChange={(e) => onDefaultBranchChange(e.target.value)}
          placeholder="default"
        />
      </div>
    </div>
  )
}
