// @plan B0-PR-1
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import CompanyCard, { type CompanyListItem } from '../features/company/CompanyCard'

/** Map API `CompanyRead` into list card fields; preserves optional stats if present (e.g. tests). */
function mapCompanyFromApi(raw: {
  id: string
  name: string
  namespace: string
  updated_at: string
  agent_count?: number
  total_budget_usd?: number | null
  active_agents?: number
  idle_agents?: number
}): CompanyListItem {
  return {
    id: raw.id,
    name: raw.name,
    namespace: raw.namespace,
    agent_count: raw.agent_count ?? 0,
    total_budget_usd: raw.total_budget_usd ?? null,
    active_agents: raw.active_agents ?? 0,
    idle_agents: raw.idle_agents ?? 0,
    updated_at: raw.updated_at,
  }
}

export default function CompaniesPage() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/companies/')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load companies: ${res.status}`)
        return res.json() as Promise<Parameters<typeof mapCompanyFromApi>[0][]>
      })
      .then((data) => {
        if (!cancelled) {
          setCompanies(Array.isArray(data) ? data.map(mapCompanyFromApi) : [])
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleDelete(name: string) {
    const res = await fetch(`/api/companies/${encodeURIComponent(name)}`, { method: 'DELETE' })
    if (res.ok) {
      setCompanies((prev) => prev.filter((c) => c.name !== name))
    }
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-gray-400 mt-1 text-sm">Define virtual organizations and their agents</p>
        </div>
        <button
          onClick={() => navigate('/companies/new')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          New Company
        </button>
      </div>

      {loading && (
        <div className="text-center text-gray-500 py-16">Loading...</div>
      )}

      {error && (
        <div className="border border-red-800 bg-red-900/20 rounded-xl p-6 text-center text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <div className="border border-gray-800 rounded-xl p-16 text-center text-gray-500">
          <p>No companies yet. Define your first virtual company.</p>
        </div>
      )}

      {!loading && !error && companies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </Layout>
  )
}
