// @plan B2-PR-4
import type { LLMNode, ModelConfig, Prompt } from '@agentflow/core'
import type { AvailableVariable } from './widgets/VariableReferencePicker'
import { ModelSelector } from './widgets/ModelSelector'
import { PromptEditor } from './widgets/PromptEditor'

interface LLMNodeFormProps {
  value: Partial<LLMNode>
  onChange: (val: Partial<LLMNode>) => void
  availableVariables: AvailableVariable[]
}

const DEFAULT_MODEL: ModelConfig = {
  provider: 'anthropic',
  model_id: 'claude-sonnet-4-6',
}

const DEFAULT_PROMPT: Prompt = { system: '', user: '' }

export function LLMNodeForm({ value, onChange, availableVariables }: LLMNodeFormProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Model</label>
        <ModelSelector
          value={value.model ?? DEFAULT_MODEL}
          onChange={(model) => onChange({ ...value, model })}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-semibold text-gray-300">Prompt</label>
        <PromptEditor
          value={value.prompt ?? DEFAULT_PROMPT}
          onChange={(prompt) => onChange({ ...value, prompt })}
          availableVariables={availableVariables}
        />
      </div>
    </div>
  )
}
