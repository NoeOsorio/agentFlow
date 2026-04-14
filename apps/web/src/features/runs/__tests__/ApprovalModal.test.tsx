// @plan B4-PR-3
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApprovalModal, useApprovalStore } from '../ApprovalModal'

beforeEach(() => {
  useApprovalStore.getState().clearPending()
})

describe('ApprovalModal', () => {
  it('does not render when no pending approval', () => {
    const { container } = render(<ApprovalModal />)
    expect(container.firstChild).toBeNull()
  })

  it('shows agent name and role', () => {
    useApprovalStore.getState().setPending({
      runId: 'run-1',
      nodeId: 'node-1',
      prompt: 'Please approve this action',
      agentName: 'Alice',
      agentRole: 'Lead Engineer',
    })
    render(<ApprovalModal />)
    expect(screen.getByText(/Lead Engineer/)).toBeDefined()
    expect(screen.getByText(/Alice/)).toBeDefined()
  })

  it('shows the prompt text', () => {
    useApprovalStore.getState().setPending({
      runId: 'run-1',
      nodeId: 'node-1',
      prompt: 'Please approve this action',
    })
    render(<ApprovalModal />)
    expect(screen.getByText('Please approve this action')).toBeDefined()
  })

  it('Approve button is disabled when textarea is empty', () => {
    useApprovalStore.getState().setPending({
      runId: 'run-1',
      nodeId: 'node-1',
      prompt: 'Approve?',
    })
    render(<ApprovalModal />)
    const approveBtn = screen.getByText('Approve')
    expect(approveBtn.hasAttribute('disabled')).toBe(true)
  })

  it('Approve button enables when textarea has content', () => {
    useApprovalStore.getState().setPending({
      runId: 'run-1',
      nodeId: 'node-1',
      prompt: 'Approve?',
    })
    render(<ApprovalModal />)
    const textarea = screen.getByPlaceholderText(/Enter your response/)
    fireEvent.change(textarea, { target: { value: 'Yes, approved' } })
    const approveBtn = screen.getByText('Approve')
    expect(approveBtn.hasAttribute('disabled')).toBe(false)
  })
})
