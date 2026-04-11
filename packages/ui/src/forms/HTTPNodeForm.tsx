// @plan B2-PR-4
import type { HTTPNode } from '@agentflow/core'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-700 text-green-100',
  POST: 'bg-blue-700 text-blue-100',
  PUT: 'bg-yellow-700 text-yellow-100',
  PATCH: 'bg-orange-700 text-orange-100',
  DELETE: 'bg-red-700 text-red-100',
}

interface HTTPNodeFormProps {
  value: Partial<HTTPNode>
  onChange: (val: Partial<HTTPNode>) => void
}

export function HTTPNodeForm({ value, onChange }: HTTPNodeFormProps) {
  const headers = value.headers ?? {}

  function addHeader() {
    onChange({ ...value, headers: { ...headers, '': '' } })
  }

  function updateHeaderKey(oldKey: string, newKey: string) {
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) {
      next[k === oldKey ? newKey : k] = v
    }
    onChange({ ...value, headers: next })
  }

  function updateHeaderVal(key: string, val: string) {
    onChange({ ...value, headers: { ...headers, [key]: val } })
  }

  function removeHeader(key: string) {
    const next = { ...headers }
    delete next[key]
    onChange({ ...value, headers: next })
  }

  return (
    <div className="space-y-4">
      {/* Method + URL */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Method & URL</label>
        <div className="flex gap-2">
          <select
            className={`rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-xs font-bold focus:outline-none ${METHOD_COLORS[value.method ?? 'GET'] ?? ''}`}
            value={value.method ?? 'GET'}
            onChange={(e) => onChange({ ...value, method: e.target.value as HTTPNode['method'] })}
          >
            {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1.5 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="https://api.example.com/endpoint"
            value={value.url ?? ''}
            onChange={(e) => onChange({ ...value, url: e.target.value })}
          />
        </div>
      </div>

      {/* Headers */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-300">Headers</label>
          <button type="button" className="text-xs text-gray-500 hover:text-blue-400" onClick={addHeader}>
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {Object.entries(headers).map(([k, v]) => (
            <div key={k} className="flex gap-1">
              <input
                className="w-36 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none"
                placeholder="Header-Name"
                value={k}
                onChange={(e) => updateHeaderKey(k, e.target.value)}
              />
              <input
                className="flex-1 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-300 focus:outline-none"
                placeholder="value"
                value={v}
                onChange={(e) => updateHeaderVal(k, e.target.value)}
              />
              <button
                type="button"
                className="text-xs text-gray-600 hover:text-red-400"
                onClick={() => removeHeader(k)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Body (JSON)</label>
        <textarea
          className="w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={4}
          placeholder='{"key": "value"}'
          value={typeof value.body === 'string' ? value.body : JSON.stringify(value.body ?? '', null, 2)}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
        />
      </div>

      {/* Timeout */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-300">Timeout (ms)</label>
        <input
          type="number"
          min={1}
          className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value.timeout_ms ?? ''}
          placeholder="No timeout"
          onChange={(e) =>
            onChange({ ...value, timeout_ms: e.target.value ? parseInt(e.target.value) : undefined })
          }
        />
      </div>
    </div>
  )
}
