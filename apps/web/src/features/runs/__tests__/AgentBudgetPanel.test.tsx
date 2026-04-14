// @plan B4-PR-3
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentBudgetPanel } from '../AgentBudgetPanel'
import { useCompanyStore } from '../../../store/companyStore'

beforeEach(() => {
  useCompanyStore.setState({ agentBudgets: {} })
})

describe('AgentBudgetPanel', () => {
  it('shows "No agent budget data" when budgets are empty', () => {
    render(<AgentBudgetPanel />)
    expect(screen.getByText(/No agent budget data/)).toBeDefined()
  })

  it('shows EXCEEDED when pctUsed >= 1', () => {
    useCompanyStore.setState({
      agentBudgets: {
        alice: {
          agentName: 'alice',
          spentUsd: 100,
          budgetUsd: 100,
          remainingUsd: 0,
          pctUsed: 1,
          month: '2024-01',
        },
      },
    })
    render(<AgentBudgetPanel />)
    expect(screen.getByText(/EXCEEDED/)).toBeDefined()
    expect(screen.getByText(/\$0\.00 remaining/)).toBeDefined()
  })

  it('updates budget bar when store changes', () => {
    useCompanyStore.setState({
      agentBudgets: {
        alice: {
          agentName: 'alice',
          spentUsd: 50,
          budgetUsd: 100,
          remainingUsd: 50,
          pctUsed: 0.5,
          month: '2024-01',
        },
      },
    })
    render(<AgentBudgetPanel />)
    expect(screen.getByText(/\$50\.00 spent/)).toBeDefined()
  })
})
