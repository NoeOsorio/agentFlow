// @plan B0-PR-3
import { useState } from 'react'
import type { Company, Department } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DepartmentPanelProps {
  company: Company
  onUpdate: (departments: Department[]) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DepartmentPanel({ company, onUpdate }: DepartmentPanelProps) {
  const departments = company.spec.departments ?? []
  const agents = company.spec.agents

  const [showAddForm, setShowAddForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [dragging, setDragging] = useState<{ agentName: string; fromDept: string | null } | null>(null)

  function handleAddDepartment() {
    if (!newName.trim()) return
    const dept: Department = {
      name: newName.trim(),
      description: newDesc.trim() || undefined,
      agent_names: [],
    }
    onUpdate([...departments, dept])
    setNewName('')
    setNewDesc('')
    setShowAddForm(false)
  }

  function handleDeleteDepartment(deptName: string) {
    if (!confirm(`Delete department "${deptName}"? Agents will be unassigned.`)) return
    onUpdate(departments.filter((d) => d.name !== deptName))
  }

  function handleDragStart(agentName: string, fromDept: string | null) {
    setDragging({ agentName, fromDept })
  }

  function handleDropOnDepartment(e: React.DragEvent, targetDept: string) {
    e.preventDefault()
    if (!dragging) return
    const { agentName, fromDept } = dragging
    if (fromDept === targetDept) {
      setDragging(null)
      return
    }
    const updated = departments.map((d) => {
      if (d.name === fromDept) {
        return { ...d, agent_names: d.agent_names.filter((n) => n !== agentName) }
      }
      if (d.name === targetDept) {
        return { ...d, agent_names: [...d.agent_names, agentName] }
      }
      return d
    })
    onUpdate(updated)
    setDragging(null)
  }

  // Agents not in any department
  const assignedAgents = new Set(departments.flatMap((d) => d.agent_names))
  const unassignedAgents = agents.filter((a) => !assignedAgents.has(a.name))

  return (
    <div className="space-y-4">
      {/* Unassigned agents */}
      <div
        className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDropOnDepartment(e, '')}
      >
        <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</p>
        {unassignedAgents.length === 0 ? (
          <p className="text-xs text-gray-600">All agents assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassignedAgents.map((agent) => (
              <div
                key={agent.name}
                draggable
                onDragStart={() => handleDragStart(agent.name, null)}
                className="flex cursor-grab items-center gap-1.5 rounded-full border border-gray-600 bg-gray-800 px-3 py-1 text-xs text-gray-300 hover:border-gray-500 active:cursor-grabbing"
              >
                <span className="h-2 w-2 rounded-full bg-gray-500" />
                {agent.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Departments */}
      {departments.map((dept) => (
        <div
          key={dept.name}
          className="rounded-xl border border-gray-700 bg-gray-900 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropOnDepartment(e, dept.name)}
        >
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-white">{dept.name}</p>
              {dept.description && (
                <p className="mt-0.5 text-xs text-gray-500">{dept.description}</p>
              )}
            </div>
            <button
              onClick={() => handleDeleteDepartment(dept.name)}
              className="text-xs text-gray-600 hover:text-red-400 transition-colors"
              title="Delete department"
            >
              Delete
            </button>
          </div>

          {dept.agent_names.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Drop agents here</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dept.agent_names.map((agentName) => {
                const agent = agents.find((a) => a.name === agentName)
                return (
                  <div
                    key={agentName}
                    draggable
                    onDragStart={() => handleDragStart(agentName, dept.name)}
                    className="flex cursor-grab items-center gap-1.5 rounded-full border border-indigo-700 bg-indigo-900/40 px-3 py-1 text-xs text-indigo-300 hover:border-indigo-500 active:cursor-grabbing"
                  >
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    {agentName}
                    {agent && (
                      <span className="ml-1 text-indigo-500">· {agent.role}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Add Department */}
      {showAddForm ? (
        <div className="rounded-xl border border-gray-600 bg-gray-900 p-4 space-y-3">
          <p className="text-sm font-medium text-white">New Department</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Department name"
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
            autoFocus
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddDepartment}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAddForm(false); setNewName(''); setNewDesc('') }}
              className="rounded-lg px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-xl border border-dashed border-gray-700 py-3 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-300 transition-colors"
        >
          + Add Department
        </button>
      )}
    </div>
  )
}
