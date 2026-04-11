// @plan B1-PR-1 (updated in B1-PR-2)
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { usePipelineStore } from '../store/pipelineStore'
import { CanvasEditor } from '../features/canvas/CanvasEditor'
import { NodePalette } from '../features/canvas/NodePalette'

export default function CanvasPage() {
  const { id } = useParams<{ id: string }>()
  const loadPipeline = usePipelineStore(s => s.loadPipeline)
  const saveStatus = usePipelineStore(s => s.saveStatus)

  useEffect(() => {
    if (id) {
      loadPipeline(id)
    }
  }, [id, loadPipeline])

  if (saveStatus === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <p className="text-lg font-semibold text-red-400">Pipeline not found</p>
          <p className="mt-1 text-sm text-gray-500">
            Could not load pipeline <code className="font-mono">{id}</code>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-950">
      <NodePalette />
      <main className="relative flex-1">
        <CanvasEditor />
      </main>
      {/* ConfigPanel and PipelineHeader mount in B1-PR-3 */}
    </div>
  )
}
