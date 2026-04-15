// @plan B1-PR-3
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useCompanyStore } from '../../store/companyStore'
import { usePipelineStore, useNodeValidationErrors, useVariableScope } from '../../store/pipelineStore'
import { nodeConfigForms } from './nodeConfigForms'
import type { AgentPodNode, PipelineNode } from '@agentflow/core'

const NODE_TYPE_LABELS: Record<string, string> = {
  start: 'Start',
  end: 'End',
  agent_pod: 'Agent Pod',
  llm: 'LLM',
  code: 'Code',
  http: 'HTTP Request',
  if_else: 'IF / ELSE',
  template: 'Template',
  variable_assigner: 'Variable Assigner',
  variable_aggregator: 'Variable Aggregator',
  iteration: 'Iteration',
  human_input: 'Human Input',
  knowledge_retrieval: 'Knowledge Retrieval',
  sub_workflow: 'Sub-Workflow',
}

const NODE_TYPE_ICONS: Record<string, string> = {
  start: '▶',
  end: '⏹',
  agent_pod: '🤖',
  llm: '✨',
  code: '</>',
  http: '🌐',
  if_else: '⚡',
  template: '📄',
  variable_assigner: '📌',
  variable_aggregator: '🔀',
  iteration: '🔁',
  human_input: '🙋',
  knowledge_retrieval: '📚',
  sub_workflow: '⚙',
}

export function ConfigPanel() {
  const { selectedNodeId, nodes, deleteNode, updateNodeConfig, deselectNode } = usePipelineStore(
    useShallow(s => ({ selectedNodeId: s.selectedNodeId, nodes: s.nodes, deleteNode: s.deleteNode, updateNodeConfig: s.updateNodeConfig, deselectNode: s.deselectNode }))
  )
  const errors = useNodeValidationErrors(selectedNodeId ?? '')
  const company = useCompanyStore(s => s.company)
  const availableAgents = company?.spec.agents ?? []
  const availableVariables = useVariableScope(selectedNodeId ?? '')

  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId) ?? null
    : null

  const resolvedAgentSpec = useMemo(() => {
    if (!selectedNode || selectedNode.data.type !== 'agent_pod') return undefined
    const ref = (selectedNode.data as AgentPodNode).agent_ref
    const name = ref?.name
    if (!name || !company?.spec.agents) return undefined
    return company.spec.agents.find(a => a.name === name)
  }, [selectedNode, company])

  const isOpen = selectedNode !== null

  function handleDelete(): void {
    if (!selectedNodeId) return
    deleteNode(selectedNodeId)
    setConfirmDelete(false)
  }

  const nodeType = selectedNode?.data.type ?? ''
  const Form = nodeType ? nodeConfigForms[nodeType] : undefined

  return (
    <div
      className={`
        absolute right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-700 shadow-2xl
        flex flex-col z-20 transition-transform duration-200
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}
      aria-hidden={!isOpen}
    >
      {selectedNode && (
        <>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700 shrink-0">
            <span className="text-lg" aria-hidden>
              {NODE_TYPE_ICONS[nodeType] ?? '□'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                {NODE_TYPE_LABELS[nodeType] ?? nodeType}
              </p>
              <p className="text-xs text-gray-600 truncate font-mono">{selectedNode.id}</p>
            </div>
            <button
              className="text-gray-400 hover:text-white transition-colors p-1 rounded"
              onClick={deselectNode}
              aria-label="Close panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="mx-4 mt-3 shrink-0">
              {errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 bg-red-950 border border-red-800 rounded px-3 py-2 mb-1 text-xs text-red-300"
                >
                  <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Form body */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {Form ? (
              <Form
                value={selectedNode.data as PipelineNode}
                onChange={(patch: Partial<PipelineNode>) =>
                  updateNodeConfig(selectedNode.id, patch)
                }
                nodeId={selectedNode.id}
                availableAgents={availableAgents}
                availableVariables={availableVariables}
                resolvedAgentSpec={resolvedAgentSpec}
              />
            ) : (
              <p className="text-sm text-gray-500 italic">No configuration for this node type.</p>
            )}
          </div>

          {/* Footer — delete */}
          <div className="px-4 py-3 border-t border-gray-700 shrink-0">
            {confirmDelete ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-400">Delete this node and its edges?</p>
                <div className="flex gap-2">
                  <button
                    className="flex-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded px-3 py-1.5 transition-colors"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                  <button
                    className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1.5 transition-colors"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-red-950 border border-red-800 rounded px-3 py-1.5 transition-colors"
                onClick={() => setConfirmDelete(true)}
              >
                Delete Node
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
