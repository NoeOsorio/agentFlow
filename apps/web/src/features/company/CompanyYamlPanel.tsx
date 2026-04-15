// @plan B0-PR-3
import { useCallback, useEffect, useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import { useCompanyStore } from '../../store/companyStore'

// Infer Monaco types from the OnMount callback signature
type MonacoInstance = Parameters<OnMount>[1]
type StandaloneEditor = Parameters<OnMount>[0]
type MarkerData = Parameters<MonacoInstance['editor']['setModelMarkers']>[2][number]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CompanyYamlPanel() {
  const yamlSpec = useCompanyStore((s) => s.yamlSpec)
  const yamlErrors = useCompanyStore((s) => s.yamlErrors)
  const setYamlSpec = useCompanyStore((s) => s.setYamlSpec)
  const saveCompany = useCompanyStore((s) => s.saveCompany)
  const companyName = useCompanyStore((s) => s.companyName)

  const editorRef = useRef<StandaloneEditor | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync error markers whenever yamlErrors changes
  useEffect(() => {
    const editor = editorRef.current
    const monacoInstance = monacoRef.current
    if (!editor || !monacoInstance) return
    const model = editor.getModel()
    if (!model) return
    const markers: MarkerData[] = yamlErrors.map((msg, i) => ({
      severity: monacoInstance.MarkerSeverity.Error,
      message: msg,
      startLineNumber: i + 1,
      startColumn: 1,
      endLineNumber: i + 1,
      endColumn: Number.MAX_SAFE_INTEGER,
    }))
    monacoInstance.editor.setModelMarkers(model, 'agentflow-company', markers)
  }, [yamlErrors])

  const handleMount: OnMount = useCallback((editor, monacoInstance) => {
    editorRef.current = editor
    monacoRef.current = monacoInstance
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        setYamlSpec(value)
      }, 300)
    },
    [setYamlSpec],
  )

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(yamlSpec)
  }, [yamlSpec])

  const handleDownload = useCallback(() => {
    const filename = companyName ? `${companyName}.yaml` : 'company.yaml'
    const blob = new Blob([yamlSpec], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [yamlSpec, companyName])

  const handleApply = useCallback(async () => {
    await saveCompany()
  }, [saveCompany])

  return (
    <div className="flex flex-col rounded-xl border border-gray-700 overflow-hidden" style={{ height: '60vh' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900 px-3 py-2">
        <span className="text-xs font-medium text-gray-400">Company YAML</span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Copy
          </button>
          <button
            onClick={handleDownload}
            title="Download .yaml"
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Download
          </button>
          <button
            onClick={handleApply}
            title="Apply to Company (save to API)"
            className="rounded bg-indigo-700 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-600 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          language="yaml"
          theme="vs-dark"
          value={yamlSpec}
          onChange={handleChange}
          onMount={handleMount}
          options={{
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
        <div className="max-h-28 overflow-y-auto border-t border-gray-700 bg-gray-950">
          {yamlErrors.map((err, i) => (
            <div
              key={i}
              className="flex items-start gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-900"
            >
              <span className="mt-0.5 shrink-0 text-red-500">✕</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
