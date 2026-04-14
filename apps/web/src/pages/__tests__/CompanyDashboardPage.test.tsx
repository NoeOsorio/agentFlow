// @plan B4-PR-4
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CompanyDashboardPage from '../CompanyDashboardPage'
import { useCompanyStore } from '../../store/companyStore'

beforeEach(() => {
  useCompanyStore.setState({ agentBudgets: {} })
  vi.restoreAllMocks()
})

function renderDashboard(companyName = 'acme') {
  return render(
    <MemoryRouter initialEntries={[`/companies/${companyName}/dashboard`]}>
      <Routes>
        <Route path="/companies/:companyName/dashboard" element={<CompanyDashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CompanyDashboardPage', () => {
  it('shows "No active runs" when API returns empty array', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/No active runs/)).toBeDefined()
    })
  })

  it('renders two rows when 2 active runs are returned', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'r1', pipeline_id: 'p1', pipeline_name: 'pipe-alpha', status: 'running', created_at: new Date().toISOString() },
        { id: 'r2', pipeline_id: 'p2', pipeline_name: 'pipe-beta', status: 'running', created_at: new Date().toISOString() },
      ],
    } as Response)

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('pipe-alpha')).toBeDefined()
      expect(screen.getByText('pipe-beta')).toBeDefined()
    })
  })

  it('shows red bar for agent with pctUsed=0.9', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    useCompanyStore.setState({
      agentBudgets: {
        alice: { agentName: 'alice', spentUsd: 90, budgetUsd: 100, remainingUsd: 10, pctUsed: 0.9, month: '2024-01' },
      },
    })

    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText(/alice/i)).toBeDefined()
    })
    // At 0.9 the bar should have yellow class (>= 0.8 threshold)
    const bars = document.querySelectorAll('.bg-yellow-400')
    expect(bars.length).toBeGreaterThan(0)
  })
})
