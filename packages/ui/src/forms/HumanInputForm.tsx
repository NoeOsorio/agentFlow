// @plan B2-PR-4
import type { HumanInputNode } from '@agentflow/core'

interface HumanInputFormProps {
  value: Partial<HumanInputNode>
  onChange: (val: Partial<HumanInputNode>) => void
}

export function HumanInputForm({ value, onChange }: HumanInputFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Prompt</label>
        <textarea
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          placeholder="What should the human reviewer see?"
          value={value.prompt ?? ''}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
        />
      </div>

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

      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">On timeout</label>
        <div className="space-y-1">
          {(['skip', 'fail'] as const).map((f) => (
            <label key={f} className="flex cursor-pointer items-center gap-2 rounded border border-gray-700 px-3 py-2 hover:border-gray-500">
              <input
                type="radio"
                className="accent-blue-500"
                name="fallback"
                value={f}
                checked={value.fallback === f}
                onChange={() => onChange({ ...value, fallback: f })}
              />
              <span className="text-sm capitalize text-gray-300">{f}</span>
              <span className="ml-auto text-xs text-gray-600">
                {f === 'skip' ? 'Continue pipeline, skip this node' : 'Mark pipeline as failed'}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
