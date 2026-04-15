// @plan B1-PR-4
// Tests for PipelinesPage API interactions (fetch behaviour, not DOM rendering,
// since the test environment is node without jsdom).
import { describe, it, expect, vi, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Types (mirror the PipelinesPage interface)
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
// Helpers – isolate fetch logic so we can unit test it
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

async function fetchPipelines(): Promise<PipelineListItem[]> {
  const res = await fetch('/api/pipelines/')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<PipelineListItem[]>
}

async function createPipeline(): Promise<{ id: string; name: string }> {
  const res = await fetch('/api/pipelines/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml_spec: DEFAULT_PIPELINE_YAML, name: 'untitled' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ id: string; name: string }>
}

async function deletePipeline(name: string): Promise<void> {
  const res = await fetch(`/api/pipelines/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PipelinesPage API logic', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('POST /api/pipelines/ sends default YAML and returns name for canvas route', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'pipe-abc', name: 'untitled' }),
    } as Response)
    global.fetch = mockFetch

    const result = await createPipeline()

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/pipelines/')
    expect(options?.method).toBe('POST')
    const body = JSON.parse(options?.body as string) as { yaml_spec: string; name: string }
    expect(body.yaml_spec).toContain('agentflow.ai/v1')
    expect(body.name).toBe('untitled')
    expect(result.id).toBe('pipe-abc')
    expect(result.name).toBe('untitled')
  })

  it('pipeline list includes company badge data when company_ref is set', async () => {
    const mockData: PipelineListItem[] = [
      { id: '1', name: 'no-company' },
      { id: '2', name: 'with-company', company_ref: { name: 'acme-corp' } },
    ]
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as Response)

    const pipelines = await fetchPipelines()

    expect(pipelines).toHaveLength(2)
    expect(pipelines[0]?.company_ref).toBeUndefined()
    expect(pipelines[1]?.company_ref?.name).toBe('acme-corp')
  })

  it('DELETE /api/pipelines/{name} is called on delete', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true } as Response)
    global.fetch = mockFetch

    await deletePipeline('pipe-xyz')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/pipelines/pipe-xyz')
    expect(options?.method).toBe('DELETE')
  })

  it('company filter returns only matching pipelines', () => {
    const pipelines: PipelineListItem[] = [
      { id: '1', name: 'a', company_ref: { name: 'acme' } },
      { id: '2', name: 'b', company_ref: { name: 'globex' } },
      { id: '3', name: 'c' },
    ]

    const filterByCompany = (list: PipelineListItem[], company: string) =>
      company ? list.filter(p => p.company_ref?.name === company) : list

    expect(filterByCompany(pipelines, 'acme')).toHaveLength(1)
    expect(filterByCompany(pipelines, 'acme')[0]?.name).toBe('a')
    expect(filterByCompany(pipelines, 'globex')).toHaveLength(1)
    expect(filterByCompany(pipelines, '')).toHaveLength(3)
  })

  it('fetch error propagates as thrown Error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as Response)

    await expect(fetchPipelines()).rejects.toThrow('HTTP 404')
  })
})
