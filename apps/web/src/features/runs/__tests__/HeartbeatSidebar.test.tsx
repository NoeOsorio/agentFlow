// @plan B4-PR-3
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HeartbeatSidebar } from '../HeartbeatSidebar'
import { useCompanyStore } from '../../../store/companyStore'

beforeEach(() => {
  useCompanyStore.setState({ agentHealth: {} })
})

describe('HeartbeatSidebar', () => {
  it('shows dead agent with ✗ indicator', () => {
    useCompanyStore.setState({
      agentHealth: {
        carol: {
          agentName: 'carol',
          healthStatus: 'dead',
          lastHeartbeatAt: new Date(Date.now() - 8 * 60 * 1000),
        },
      },
    })
    render(<HeartbeatSidebar />)
    fireEvent.click(screen.getByText(/Agents/))
    expect(screen.getByText('✗')).toBeDefined()
    expect(screen.getByText(/DEAD/i)).toBeDefined()
  })

  it('shows last heartbeat relative time', () => {
    useCompanyStore.setState({
      agentHealth: {
        carol: {
          agentName: 'carol',
          healthStatus: 'dead',
          lastHeartbeatAt: new Date(Date.now() - 8 * 60 * 1000),
        },
      },
    })
    render(<HeartbeatSidebar />)
    fireEvent.click(screen.getByText(/Agents/))
    expect(screen.getByText(/8m ago/)).toBeDefined()
  })

  it('shows "No agent health data" when store is empty', () => {
    render(<HeartbeatSidebar />)
    fireEvent.click(screen.getByText(/Agents/))
    expect(screen.getByText(/No agent health data/)).toBeDefined()
  })
})
