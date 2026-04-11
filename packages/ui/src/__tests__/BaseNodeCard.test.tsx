/**
 * @plan B2-PR-1
 * Tests for BaseNodeCard and NodeHandle components.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BaseNodeCard } from '../nodes/BaseNodeCard'
import { NodeHandle } from '../nodes/NodeHandle'

// ---------------------------------------------------------------------------
// Mock @xyflow/react so Handle renders a plain div in jsdom
// ---------------------------------------------------------------------------

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position, id, className }: Record<string, string>) => (
    <div
      data-testid={`handle-${type}`}
      data-position={position}
      data-handle-id={id}
      className={className}
    />
  ),
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

// ---------------------------------------------------------------------------
// Shared props
// ---------------------------------------------------------------------------

const baseProps = {
  id: 'node-1',
  type: 'llm' as const,
  label: 'My LLM Node',
  accentColor: '#3b82f6',
}

// ---------------------------------------------------------------------------
// BaseNodeCard — run status styles
// ---------------------------------------------------------------------------

describe('BaseNodeCard', () => {
  it('renders the label', () => {
    render(<BaseNodeCard {...baseProps} />)
    expect(screen.getByText('My LLM Node')).toBeInTheDocument()
  })

  it('runStatus="idle" renders no ring and no status icon', () => {
    const { container } = render(<BaseNodeCard {...baseProps} runStatus="idle" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).not.toMatch(/ring-/)
    expect(card.className).not.toMatch(/animate-pulse/)
    // No ✓ / ✗ / — / ⟳ visible
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    expect(screen.queryByText('✗')).not.toBeInTheDocument()
  })

  it('runStatus="running" applies animate-pulse and ring-yellow-400', () => {
    const { container } = render(<BaseNodeCard {...baseProps} runStatus="running" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/ring-yellow-400/)
    expect(card.className).toMatch(/animate-pulse/)
    expect(screen.getByText('⟳')).toBeInTheDocument()
  })

  it('runStatus="completed" shows checkmark ✓ with ring-green-500', () => {
    const { container } = render(<BaseNodeCard {...baseProps} runStatus="completed" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/ring-green-500/)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('runStatus="failed" shows ✗ with ring-red-500', () => {
    const { container } = render(
      <BaseNodeCard {...baseProps} runStatus="failed" runError="Timeout" />,
    )
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/ring-red-500/)
    const icon = screen.getByText('✗')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('title', 'Timeout')
  })

  it('runStatus="skipped" renders — and applies opacity-50', () => {
    const { container } = render(<BaseNodeCard {...baseProps} runStatus="skipped" />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/opacity-50/)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('selected=true applies ring-blue-500 when idle', () => {
    const { container } = render(<BaseNodeCard {...baseProps} selected={true} />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/ring-blue-500/)
  })

  it('selected=true does not override running ring', () => {
    const { container } = render(
      <BaseNodeCard {...baseProps} runStatus="running" selected={true} />,
    )
    const card = container.firstChild as HTMLElement
    // running ring takes precedence
    expect(card.className).toMatch(/ring-yellow-400/)
    expect(card.className).not.toMatch(/ring-blue-500/)
  })

  it('renders children inside the body slot', () => {
    render(
      <BaseNodeCard {...baseProps}>
        <span>body content</span>
      </BaseNodeCard>,
    )
    expect(screen.getByText('body content')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// NodeHandle
// ---------------------------------------------------------------------------

describe('NodeHandle', () => {
  it('type="source" renders on the right side', () => {
    render(<NodeHandle type="source" />)
    const handle = screen.getByTestId('handle-source')
    expect(handle).toBeInTheDocument()
    expect(handle.getAttribute('data-position')).toBe('right')
  })

  it('type="target" renders on the left side', () => {
    render(<NodeHandle type="target" />)
    const handle = screen.getByTestId('handle-target')
    expect(handle).toBeInTheDocument()
    expect(handle.getAttribute('data-position')).toBe('left')
  })

  it('renders a branch label for conditional handles', () => {
    render(<NodeHandle type="source" id="branch-a" label="branch A" />)
    expect(screen.getByText('branch A')).toBeInTheDocument()
  })
})
