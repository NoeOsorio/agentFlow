// @plan B1-PR-1 (updated in B1-PR-2)
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { usePipelineStore } from '../store/pipelineStore'
import { useCompanyStore } from '../store/companyStore'
import { CanvasEditor } from '../features/canvas/CanvasEditor'
import { NodePalette } from '../features/canvas/NodePalette'

export default function CanvasPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(!!id)

  const loadPipeline = usePipelineStore(s => s.loadPipeline)
  const saveStatus = usePipelineStore(s => s.saveStatus)
  const nodes = usePipelineStore(s => s.nodes)
  const companyRef = usePipelineStore(s => s.companyRef)
  const loadCompany = useCompanyStore(s => s.loadCompany)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    loadPipeline(id).finally(() => setLoading(false))
  }, [id, loadPipeline])

  useEffect(() => {
    if (companyRef) {
      loadCompany(companyRef.name)
    }
  }, [companyRef, loadCompany])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950">
        <div className="w-64 space-y-3">
          <div className="h-8 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-gray-800" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-gray-800" />
        </div>
      </div>
    )
  }

  if (saveStatus === 'error' && nodes.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950">
        <div className="space-y-2 text-center">
          <p className="text-lg font-semibold text-red-400">Pipeline not found</p>
          <p className="text-sm text-gray-400">
            Could not load pipeline{id ? ` "${id}"` : ''}.
          </p>
          <Link to="/pipelines" className="text-sm text-blue-400 hover:underline">
            ← Back to pipelines
          </Link>
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
