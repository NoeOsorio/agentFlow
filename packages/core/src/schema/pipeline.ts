import { z } from 'zod'

export const ResourceConfigSchema = z.object({
  tokens: z.number().int().positive().describe('Maximum token budget for this agent'),
  timeout: z.string().describe('Timeout duration string, e.g. "45s", "2m"'),
})

export const AgentConfigSchema = z.object({
  name: z.string().describe('Unique agent name within the pipeline'),
  image: z.string().optional().describe('Container image reference, e.g. agents/research:v1.2'),
  dependsOn: z.array(z.string()).optional().describe('List of agent names this agent depends on'),
  resources: ResourceConfigSchema.optional().describe('Resource limits for this agent'),
  minScore: z.number().min(0).max(1).optional().describe('Minimum quality score threshold (0-1)'),
})

export const TriggerConfigSchema = z.object({
  source: z.string().describe('Event source that triggers the pipeline, e.g. stripe.payment.success'),
  intake: z.string().optional().describe('Intake form identifier'),
})

export const ContextConfigSchema = z.object({
  builder: z.string().describe('Context builder identifier'),
  shared: z.boolean().default(false).describe('Whether context is shared across agents'),
})

export const PolicyConfigSchema = z.object({
  concurrency: z.number().int().positive().describe('Maximum number of agents running in parallel'),
  budget: z.string().describe('Cost budget string, e.g. "$4.00"'),
  retries: z.number().int().min(0).describe('Number of retry attempts on failure'),
  backoff: z.string().describe('Backoff strategy, e.g. "exponential", "linear"'),
  onFailure: z.string().describe('Failure handling strategy, e.g. "dead-letter-queue"'),
})

export const DeployConfigSchema = z.object({
  provider: z.string().describe('Deployment provider, e.g. "vercel", "netlify"'),
  domain: z.string().describe('Target domain, may include template variables'),
})

export const NotifyConfigSchema = z.object({
  channel: z.string().describe('Notification channel, e.g. "email", "slack"'),
  template: z.string().describe('Notification template path'),
})

export const OutputConfigSchema = z.object({
  type: z.string().describe('Output type, e.g. "website", "report"'),
  deploy: DeployConfigSchema.optional().describe('Deployment configuration'),
  notify: NotifyConfigSchema.optional().describe('Notification configuration'),
})

export const PipelineSchema = z.object({
  apiVersion: z.string().describe('API version, e.g. "florai/v1"'),
  kind: z.literal('Pipeline').describe('Resource kind — must be "Pipeline"'),
  namespace: z.string().describe('Namespace for the pipeline'),
  name: z.string().describe('Unique pipeline name within the namespace'),
  trigger: TriggerConfigSchema.describe('Event trigger configuration'),
  context: ContextConfigSchema.describe('Context builder configuration'),
  agents: z.array(AgentConfigSchema).min(1).describe('List of agent definitions'),
  policy: PolicyConfigSchema.describe('Execution policy configuration'),
  output: OutputConfigSchema.describe('Pipeline output configuration'),
})

// Inferred types from schemas
export type ResourceConfig = z.infer<typeof ResourceConfigSchema>
export type AgentConfig = z.infer<typeof AgentConfigSchema>
export type TriggerConfig = z.infer<typeof TriggerConfigSchema>
export type ContextConfig = z.infer<typeof ContextConfigSchema>
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>
export type DeployConfig = z.infer<typeof DeployConfigSchema>
export type NotifyConfig = z.infer<typeof NotifyConfigSchema>
export type OutputConfig = z.infer<typeof OutputConfigSchema>
export type Pipeline = z.infer<typeof PipelineSchema>
