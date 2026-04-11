// @plan B1-PR-3
import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { usePipelineStore } from '../../../store/pipelineStore'

/**
 * Registers global keyboard shortcuts for the canvas editor.
 * Must be called inside a ReactFlowProvider subtree.
 */
export function useKeyboardShortcuts(): void {
  const { fitView } = useReactFlow()
  const deleteNode = usePipelineStore(s => s.deleteNode)
  const deleteEdge = usePipelineStore(s => s.deleteEdge)
  const deselectNode = usePipelineStore(s => s.deselectNode)
  const undo = usePipelineStore(s => s.undo)
  const redo = usePipelineStore(s => s.redo)
  const savePipeline = usePipelineStore(s => s.savePipeline)
  const selectedNodeId = usePipelineStore(s => s.selectedNodeId)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? event.metaKey : event.ctrlKey
      const target = event.target as HTMLElement
      // Don't intercept shortcuts while typing in inputs/textareas
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Allow Ctrl+S even in inputs so autosave shortcut still works
        if (!(mod && event.key === 's')) return
      }

      // Ctrl/Cmd+S → save
      if (mod && event.key === 's') {
        event.preventDefault()
        void savePipeline()
        return
      }

      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y → redo
      if (mod && (event.shiftKey && event.key === 'z')) {
        event.preventDefault()
        redo()
        return
      }

      // Ctrl/Cmd+Z → undo
      if (mod && event.key === 'z') {
        event.preventDefault()
        undo()
        return
      }

      // Space → fit view
      if (event.key === ' ') {
        event.preventDefault()
        fitView({ duration: 300 })
        return
      }

      // Escape → deselect all
      if (event.key === 'Escape') {
        deselectNode()
        return
      }

      // Delete / Backspace → delete selected node
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedNodeId) {
          deleteNode(selectedNodeId)
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedNodeId, deleteNode, deleteEdge, deselectNode, undo, redo, savePipeline, fitView])
}
