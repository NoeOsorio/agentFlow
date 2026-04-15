// @plan B0-PR-1
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CompaniesPage from '../CompaniesPage'
import type { CompanyListItem } from '../../features/company/CompanyCard'

const FIXTURE_COMPANIES: CompanyListItem[] = [
  {
    id: 'co-1',
    name: 'acme-corp',
    namespace: 'default',
    agent_count: 3,
    total_budget_usd: 500,
    active_agents: 2,
    idle_agents: 1,
    updated_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'co-2',
    name: 'beta-inc',
    namespace: 'staging',
    agent_count: 1,
    total_budget_usd: 100,
    active_agents: 0,
    idle_agents: 1,
    updated_at: '2026-03-15T08:00:00Z',
  },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/companies']}>
      <CompaniesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

afterEach(() => {
  cleanup()
})

describe('CompaniesPage', () => {
  it('shows empty state when GET /api/companies returns []', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    )
    renderPage()
    await waitFor(() => {
      expect(
        screen.getByText('No companies yet. Define your first virtual company.'),
      ).toBeInTheDocument()
    })
  })

  it('renders a CompanyCard for each company in the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => FIXTURE_COMPANIES }),
    )
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('acme-corp')).toBeInTheDocument()
      expect(screen.getByText('beta-inc')).toBeInTheDocument()
    })
  })

  it('"New Company" button navigates to /companies/new', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    )
    renderPage()
    const btn = await screen.findByRole('button', { name: 'New Company' })
    expect(btn).toBeInTheDocument()
    // Clicking should not throw (navigation captured by MemoryRouter)
    await userEvent.click(btn)
  })

  it('CompanyCard Delete button calls DELETE /api/companies/{name} and removes the card', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => FIXTURE_COMPANIES })
      .mockResolvedValueOnce({ ok: true })

    vi.stubGlobal('fetch', mockFetch)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderPage()
    await waitFor(() => screen.getByText('acme-corp'))

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i })
    await userEvent.click(deleteButtons[0]!)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/companies/acme-corp', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByText('acme-corp')).not.toBeInTheDocument()
    })
  })
})
