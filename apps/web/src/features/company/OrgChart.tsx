// @plan B0-PR-2
import { useState, useRef } from 'react'
import type { Company, InlineAgent, OrgNode as OrgNodeData } from '@agentflow/core'
import { getOrgTree } from '@agentflow/core'
import type { AgentHealthState } from '../../store/types'
import { OrgNode } from './OrgNode'

interface OrgChartProps {
  company: Company
  agentHealth?: Record<string, AgentHealthState>
  onAgentClick: (agentName: string) => void
  onAddReport?: (reportsTo: string) => void
}

interface TreeNodeProps {
  node: OrgNodeData
  agents: InlineAgent[]
  agentHealth?: Record<string, AgentHealthState>
  onAgentClick: (name: string) => void
  onAddReport: (reportsTo: string) => void
}

function TreeNode({ node, agents, agentHealth, onAgentClick, onAddReport }: TreeNodeProps) {
  const agent = agents.find((a) => a.name === node.name)
  if (!agent) return null

  return (
    <div className="flex flex-col items-center">
      <OrgNode
        agent={agent}
        health={agentHealth?.[agent.name]}
        onClick={() => onAgentClick(agent.name)}
        onAddReport={() => onAddReport(agent.name)}
      />

      {node.children.length > 0 && (
        <>
          {/* Vertical connector down */}
          <div className="h-6 w-px bg-gray-600" />

          {/* Horizontal bar connecting children */}
          <div className="relative flex items-start gap-8">
            {/* Top horizontal line spanning all children */}
            {node.children.length > 1 && (
              <div
                className="absolute top-0 h-px bg-gray-600"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: `calc(100% - 100px)`,
                }}
              />
            )}

            {node.children.map((child) => (
              <div key={child.name} className="flex flex-col items-center">
                {/* Vertical connector up to horizontal bar */}
                <div className="h-6 w-px bg-gray-600" />
                <TreeNode
                  node={child}
                  agents={agents}
                  agentHealth={agentHealth}
                  onAgentClick={onAgentClick}
                  onAddReport={onAddReport}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function OrgChart({ company, agentHealth, onAgentClick, onAddReport }: OrgChartProps) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const roots = getOrgTree(company)
  const agents = company.spec.agents

  if (agents.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        No agents defined
      </div>
    )
  }

  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy })
  }

  function handleMouseUp() {
    setDragging(false)
    dragStart.current = null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setScale((s) => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)))
  }

  const handleAddReport = onAddReport ?? (() => {})

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-gray-900 rounded-lg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
    >
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
        <button
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          className="flex h-7 w-7 items-center justify-center rounded bg-gray-700 text-white hover:bg-gray-600 text-sm"
        >
          +
        </button>
        <button
          onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
          className="flex h-7 w-7 items-center justify-center rounded bg-gray-700 text-white hover:bg-gray-600 text-sm"
        >
          −
        </button>
        <button
          onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }) }}
          className="flex h-7 w-7 items-center justify-center rounded bg-gray-700 text-xs text-gray-300 hover:bg-gray-600"
          title="Reset zoom"
        >
          ⊙
        </button>
      </div>

      {/* Chart canvas */}
      <div
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'top center',
          transition: dragging ? 'none' : 'transform 0.1s ease',
          paddingTop: '2rem',
          paddingBottom: '2rem',
        }}
        className="flex justify-center"
      >
        <div className="flex gap-16">
          {roots.map((root) => (
            <TreeNode
              key={root.name}
              node={root}
              agents={agents}
              agentHealth={agentHealth}
              onAgentClick={onAgentClick}
              onAddReport={handleAddReport}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
