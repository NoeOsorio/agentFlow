// @plan B0-PR-1 — wired to GET /api/runs/
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'

interface RunRow {
  id: string
  pipeline_id: string
  pipeline_name?: string | null
  pipeline_namespace?: string | null
  status: string
  created_at: string
  updated_at: string
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-900/40 text-amber-300 border-amber-800/60',
  running: 'bg-blue-900/40 text-blue-300 border-blue-800/60',
  completed: 'bg-green-900/40 text-green-300 border-green-800/60',
  failed: 'bg-red-900/40 text-red-300 border-red-800/60',
  cancelled: 'bg-gray-800 text-gray-400 border-gray-700',
}

export default function RunsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null)

  useEffect(() => {
    const st = location.state as { queuedPipelineName?: string } | null
    if (st?.queuedPipelineName) {
      setQueuedNotice(
        `Run queued for "${st.queuedPipelineName}". It appears below as pending until a runtime worker executes it.`,
      )
      navigate('/runs', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/runs/')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load runs: ${res.status}`)
        return res.json() as Promise<RunRow[]>
      })
      .then((data) => {
        if (!cancelled) {
          setRuns(Array.isArray(data) ? data : [])
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const hasPending = runs.some((r) => r.status === 'pending')

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
            <p className="mt-1 text-sm text-gray-400">
              Queued pipeline executions (newest first). Status updates when the runtime picks up a run.
            </p>
          </div>
          <Link
            to="/pipelines"
            className="shrink-0 rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-gray-500 hover:bg-gray-800 hover:text-white"
          >
            ← Pipelines & canvas
          </Link>
        </div>

        {queuedNotice && (
          <div
            className="mb-4 rounded-xl border border-indigo-800/60 bg-indigo-950/40 px-4 py-3 text-sm text-indigo-200"
            role="status"
          >
            {queuedNotice}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-gray-700/80 bg-gray-900/50 px-4 py-3 text-sm text-gray-400">
          <p className="font-medium text-gray-300">Why everything says &quot;pending&quot;</p>
          <p className="mt-1 leading-relaxed">
            Clicking <strong className="text-gray-200">Run</strong> saves your pipeline and creates a run record in the
            database. Moving to <strong className="text-gray-200">running</strong> / <strong className="text-gray-200">completed</strong> requires hooking up the execution worker (runtime service or queue consumer) — that step is not wired in this
            stack yet. To execute YAML locally, use the{' '}
            <code className="rounded bg-gray-800 px-1 text-gray-200">services/runtime</code> CLI when documented for your
            setup.
          </p>
          {hasPending && (
            <p className="mt-2 text-xs text-amber-200/90">
              You have pending runs below; they are valid queue entries waiting for an executor.
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-800" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center text-red-400">{error}</div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="rounded-xl border border-gray-800 p-12 text-center text-gray-500">
            No runs yet. Open a pipeline in the canvas and click Run to queue one.
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Pipeline</th>
                  <th className="px-4 py-3 font-medium">Run ID</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {runs.map((r) => {
                  const name = r.pipeline_name?.trim() || null
                  const ns = r.pipeline_namespace?.trim() || 'default'
                  const statusCls = STATUS_STYLES[r.status] ?? 'bg-gray-800 text-gray-300 border-gray-700'
                  return (
                    <tr key={r.id} className="text-gray-300">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusCls}`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {name ? (
                          <div className="flex flex-col gap-0.5">
                            <Link
                              to={`/canvas/${encodeURIComponent(name)}`}
                              className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline"
                            >
                              {name}
                            </Link>
                            <span className="font-mono text-[11px] text-gray-500">
                              {ns} · id {r.pipeline_id.slice(0, 8)}…
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-gray-500">{r.pipeline_id}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
