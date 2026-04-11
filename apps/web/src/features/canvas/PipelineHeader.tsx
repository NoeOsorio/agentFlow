// @plan B1-PR-3
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePipelineStore } from '../../store/pipelineStore'
import type { CompanyReference } from '@agentflow/core'

// ---------------------------------------------------------------------------
// CompanySelector (inline — full version lives in B0-PR-3 features/company)
// ---------------------------------------------------------------------------

interface CompanyItem {
  name: string
  namespace: string
  agentCount?: number
}

interface CompanySelectorProps {
  value: CompanyReference | null
  onChange: (ref: CompanyReference | null) => void
}

function CompanySelector({ value, onChange }: CompanySelectorProps) {
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/companies/')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        const rows = Array.isArray(data) ? data : []
        setCompanies(
          rows
            .map((row) => {
              const r = row as { name?: string; namespace?: string }
              return {
                name: String(r.name ?? ''),
                namespace: String(r.namespace ?? 'default'),
              }
            })
            .filter((c) => c.name),
        )
      })
      .catch(() => setCompanies([]))
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = value ? value.name : 'No company'

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded px-2.5 py-1.5 text-gray-200 transition-colors"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-gray-400">Agents from:</span>
        <span className="font-medium">{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 overflow-hidden">
          <button
            className="w-full text-left text-xs px-3 py-2 text-gray-400 hover:bg-gray-700 transition-colors"
            onClick={() => { onChange(null); setOpen(false) }}
          >
            No company
          </button>
          {companies.map(c => (
            <button
              key={`${c.namespace}/${c.name}`}
              className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-700 transition-colors flex items-center justify-between ${
                value?.name === c.name ? 'text-indigo-300 bg-indigo-950' : 'text-gray-200'
              }`}
              onClick={() => { onChange({ name: c.name, namespace: c.namespace }); setOpen(false) }}
            >
              <span>{c.name}</span>
              {c.agentCount !== undefined && (
                <span className="text-gray-500 ml-2">{c.agentCount} agents</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save status badge
// ---------------------------------------------------------------------------

function SaveBadge({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  const configs = {
    idle: { label: 'draft', cls: 'text-gray-500 bg-gray-800 border-gray-700' },
    saving: { label: 'saving…', cls: 'text-yellow-400 bg-yellow-950 border-yellow-800' },
    saved: { label: 'saved', cls: 'text-green-400 bg-green-950 border-green-800' },
    error: { label: 'error', cls: 'text-red-400 bg-red-950 border-red-800' },
  }
  const { label, cls } = configs[status]
  return (
    <span className={`text-xs border rounded px-2 py-0.5 font-medium ${cls}`}>{label}</span>
  )
}

// ---------------------------------------------------------------------------
// PipelineHeader
// ---------------------------------------------------------------------------

export function PipelineHeader() {
  const navigate = useNavigate()

  const pipelineName = usePipelineStore(s => s.pipelineName)
  const companyRef = usePipelineStore(s => s.companyRef)
  const saveStatus = usePipelineStore(s => s.saveStatus)
  const yamlSpec = usePipelineStore(s => s.yamlSpec)
  const yamlPanelOpen = usePipelineStore(s => s.yamlPanelOpen)

  const setPipelineName = usePipelineStore(s => s.setPipelineName)
  const setCompanyRef = usePipelineStore(s => s.setCompanyRef)
  const savePipeline = usePipelineStore(s => s.savePipeline)
  const setYamlSpec = usePipelineStore(s => s.setYamlSpec)
  const toggleYamlPanel = usePipelineStore(s => s.toggleYamlPanel)

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(pipelineName)
  const [runBusy, setRunBusy] = useState(false)
  const [runHint, setRunHint] = useState<string | null>(null)

  // Sync local input when store name changes (e.g. after load)
  useEffect(() => { setNameInput(pipelineName) }, [pipelineName])

  function commitName(): void {
    setEditingName(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== pipelineName) setPipelineName(trimmed)
    else setNameInput(pipelineName)
  }

  function handleExportYaml(): void {
    const blob = new Blob([yamlSpec], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pipelineName}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleRunPipeline(): Promise<void> {
    setRunHint(null)
    if (!pipelineName.trim()) {
      setRunHint('Set a pipeline name before running.')
      return
    }
    if (!yamlSpec.trim()) {
      setRunHint('Pipeline YAML is empty — add nodes or fix load errors.')
      return
    }
    setRunBusy(true)
    try {
      await savePipeline()
      const { saveStatus } = usePipelineStore.getState()
      if (saveStatus === 'error') {
        setRunHint('Save failed — fix YAML errors, then run again.')
        return
      }
      const res = await fetch(
        `/api/pipelines/${encodeURIComponent(pipelineName.trim())}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger_data: {} }),
        },
      )
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `HTTP ${res.status}`)
      }
      navigate('/runs', { state: { queuedPipelineName: pipelineName.trim() } })
    } catch (e) {
      setRunHint(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunBusy(false)
    }
  }

  function handleImportYaml(): void {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        const content = e.target?.result
        if (typeof content === 'string') setYamlSpec(content)
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const btnBase = 'text-xs px-3 py-1.5 rounded transition-colors font-medium'

  return (
    <header className="flex shrink-0 flex-col gap-1 border-b border-gray-700 bg-gray-900 px-4 py-2 z-30">
      <div className="flex flex-wrap items-center gap-3">
      {/* Back */}
      <button
        className="text-gray-400 hover:text-white transition-colors p-1 rounded"
        onClick={() => navigate('/pipelines')}
        aria-label="Back to pipelines"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Pipeline name */}
      {editingName ? (
        <input
          className="text-sm font-semibold bg-gray-800 border border-indigo-500 rounded px-2 py-0.5 text-white outline-none w-48"
          value={nameInput}
          autoFocus
          onChange={e => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(pipelineName) } }}
          aria-label="Pipeline name"
        />
      ) : (
        <button
          className="text-sm font-semibold text-white hover:text-indigo-300 transition-colors truncate max-w-48"
          onClick={() => setEditingName(true)}
          title="Click to rename"
        >
          {pipelineName}
        </button>
      )}

      <SaveBadge status={saveStatus} />

      {/* Company selector */}
      <CompanySelector value={companyRef} onChange={setCompanyRef} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* YAML panel toggle */}
      <button
        className={`${btnBase} border ${yamlPanelOpen ? 'border-indigo-500 text-indigo-300 bg-indigo-950' : 'border-gray-600 text-gray-300 hover:bg-gray-800'}`}
        onClick={toggleYamlPanel}
        title="Toggle YAML panel"
      >
        YAML
      </button>

      {/* Import YAML */}
      <button
        className={`${btnBase} border border-gray-600 text-gray-300 hover:bg-gray-800`}
        onClick={handleImportYaml}
        title="Import YAML file"
      >
        Import
      </button>

      {/* Export YAML */}
      <button
        className={`${btnBase} border border-gray-600 text-gray-300 hover:bg-gray-800`}
        onClick={handleExportYaml}
        title="Export YAML"
      >
        Export
      </button>

      {/* Save */}
      <button
        className={`${btnBase} bg-gray-700 hover:bg-gray-600 text-white border border-gray-600`}
        onClick={() => void savePipeline()}
        title="Save pipeline (Cmd+S)"
      >
        Save
      </button>

      {/* Run — saves to API then POST /pipelines/{name}/execute */}
      <button
        type="button"
        className={`${btnBase} bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50`}
        disabled={runBusy || !yamlSpec.trim()}
        onClick={() => void handleRunPipeline()}
        title="Save pipeline to the server, queue a run, then open the Runs page"
      >
        {runBusy ? 'Running…' : 'Run'}
      </button>
      </div>
      {runHint && (
        <p className="text-xs text-amber-400" role="status">
          {runHint}
        </p>
      )}
    </header>
  )
}
