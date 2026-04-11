// @plan B2-PR-4
import { useState } from 'react'
import type { ModelConfig, ModelProvider } from '@agentflow/core'

const MODELS_BY_PROVIDER: Record<ModelProvider, string[]> = {
  anthropic: [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-3-5-sonnet-20241022',
  ],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'open-mistral-7b'],
  local: ['llama-3-8b', 'llama-3-70b', 'mistral-7b'],
}

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  mistral: 'Mistral',
  local: 'Local',
}

interface ModelSelectorProps {
  value: ModelConfig
  onChange: (cfg: ModelConfig) => void
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const models = MODELS_BY_PROVIDER[value.provider] ?? []

  function update(patch: Partial<ModelConfig>) {
    onChange({ ...value, ...patch })
  }

  function handleProviderChange(provider: ModelProvider) {
    const firstModel = MODELS_BY_PROVIDER[provider]?.[0] ?? ''
    onChange({ ...value, provider, model_id: firstModel })
  }

  return (
    <div className="space-y-3">
      {/* Provider */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Provider</label>
        <select
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value.provider}
          onChange={(e) => handleProviderChange(e.target.value as ModelProvider)}
        >
          {(Object.keys(PROVIDER_LABELS) as ModelProvider[]).map((p) => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Model */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-400">Model</label>
        <select
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value.model_id}
          onChange={(e) => update({ model_id: e.target.value })}
        >
          {models.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        className="text-xs text-gray-500 hover:text-gray-300"
        onClick={() => setShowAdvanced((s) => !s)}
      >
        {showAdvanced ? '▾' : '▸'} Advanced settings
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded border border-gray-700 p-3">
          {/* Temperature */}
          <div>
            <label className="mb-1 flex items-center justify-between text-xs font-medium text-gray-400">
              <span>Temperature</span>
              <span className="font-mono text-gray-300">{value.temperature ?? 0.7}</span>
            </label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              className="w-full accent-blue-500"
              value={value.temperature ?? 0.7}
              onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>Precise</span><span>Creative</span>
            </div>
          </div>

          {/* Max tokens */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-400">Max tokens</label>
            <input
              type="number"
              min={1}
              max={200000}
              className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={value.max_tokens ?? ''}
              placeholder="Default"
              onChange={(e) => update({ max_tokens: e.target.value ? parseInt(e.target.value) : undefined })}
            />
          </div>
        </div>
      )}
    </div>
  )
}
