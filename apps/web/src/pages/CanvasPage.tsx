// @plan B1-PR-1
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ReactFlow, Background, Controls, MiniMap } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { usePipelineStore } from '../store/pipelineStore'
import { useCompanyStore } from '../store/companyStore'
import { nodeTypes, edgeTypes } from '../features/canvas'

export default function CanvasPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(!!id)

  const loadPipeline = usePipelineStore(s => s.loadPipeline)
  const saveStatus = usePipelineStore(s => s.saveStatus)
  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
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
    <div className="h-screen w-screen bg-gray-950">
      <div className="absolute left-4 top-4 z-10 text-white">
        <h1 className="text-lg font-semibold">AgentFlow Canvas</h1>
        <p className="text-xs text-gray-400">
          {id ? `Pipeline: ${id}` : 'New Pipeline'}
        </p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
