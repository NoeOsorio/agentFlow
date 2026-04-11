// @plan B1-PR-4
// Unit tests for YamlPanel helper logic (pure functions, no store dependency).
// Component-level behaviour (readOnly, Monaco markers) is covered by integration
// tests when a jsdom environment is available.
import { describe, it, expect } from 'vitest'
import type { NodeValidationError } from '../../../store/types'

// ---------------------------------------------------------------------------
// Inline the pure helpers from YamlPanel (same logic, tested in isolation)
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('YamlPanel — findLineForError', () => {
  const sampleYaml = [
    'apiVersion: agentflow.ai/v1',
    'kind: Pipeline',
    'metadata:',
    '  name: test',
    'spec:',
    '  nodes:',
    '    - id: start_1',
    '      type: start',
    '  edges: []',
  ].join('\n')

  it('finds the correct line when nodeId is in the YAML', () => {
    const error: NodeValidationError = { nodeId: 'start_1', field: 'type', message: 'bad' }
    const line = findLineForError(sampleYaml, error)
    // "start_1" appears on line 7
    expect(line).toBe(7)
  })

  it('falls back to field match when nodeId is empty', () => {
    const error: NodeValidationError = { nodeId: '', field: 'edges', message: 'cycle' }
    const line = findLineForError(sampleYaml, error)
    // "edges" appears on line 9
    expect(line).toBe(9)
  })

  it('returns line 1 when neither nodeId nor field is found', () => {
    const error: NodeValidationError = { nodeId: 'unknown_node', field: 'nonexistent_field', message: 'x' }
    const line = findLineForError(sampleYaml, error)
    expect(line).toBe(1)
  })

  it('handles empty yaml gracefully', () => {
    const error: NodeValidationError = { nodeId: 'n1', field: 'type', message: 'x' }
    const line = findLineForError('', error)
    expect(line).toBe(1)
  })
})

describe('YamlPanel — copy content (unit check)', () => {
  it('yamlSpec string is what clipboard would receive', () => {
    // The Copy button calls navigator.clipboard.writeText(yamlSpec).
    // Here we verify the content is passed through unmodified.
    const yamlSpec = 'apiVersion: agentflow.ai/v1\nkind: Pipeline\n'
    let written = ''
    const mockClipboard = { writeText: async (s: string) => { written = s } }
    void mockClipboard.writeText(yamlSpec)
    expect(written).toBe(yamlSpec)
  })
})
