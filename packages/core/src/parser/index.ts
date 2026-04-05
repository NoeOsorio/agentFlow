import yaml from 'js-yaml'
import { z, ZodError } from 'zod'
import { PipelineSchema } from '../schema/pipeline'
import { CompanySchema } from '../schema/company'
import { AgentSchema } from '../schema/agent'
import type { BaseResource } from '../schema/resource'
import type { Pipeline } from '../schema/pipeline'

// ---------------------------------------------------------------------------
// Schema Registry (dispatches by `kind`)
// ---------------------------------------------------------------------------

const schemas: Record<string, z.ZodType> = {
  Company: CompanySchema,
  Agent: AgentSchema,
  Pipeline: PipelineSchema,
}

// ---------------------------------------------------------------------------
// Kind Extraction
// ---------------------------------------------------------------------------

export function getKind(yamlString: string): string | null {
  const match = /^kind:\s*(.+)$/m.exec(yamlString)
  const captured = match?.[1]
  return captured ? captured.trim().replace(/^["']|["']$/g, '') : null
}

// ---------------------------------------------------------------------------
// Single-Resource Parsing
// ---------------------------------------------------------------------------

export function parseResource(yamlString: string): BaseResource {
  const raw = yaml.load(yamlString) as Record<string, unknown>
  const kind = typeof raw?.kind === 'string' ? raw.kind : null
  if (!kind || !schemas[kind]) {
    throw new Error(`Unknown or missing resource kind: ${kind}`)
  }
  return schemas[kind].parse(raw) as BaseResource
}

// ---------------------------------------------------------------------------
// Multi-Document Parsing
// ---------------------------------------------------------------------------

export function parseMultiDocument(yamlString: string): BaseResource[] {
  const docs = yaml.loadAll(yamlString) as Record<string, unknown>[]
  return docs.map((doc) => {
    const kind = typeof doc?.kind === 'string' ? doc.kind : null
    if (!kind || !schemas[kind]) {
      throw new Error(`Unknown or missing resource kind: ${kind}`)
    }
    return schemas[kind].parse(doc) as BaseResource
  })
}

// ---------------------------------------------------------------------------
// Validation (safe — no throw)
// ---------------------------------------------------------------------------

export function validateResource(
  yamlString: string,
): { success: true; data: BaseResource } | { success: false; error: ZodError | Error } {
  try {
    const raw = yaml.load(yamlString) as Record<string, unknown>
    const kind = typeof raw?.kind === 'string' ? raw.kind : null
    if (!kind || !schemas[kind]) {
      return { success: false, error: new Error(`Unknown or missing resource kind: ${kind}`) }
    }
    const result = schemas[kind].safeParse(raw)
    if (result.success) return { success: true, data: result.data as BaseResource }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

export function serializeResource(resource: BaseResource): string {
  return yaml.dump(resource, { indent: 2, lineWidth: 120 })
}

export function serializeMultiDocument(resources: BaseResource[]): string {
  return resources
    .map((r) => yaml.dump(r, { indent: 2, lineWidth: 120 }))
    .join('---\n')
}

// ---------------------------------------------------------------------------
// Legacy API (kept for backward compatibility with existing Pipeline callers)
// ---------------------------------------------------------------------------

export function parseYAML(yamlString: string): Pipeline {
  const raw = yaml.load(yamlString)
  return PipelineSchema.parse(raw)
}

export function serializeAST(pipeline: Pipeline): string {
  return yaml.dump(pipeline, { indent: 2, lineWidth: 120 })
}

export function validateYAML(
  yamlString: string,
): { success: true; data: Pipeline } | { success: false; error: ZodError | Error } {
  try {
    const raw = yaml.load(yamlString)
    const result = PipelineSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e : new Error(String(e)) }
  }
}
