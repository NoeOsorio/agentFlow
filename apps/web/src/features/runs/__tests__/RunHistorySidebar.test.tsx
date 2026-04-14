// @plan B4-PR-4
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RunHistorySidebar } from '../RunHistorySidebar'
import { usePipelineStore } from '../../../store/pipelineStore'

beforeEach(() => {
  usePipelineStore.setState({ pipelineId: 'pipeline-123', pipelineName: 'my-pipeline' })
  vi.restoreAllMocks()
})

describe('RunHistorySidebar', () => {
  it('fetches runs when opened', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response)

    render(<RunHistorySidebar />)
    fireEvent.click(screen.getByText('History'))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('pipeline_id=pipeline-123'),
      )
    })
  })

  it('displays run cards from API response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'run-1',
          pipeline_id: 'pipeline-123',
          status: 'completed',
          created_at: new Date().toISOString(),
          started_at: new Date(Date.now() - 5000).toISOString(),
          finished_at: new Date().toISOString(),
          total_cost_usd: 0.0042,
        },
      ],
    } as Response)

    render(<RunHistorySidebar />)
    fireEvent.click(screen.getByText('History'))

    await waitFor(() => {
      expect(screen.getByText('completed')).toBeDefined()
    })
  })

  it('"Re-run" button calls execute endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'run-1',
          pipeline_id: 'pipeline-123',
          status: 'completed',
          created_at: new Date().toISOString(),
        },
      ],
    } as Response)

    render(<RunHistorySidebar />)
    fireEvent.click(screen.getByText('History'))

    await waitFor(() => {
      expect(screen.getByText(/Re-run/)).toBeDefined()
    })

    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
    fireEvent.click(screen.getByText(/Re-run/))

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/execute'),
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })
})
