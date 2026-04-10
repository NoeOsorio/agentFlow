import { z } from 'zod'

// ---------------------------------------------------------------------------
// Variable Types
// ---------------------------------------------------------------------------

export const VariableTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'file',
])

export type VariableType = z.infer<typeof VariableTypeSchema>

// ---------------------------------------------------------------------------
// Variable Definition (declares an output or input variable)
// ---------------------------------------------------------------------------

export const VariableDefinitionSchema = z.object({
  key: z.string(),
  type: VariableTypeSchema,
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
})

export type VariableDefinition = z.infer<typeof VariableDefinitionSchema>

// ---------------------------------------------------------------------------
// Variable Reference ({{#node_id.variable.path#}} syntax)
// ---------------------------------------------------------------------------

export const VariableReferenceSchema = z.object({
  node_id: z.string(),
  variable: z.string(),
  path: z.array(z.string()).default([]),
})

export type VariableReference = z.infer<typeof VariableReferenceSchema>

// ---------------------------------------------------------------------------
// Literal Value
// ---------------------------------------------------------------------------

export const LiteralValueSchema = z.object({
  literal: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})

export type LiteralValue = z.infer<typeof LiteralValueSchema>

// ---------------------------------------------------------------------------
// Variable Reference Parsing
// ---------------------------------------------------------------------------

const VAR_REF_RE = /^\{\{#([^.#]+)\.([^.#]+)((?:\.[^.#]+)*?)#\}\}$/

/**
 * Parses a {{#node_id.variable.path1.path2#}} string into a VariableReference.
 * Throws if the string does not match the expected format.
 */
export function parseVariableRef(str: string): VariableReference {
  const match = VAR_REF_RE.exec(str)
  if (!match) {
    throw new Error(`Invalid variable reference syntax: "${str}"`)
  }
  const node_id = match[1]!
  const variable = match[2]!
  const pathStr = match[3]!
  const path = pathStr ? pathStr.slice(1).split('.') : []
  return { node_id, variable, path }
}

/**
 * Serializes a VariableReference back to {{#node_id.variable.path#}} format.
 */
export function serializeVariableRef(ref: VariableReference): string {
  const parts = [ref.node_id, ref.variable, ...(ref.path ?? [])]
  return `{{#${parts.join('.')}#}}`
}

// ---------------------------------------------------------------------------
// Recursive Variable Reference Resolution
// ---------------------------------------------------------------------------

/**
 * Walks any object/array and converts {{#...#}} strings to VariableReference objects.
 * Non-matching strings and other primitives are returned as-is.
 */
export function resolveVariableRefs(obj: unknown): unknown {
  if (typeof obj === 'string') {
    try {
      return parseVariableRef(obj)
    } catch {
      return obj
    }
  }
  if (Array.isArray(obj)) {
    return obj.map(resolveVariableRefs)
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, resolveVariableRefs(v)]),
    )
  }
  return obj
}
