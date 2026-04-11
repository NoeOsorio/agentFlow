// @plan B1-PR-3
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CanvasToolbar } from '../CanvasToolbar'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFitView = vi.fn()
const mockZoomIn = vi.fn()
const mockZoomOut = vi.fn()

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    fitView: mockFitView,
    zoomIn: mockZoomIn,
    zoomOut: mockZoomOut,
  }),
}))

vi.mock('dagre', () => {
  class MockGraph {
    setDefaultEdgeLabel = vi.fn()
    setGraph = vi.fn()
    setNode = vi.fn()
    setEdge = vi.fn()
    node = vi.fn().mockReturnValue({ x: 100, y: 100 })
  }
  return {
    default: {
      graphlib: { Graph: MockGraph },
      layout: vi.fn(),
    },
  }
})

// Store state driving render
const storeState = {
  nodes: [] as { id: string; position: { x: number; y: number }; type: string; data: { id: string; type: string } }[],
  edges: [] as { source: string; target: string }[],
  canUndo: false,
  canRedo: false,
  undo: vi.fn(),
  redo: vi.fn(),
  setNodePositions: vi.fn(),
}

vi.mock('../../../store/pipelineStore', () => ({
  usePipelineStore: (sel: (s: typeof storeState) => unknown) => sel(storeState),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetState(overrides: Partial<typeof storeState> = {}): void {
  Object.assign(storeState, {
    nodes: [],
    edges: [],
    canUndo: false,
    canRedo: false,
    undo: vi.fn(),
    redo: vi.fn(),
    setNodePositions: vi.fn(),
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CanvasToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetState()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders zoom and layout controls', () => {
    render(<CanvasToolbar />)
    expect(screen.getByLabelText('Zoom in')).toBeTruthy()
    expect(screen.getByLabelText('Zoom out')).toBeTruthy()
    expect(screen.getByLabelText('Fit view')).toBeTruthy()
    expect(screen.getByLabelText('Auto layout')).toBeTruthy()
    expect(screen.getByLabelText('Undo')).toBeTruthy()
    expect(screen.getByLabelText('Redo')).toBeTruthy()
  })

  it('Undo button is disabled when canUndo === false', () => {
    resetState({ canUndo: false })
    render(<CanvasToolbar />)
    expect((screen.getByLabelText('Undo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Redo button is disabled when canRedo === false', () => {
    resetState({ canRedo: false })
    render(<CanvasToolbar />)
    expect((screen.getByLabelText('Redo') as HTMLButtonElement).disabled).toBe(true)
  })

  it('Undo button is enabled and calls undo when canUndo === true', () => {
    const undo = vi.fn()
    resetState({ canUndo: true, undo })
    render(<CanvasToolbar />)
    const btn = screen.getByLabelText('Undo') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(undo).toHaveBeenCalled()
  })

  it('Redo button is enabled and calls redo when canRedo === true', () => {
    const redo = vi.fn()
    resetState({ canRedo: true, redo })
    render(<CanvasToolbar />)
    const btn = screen.getByLabelText('Redo') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
    fireEvent.click(btn)
    expect(redo).toHaveBeenCalled()
  })

  it('Click Auto Layout calls setNodePositions with computed positions', () => {
    const setNodePositions = vi.fn()
    resetState({
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, type: 'start', data: { id: 'n1', type: 'start' } }],
      edges: [],
      setNodePositions,
    })
    render(<CanvasToolbar />)
    fireEvent.click(screen.getByLabelText('Auto layout'))
    expect(setNodePositions).toHaveBeenCalledWith(expect.objectContaining({ n1: expect.any(Object) }))
  })
})
