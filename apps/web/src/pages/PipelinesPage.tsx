// @plan B1-PR-4
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PipelineListItem {
  id: string
  name: string
  company_ref?: { name: string; namespace?: string } | null
  last_run_status?: 'pending' | 'running' | 'completed' | 'failed' | null
  node_count?: number
  updated_at?: string
}

// ---------------------------------------------------------------------------
// Default YAML for new pipelines
// ---------------------------------------------------------------------------

const DEFAULT_PIPELINE_YAML = `apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: untitled
  namespace: default
spec:
  nodes: []
  edges: []
`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RUN_STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-900/50 text-green-400',
  failed: 'bg-red-900/50 text-red-400',
  running: 'bg-blue-900/50 text-blue-400',
  pending: 'bg-yellow-900/50 text-yellow-400',
}

function RunStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null
  const cls = RUN_STATUS_STYLES[status] ?? 'bg-gray-800 text-gray-400'
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

function CompanyBadge({ name }: { name: string }) {
  return (
    <span className="rounded bg-indigo-900/50 px-2 py-0.5 text-xs font-medium text-indigo-300">
      {name}
    </span>
  )
}

// ---------------------------------------------------------------------------
// PipelinesPage
// ---------------------------------------------------------------------------

export default function PipelinesPage() {
  const navigate = useNavigate()

  const [pipelines, setPipelines] = useState<PipelineListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [companyFilter, setCompanyFilter] = useState<string>('')

  // Fetch pipelines on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/pipelines/')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PipelineListItem[]>
      })
      .then(data => {
        if (!cancelled) {
          setPipelines(data)
          setError(null)
        }
      })
      .catch(err => {
        if (!cancelled) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Unique company names for filter
  const companyNames = useMemo(() => {
    const names = new Set<string>()
    for (const p of pipelines) {
      if (p.company_ref?.name) names.add(p.company_ref.name)
    }
    return Array.from(names).sort()
  }, [pipelines])

  const filtered = useMemo(() => {
    if (!companyFilter) return pipelines
    return pipelines.filter(p => p.company_ref?.name === companyFilter)
  }, [pipelines, companyFilter])

  const handleNewPipeline = useCallback(async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/pipelines/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml_spec: DEFAULT_PIPELINE_YAML, name: 'untitled' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { id: string }
      navigate(`/canvas/${data.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }, [navigate])

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete pipeline "${name}"? This cannot be undone.`)) return
      setDeletingId(id)
      try {
        const res = await fetch(`/api/pipelines/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setPipelines(prev => prev.filter(p => p.id !== id))
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setDeletingId(null)
      }
    },
    [],
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">AgentFlow</h1>
          <p className="mt-1 text-gray-400">AI agent pipeline orchestration</p>
        </header>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-xl font-semibold">Pipelines</h2>

          {/* Company filter */}
          {companyNames.length > 0 && (
            <select
              value={companyFilter}
              onChange={e => setCompanyFilter(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All companies</option>
              {companyNames.map(name => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={handleNewPipeline}
            disabled={creating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'New Pipeline'}
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-3 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-800" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="rounded-xl border border-gray-800 p-12 text-center text-gray-500">
            {companyFilter
              ? `No pipelines for company "${companyFilter}".`
              : 'No pipelines yet. Create your first one.'}
          </div>
        )}

        {/* Pipeline grid */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(pipeline => (
              <div
                key={pipeline.id}
                className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 px-5 py-4 transition-colors hover:border-gray-700"
              >
                {/* Click area → open canvas */}
                <button
                  onClick={() => navigate(`/canvas/${pipeline.id}`)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-white">{pipeline.name}</p>
                    {pipeline.updated_at && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Updated {new Date(pipeline.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pipeline.company_ref?.name && (
                      <CompanyBadge name={pipeline.company_ref.name} />
                    )}
                    <RunStatusBadge status={pipeline.last_run_status} />
                    {pipeline.node_count != null && (
                      <span className="text-xs text-gray-500">
                        {pipeline.node_count} node{pipeline.node_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(pipeline.id, pipeline.name)}
                  disabled={deletingId === pipeline.id}
                  title="Delete pipeline"
                  className="shrink-0 rounded px-2 py-1 text-xs text-gray-600 opacity-0 transition-opacity hover:bg-red-900/40 hover:text-red-400 group-hover:opacity-100 disabled:opacity-40"
                >
                  {deletingId === pipeline.id ? '…' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
