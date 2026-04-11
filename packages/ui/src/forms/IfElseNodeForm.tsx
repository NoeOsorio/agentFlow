// @plan B2-PR-4
import type { IfElseNode, ConditionGroup } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { ConditionBuilder } from './widgets/ConditionBuilder'

interface IfElseNodeFormProps {
  value: Partial<IfElseNode>
  onChange: (val: Partial<IfElseNode>) => void
  availableVariables: AvailableVariable[]
}

export function IfElseNodeForm({ value, onChange, availableVariables }: IfElseNodeFormProps) {
  const groups: ConditionGroup[] = value.conditions ?? [
    { logic: 'and', conditions: [{ left: { node_id: '', variable: '', path: [] }, operator: 'eq', right: { literal: '' }, branch_id: 'branch_1' }], branch_id: 'branch_1' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-300">Conditions</label>
        <ConditionBuilder
          groups={groups}
          onChange={(conditions) => onChange({ ...value, conditions })}
          availableVariables={availableVariables}
          defaultBranch={value.default_branch ?? 'default'}
          onDefaultBranchChange={(default_branch) => onChange({ ...value, default_branch })}
        />
      </div>
    </div>
  )
}
