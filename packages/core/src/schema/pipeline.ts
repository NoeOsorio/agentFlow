import { z } from 'zod'
import { BaseResourceSchema } from './resource'
import { CompanyReferenceSchema } from './company'
import { VariableDefinitionSchema } from './variable'

// ---------------------------------------------------------------------------
// Trigger Config
// ---------------------------------------------------------------------------

export const TriggerConfigSchema = z.object({
  type: z.string().describe('Trigger type, e.g. "webhook", "cron", "manual"'),
  source: z.string().optional().describe('Event source, e.g. "github", "stripe"'),
  intake: z.string().optional().describe('Intake form identifier'),
})

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>

// ---------------------------------------------------------------------------
// Policy Config
// ---------------------------------------------------------------------------

export const PolicyConfigSchema = z.object({
  concurrency: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of agents running in parallel'),
  budget: z.string().optional().describe('Cost budget string, e.g. "$4.00"'),
  retries: z.number().int().min(0).optional().describe('Number of retry attempts on failure'),
  backoff: z
    .enum(['linear', 'exponential', 'fixed'])
    .optional()
    .describe('Backoff strategy'),
  onFailure: z
    .enum(['dead-letter-queue', 'stop', 'retry'])
    .optional()
    .describe('Failure handling strategy'),
})

export type PolicyConfig = z.infer<typeof PolicyConfigSchema>

// ---------------------------------------------------------------------------
// Pipeline Spec
// Node/edge schemas use z.record(z.unknown()) until schema/nodes.ts is
// defined in A1-PR-2. They will be replaced with discriminated unions then.
// ---------------------------------------------------------------------------

export const PipelineSpecSchema = z.object({
  company_ref: CompanyReferenceSchema.optional().describe(
    'Reference to a Company resource; agents are resolved from this company',
  ),
  trigger: TriggerConfigSchema.optional(),
  nodes: z
    .array(z.record(z.unknown()))
    .default([])
    .describe('Pipeline DAG nodes (typed in A1-PR-2)'),
  edges: z
    .array(z.record(z.unknown()))
    .default([])
    .describe('Pipeline DAG edges (typed in A1-PR-2)'),
  variables: z
    .array(VariableDefinitionSchema)
    .optional()
    .describe('Pipeline-level input variable declarations'),
  policy: PolicyConfigSchema.optional(),
  canvas_meta: z.unknown().optional().describe('Canvas positional metadata (typed in A1-PR-2)'),
})

export type PipelineSpec = z.infer<typeof PipelineSpecSchema>

// ---------------------------------------------------------------------------
// Pipeline Resource (Kubernetes-style envelope)
// ---------------------------------------------------------------------------

export const PipelineResourceSchema = BaseResourceSchema('Pipeline', PipelineSpecSchema)

export type Pipeline = z.infer<typeof PipelineResourceSchema>

// ---------------------------------------------------------------------------
// Deprecated alias — kept so existing parser registry and tests compile.
// Switch to PipelineResourceSchema for new code.
// ---------------------------------------------------------------------------

/**
 * @deprecated Use `PipelineResourceSchema` instead.
 */
export const PipelineSchema = PipelineResourceSchema

// ---------------------------------------------------------------------------
// Legacy type aliases kept for backward compatibility
// @deprecated
// ---------------------------------------------------------------------------

/** @deprecated */
export type ResourceConfig = {
  tokens: number
  timeout: string
}

/** @deprecated */
export type AgentConfig = {
  name: string
  image?: string
  dependsOn?: string[]
  resources?: ResourceConfig
  minScore?: number
}

/** @deprecated */
export type ContextConfig = {
  builder: string
  shared: boolean
}

/** @deprecated */
export type DeployConfig = {
  provider: string
  domain: string
}

/** @deprecated */
export type NotifyConfig = {
  channel: string
  template: string
}

/** @deprecated */
export type OutputConfig = {
  type: string
  deploy?: DeployConfig
  notify?: NotifyConfig
}
