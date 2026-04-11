// @plan B2-PR-4
import { lazy, Suspense } from 'react'

// Lazy-load Monaco to avoid bloating the initial bundle
const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default })),
)

interface CodeEditorProps {
  value: string
  onChange: (code: string) => void
  language?: 'python' | 'javascript'
  height?: number
}

export function CodeEditor({ value, onChange, language = 'python', height = 300 }: CodeEditorProps) {
  return (
    <div
      className="overflow-hidden rounded border border-gray-600"
      style={{ height }}
    >
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center bg-gray-900 text-sm text-gray-500"
            style={{ height }}
          >
            Loading editor…
          </div>
        }
      >
        <MonacoEditor
          height={height}
          language={language}
          theme="vs-dark"
          value={value}
          onChange={(val) => onChange(val ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
          }}
        />
      </Suspense>
    </div>
  )
}
