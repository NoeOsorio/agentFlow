import { describe, it, expect } from 'vitest'
import {
  parseVariableRef,
  serializeVariableRef,
  resolveVariableRefs,
  VariableDefinitionSchema,
  VariableReferenceSchema,
} from '../schema/variable'

describe('parseVariableRef', () => {
  it('parses a full ref with path', () => {
    const ref = parseVariableRef('{{#llm_1.output.text#}}')
    expect(ref).toEqual({ node_id: 'llm_1', variable: 'output', path: ['text'] })
  })

  it('parses a ref with no path segment', () => {
    const ref = parseVariableRef('{{#start.feature_description#}}')
    expect(ref).toEqual({ node_id: 'start', variable: 'feature_description', path: [] })
  })

  it('parses a ref with multi-segment path', () => {
    const ref = parseVariableRef('{{#node1.result.data.items#}}')
    expect(ref).toEqual({ node_id: 'node1', variable: 'result', path: ['data', 'items'] })
  })

  it('throws on invalid syntax', () => {
    expect(() => parseVariableRef('not-a-ref')).toThrow()
    expect(() => parseVariableRef('{{#only_one#}}')).toThrow()
    expect(() => parseVariableRef('')).toThrow()
  })
})

describe('serializeVariableRef', () => {
  it('serializes a ref with path', () => {
    expect(serializeVariableRef({ node_id: 'llm_1', variable: 'output', path: ['text'] })).toBe(
      '{{#llm_1.output.text#}}',
    )
  })

  it('serializes a ref with empty path', () => {
    expect(
      serializeVariableRef({ node_id: 'start', variable: 'feature_description', path: [] }),
    ).toBe('{{#start.feature_description#}}')
  })
})

describe('parseVariableRef ↔ serializeVariableRef round-trip', () => {
  const cases = [
    '{{#llm_1.output.text#}}',
    '{{#start.feature_description#}}',
    '{{#node_a.result.data.items#}}',
  ]
  for (const ref of cases) {
    it(`round-trips "${ref}"`, () => {
      expect(serializeVariableRef(parseVariableRef(ref))).toBe(ref)
    })
  }
})

describe('resolveVariableRefs', () => {
  it('converts a {{#...#}} string to a VariableReference', () => {
    const result = resolveVariableRefs('{{#llm_1.output.text#}}')
    expect(result).toEqual({ node_id: 'llm_1', variable: 'output', path: ['text'] })
  })

  it('leaves non-ref strings unchanged', () => {
    expect(resolveVariableRefs('hello world')).toBe('hello world')
  })

  it('recursively resolves refs inside objects', () => {
    const input = {
      instruction: '{{#start.task#}}',
      label: 'static',
    }
    const result = resolveVariableRefs(input) as Record<string, unknown>
    expect(result['instruction']).toEqual({ node_id: 'start', variable: 'task', path: [] })
    expect(result['label']).toBe('static')
  })

  it('recursively resolves refs inside arrays', () => {
    const input = ['{{#a.b#}}', 'plain']
    const result = resolveVariableRefs(input) as unknown[]
    expect(result[0]).toEqual({ node_id: 'a', variable: 'b', path: [] })
    expect(result[1]).toBe('plain')
  })

  it('passes through numbers and booleans unchanged', () => {
    expect(resolveVariableRefs(42)).toBe(42)
    expect(resolveVariableRefs(true)).toBe(true)
    expect(resolveVariableRefs(null)).toBeNull()
  })
})

describe('VariableDefinitionSchema', () => {
  it('validates a complete variable definition', () => {
    const result = VariableDefinitionSchema.safeParse({
      key: 'user_input',
      type: 'string',
      description: 'User text',
      required: true,
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown variable types', () => {
    const result = VariableDefinitionSchema.safeParse({ key: 'x', type: 'unknown_type' })
    expect(result.success).toBe(false)
  })
})

describe('VariableReferenceSchema', () => {
  it('validates a variable reference with default empty path', () => {
    const result = VariableReferenceSchema.safeParse({ node_id: 'n1', variable: 'out' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.path).toEqual([])
  })
})
