// @plan B0-PR-2 + B0-PR-3
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { InlineAgent } from '@agentflow/core'
import { useCompanyStore } from '../store/companyStore'
import { AgentGrid } from '../features/company/AgentGrid'
import { OrgChart } from '../features/company/OrgChart'
import { AgentFormModal } from '../features/company/AgentFormModal'
import { CompanyYamlPanel } from '../features/company/CompanyYamlPanel'

type Tab = 'org' | 'agents' | 'yaml'

export default function CompanyPage() {
  const { companyName: companyNameParam } = useParams<{ companyName?: string }>()
  const companyResourceName = companyNameParam ? decodeURIComponent(companyNameParam) : undefined
  const [tab, setTab] = useState<Tab>('agents')
  const [loading, setLoading] = useState(!!companyResourceName)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<InlineAgent | undefined>(undefined)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')

  const loadCompany = useCompanyStore((s) => s.loadCompany)
  const saveCompany = useCompanyStore((s) => s.saveCompany)
  const company = useCompanyStore((s) => s.company)
  const companyName = useCompanyStore((s) => s.companyName)
  const namespace = useCompanyStore((s) => s.namespace)
  const saveStatus = useCompanyStore((s) => s.saveStatus)
  const deleteAgent = useCompanyStore((s) => s.deleteAgent)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const agentHealth = useCompanyStore((s) => s.agentHealth)

  useEffect(() => {
    if (!companyResourceName) return
    setLoading(true)
    loadCompany(companyResourceName).finally(() => setLoading(false))
  }, [companyResourceName, loadCompany])

  function handleEdit(agent: InlineAgent) {
    const isNew = !agent.name
    setEditingAgent(isNew ? undefined : agent)
    setModalMode(isNew ? 'add' : 'edit')
    setModalOpen(true)
  }

  function handleDelete(agentName: string) {
    if (confirm(`Delete agent "${agentName}"?`)) {
      deleteAgent(agentName)
    }
  }

  function handleAgentClick(agentName: string) {
    const agent = company?.spec.agents.find((a) => a.name === agentName)
    if (agent) handleEdit(agent)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="w-64 space-y-3">
          <div className="h-8 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-800" />
        </div>
      </div>
    )
  }

  if (!company && companyResourceName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-red-400">Company not found</p>
          <Link to="/companies" className="text-sm text-blue-400 hover:underline">
            ← Back to companies
          </Link>
        </div>
      </div>
    )
  }

  // Budget overview values
  const totalBudget = company?.spec.agents.reduce((sum, a) => sum + (a.budget?.monthly_usd ?? 0), 0) ?? 0
  const totalSpent = Object.values(agentBudgets).reduce((sum, b) => sum + b.spentUsd, 0)
  const budgetPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0
  const budgetBarColor = budgetPct > 80 ? 'bg-red-500' : budgetPct > 60 ? 'bg-yellow-400' : 'bg-green-500'

  const agentCount = company?.spec.agents.length ?? 0

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/companies" className="text-gray-500 hover:text-gray-300 text-sm">
              ← Companies
            </Link>
            <span className="text-gray-600">/</span>
            <h1 className="text-xl font-semibold">
              {companyName || 'New Company'}
            </h1>
            <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
              {namespace}
            </span>
            <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">
              {agentCount} agent{agentCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-green-400">Saved</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-400">Save failed</span>
            )}
            <button
              onClick={() => saveCompany()}
              disabled={saveStatus === 'saving'}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        {/* Budget overview bar */}
        {totalBudget > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Budget</span>
              <span>${totalSpent.toFixed(0)} / ${totalBudget.toFixed(0)} used this month</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-700">
              <div
                className={`h-1.5 rounded-full transition-all ${budgetBarColor}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {(['org', 'agents', 'yaml'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {t === 'org' ? 'Org Chart' : t === 'agents' ? 'Agents' : 'YAML'}
            </button>
          ))}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        {tab === 'agents' && company && (
          <AgentGrid
            agents={company.spec.agents}
            agentBudgets={agentBudgets}
            agentHealth={agentHealth}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}

        {tab === 'agents' && !company && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
            No company loaded. Create your first agent to get started.
          </div>
        )}

        {tab === 'org' && company && (
          <div className="h-[calc(100vh-220px)] min-h-64">
            <OrgChart
              company={company}
              agentHealth={agentHealth}
              onAgentClick={handleAgentClick}
            />
          </div>
        )}

        {tab === 'org' && !company && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-gray-800 text-gray-500">
            No company loaded.
          </div>
        )}

        {tab === 'yaml' && (
          <CompanyYamlPanel />
        )}
      </main>

      {/* Add Agent FAB */}
      <button
        onClick={() => handleEdit({} as InlineAgent)}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg transition-colors hover:bg-indigo-500"
        title="Add Agent"
      >
        +
      </button>

      {/* Agent Form Modal */}
      <AgentFormModal
        agent={editingAgent}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAgent(undefined) }}
        mode={modalMode}
      />
    </div>
  )
}
