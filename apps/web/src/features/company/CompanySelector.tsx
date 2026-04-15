// @plan B0-PR-3
import { useEffect, useState } from 'react'
import type { CompanyReference } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyOption {
  id: string
  name: string
  namespace: string
  agent_count: number
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CompanySelectorProps {
  value: CompanyReference | null
  onChange: (ref: CompanyReference | null) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanySelector({ value, onChange, className }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/companies')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<CompanyOption[]>
      })
      .then((data) => {
        if (!cancelled) setCompanies(data)
      })
      .catch(() => {
        // Silently fail — companies list is optional
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value
    if (!selected) {
      onChange(null)
      return
    }
    const company = companies.find((c) => c.name === selected)
    if (company) {
      onChange({ name: company.name, namespace: company.namespace })
    }
  }

  const selectedValue = value?.name ?? ''

  return (
    <select
      value={selectedValue}
      onChange={handleChange}
      disabled={loading}
      className={
        className ??
        'rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none disabled:opacity-50'
      }
      title="Select company"
    >
      <option value="">— No company —</option>
      {companies.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name} ({c.agent_count} agent{c.agent_count !== 1 ? 's' : ''})
        </option>
      ))}
    </select>
  )
}
