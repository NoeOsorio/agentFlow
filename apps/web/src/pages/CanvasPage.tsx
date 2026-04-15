// @plan B1-PR-1 (updated in B1-PR-2)
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { usePipelineStore } from '../store/pipelineStore'
import { useCompanyStore } from '../store/companyStore'
import { CanvasEditor } from '../features/canvas/CanvasEditor'
import { ConfigPanel } from '../features/canvas/ConfigPanel'
import { NodePalette } from '../features/canvas/NodePalette'
import { PipelineHeader } from '../features/canvas/PipelineHeader'
import { YamlPanel } from '../features/canvas/YamlPanel'

export default function CanvasPage() {
  const { pipelineName: pipelineNameParam } = useParams<{ pipelineName?: string }>()
  const pipelineResourceName = pipelineNameParam ? decodeURIComponent(pipelineNameParam) : undefined
  const [loading, setLoading] = useState(!!pipelineResourceName)

  const { loadPipeline, saveStatus, nodes, companyRef } = usePipelineStore(
    useShallow(s => ({ loadPipeline: s.loadPipeline, saveStatus: s.saveStatus, nodes: s.nodes, companyRef: s.companyRef }))
  )
  const loadCompany = useCompanyStore(s => s.loadCompany)

  useEffect(() => {
    if (!pipelineResourceName) return
    setLoading(true)
    loadPipeline(pipelineResourceName).finally(() => setLoading(false))
  }, [pipelineResourceName, loadPipeline])

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
            Could not load pipeline
            {pipelineResourceName ? ` "${pipelineResourceName}"` : ''}.
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PipelineHeader />
        <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <CanvasEditor />
            <ConfigPanel />
          </div>
          <YamlPanel />
        </main>
      </div>
    </div>
  )
}
