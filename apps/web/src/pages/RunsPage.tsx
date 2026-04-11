// @plan B0-PR-1 — wired to GET /api/runs/
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

interface RunRow {
  id: string
  pipeline_id: string
  status: string
  created_at: string
  updated_at: string
}

export default function RunsPage() {
  const [runs, setRuns] = useState<RunRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Runs</h1>
            <p className="mt-1 text-sm text-gray-400">Pipeline execution history</p>
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-800" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && runs.length === 0 && (
          <div className="rounded-xl border border-gray-800 p-12 text-center text-gray-500">
            No runs yet. Execute a pipeline to see activity here.
          </div>
        )}

        {!loading && !error && runs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-800 bg-gray-900/80 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Run ID</th>
                  <th className="px-4 py-3 font-medium">Pipeline</th>
                  <th className="px-4 py-3 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {runs.map((r) => (
                  <tr key={r.id} className="text-gray-300">
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-200">
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.id}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.pipeline_id}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
