import { z } from 'zod'
import yaml from 'js-yaml'
export type { ModelConfig, ModelProvider } from './model'
export { ModelProviderSchema, ModelConfigSchema } from './model'

// ---------------------------------------------------------------------------
// API Version
// ---------------------------------------------------------------------------

export const ApiVersionSchema = z.enum(['agentflow.ai/v1'])
export type ApiVersion = z.infer<typeof ApiVersionSchema>

// ---------------------------------------------------------------------------
// Resource Metadata (Kubernetes-style)
// ---------------------------------------------------------------------------

const DNS_LABEL_RE = /^[a-z][a-z0-9-]{0,61}[a-z0-9]$|^[a-z]$/

export const ResourceMetadataSchema = z.object({
  name: z
    .string()
    .regex(DNS_LABEL_RE, 'Must be DNS-label format: lowercase, hyphens, max 63 chars'),
  namespace: z.string().default('default'),
  labels: z.record(z.string()).optional(),
  annotations: z.record(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export type ResourceMetadata = z.infer<typeof ResourceMetadataSchema>

// ---------------------------------------------------------------------------
// Base Resource Envelope
// ---------------------------------------------------------------------------

export function BaseResourceSchema<TKind extends string, TSpec extends z.ZodTypeAny>(
  kind: TKind,
  specSchema: TSpec,
) {
  return z.object({
    apiVersion: ApiVersionSchema,
    kind: z.literal(kind),
    metadata: ResourceMetadataSchema,
    spec: specSchema,
  })
}

export type BaseResource<TKind extends string = string, TSpec = unknown> = {
  apiVersion: ApiVersion
  kind: TKind
  metadata: ResourceMetadata
  spec: TSpec
}

// ---------------------------------------------------------------------------
// Multi-Document YAML Utilities
// ---------------------------------------------------------------------------

export function parseMultiDocumentYAML(yamlString: string): unknown[] {
  return yaml.loadAll(yamlString) as unknown[]
}

export function serializeMultiDocumentYAML(resources: BaseResource[]): string {
  return resources
    .map((r) => yaml.dump(r, { indent: 2, lineWidth: 120 }))
    .join('---\n')
}

export function getResourceKey(resource: BaseResource): string {
  const ns = resource.metadata.namespace ?? 'default'
  return `${resource.kind}/${ns}/${resource.metadata.name}`
}
