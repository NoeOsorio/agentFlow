// @plan B1-PR-4
import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { usePipelineStore } from '../../store/pipelineStore'
import type { NodeValidationError } from '../../store/types'

// Infer Monaco types from the OnMount callback signature to avoid a direct
// dep on `monaco-editor` (which is a transitive dep of @monaco-editor/react).
type MonacoInstance = Parameters<OnMount>[1]
type StandaloneEditor = Parameters<OnMount>[0]
type MarkerData = Parameters<MonacoInstance['editor']['setModelMarkers']>[2][number]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findLineForError(yaml: string, error: NodeValidationError): number {
  const lines = yaml.split('\n')
  const targets = [error.nodeId, error.field].filter(Boolean)
  for (const target of targets) {
    const idx = lines.findIndex(l => l.includes(target))
    if (idx >= 0) return idx + 1
  }
  return 1
}

function errorsToMarkers(
  yaml: string,
  errors: NodeValidationError[],
  monacoInstance: MonacoInstance,
): MarkerData[] {
  return errors.map(err => {
    const line = findLineForError(yaml, err)
    return {
      severity: monacoInstance.MarkerSeverity.Error,
      message: err.message,
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: Number.MAX_SAFE_INTEGER,
    }
  })
}

// ---------------------------------------------------------------------------
// YamlPanel
// ---------------------------------------------------------------------------

export function YamlPanel() {
  const yamlSpec = usePipelineStore(s => s.yamlSpec)
  const yamlErrors = usePipelineStore(s => s.yamlErrors)
  const yamlPanelOpen = usePipelineStore(s => s.yamlPanelOpen)
  const yamlPanelWidth = usePipelineStore(s => s.yamlPanelWidth)
  const activeRunId = usePipelineStore(s => s.activeRunId)
  const setYamlSpec = usePipelineStore(s => s.setYamlSpec)

  const editorRef = useRef<StandaloneEditor | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isReadOnly = activeRunId !== null

  // Sync error markers whenever yamlErrors changes
  useEffect(() => {
    const editor = editorRef.current
    const monacoInstance = monacoRef.current
    if (!editor || !monacoInstance) return
    const model = editor.getModel()
    if (!model) return
    const markers = errorsToMarkers(yamlSpec, yamlErrors, monacoInstance)
    monacoInstance.editor.setModelMarkers(model, 'agentflow', markers)
  }, [yamlErrors, yamlSpec])

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (isReadOnly || value === undefined) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setYamlSpec(value)
      }, 300)
    },
    [isReadOnly, setYamlSpec],
  )

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(yamlSpec)
  }, [yamlSpec])

  const handleDownload = useCallback(() => {
    const blob = new Blob([yamlSpec], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pipeline.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }, [yamlSpec])

  const handleFormat = useCallback(() => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run()
  }, [])

  if (!yamlPanelOpen) return null

  return (
    <div
      className="flex min-h-0 min-w-0 shrink-0 flex-col self-stretch border-l border-gray-800 bg-gray-950"
      style={{ width: yamlPanelWidth }}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-xs font-medium text-gray-400">YAML</span>
        <div className="flex gap-1">
          {isReadOnly && (
            <span className="mr-2 rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-400">
              Read-only (run active)
            </span>
          )}
          <button
            onClick={handleFormat}
            disabled={isReadOnly}
            title="Format"
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-40"
          >
            Format
          </button>
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            title="Download pipeline.yaml"
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            Download
          </button>
        </div>
      </div>

      {/* Editor — parent must be min-h-0 in a flex column so Monaco’s 100% height resolves */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="yaml"
          theme="vs-dark"
          value={yamlSpec}
          onChange={handleChange}
          onMount={handleMount}
          options={{
            readOnly: isReadOnly,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            glyphMargin: true,
          }}
        />
      </div>

      {/* Error summary */}
      {yamlErrors.length > 0 && (
        <div className="border-t border-gray-800 max-h-32 overflow-y-auto">
          {yamlErrors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-900"
            >
              <span className="mt-0.5 shrink-0 text-red-500">✕</span>
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
