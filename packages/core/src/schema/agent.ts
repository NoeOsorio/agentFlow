import { z } from 'zod'
import { BaseResourceSchema, ModelConfigSchema } from './resource'

// ---------------------------------------------------------------------------
// Agent Capabilities
// ---------------------------------------------------------------------------

export const AgentCapabilitySchema = z.union([
  z.enum([
    'coding',
    'research',
    'writing',
    'analysis',
    'review',
    'planning',
    'execution',
    'management',
  ]),
  z.string(),
])

export type AgentCapability = z.infer<typeof AgentCapabilitySchema>

// ---------------------------------------------------------------------------
// Agent Budget
// ---------------------------------------------------------------------------

export const AgentBudgetSchema = z.object({
  monthly_usd: z.number().positive(),
  tokens_limit: z.number().int().positive().optional(),
  alert_threshold_pct: z.number().min(0).max(100).default(80),
})

export type AgentBudget = z.infer<typeof AgentBudgetSchema>

// ---------------------------------------------------------------------------
// Heartbeat Config
// ---------------------------------------------------------------------------

export const HeartbeatConfigSchema = z.object({
  interval_seconds: z.number().positive(),
  timeout_seconds: z.number().positive(),
  on_timeout: z.enum(['continue', 'fail', 'retry']),
})

export type HeartbeatConfig = z.infer<typeof HeartbeatConfigSchema>

// ---------------------------------------------------------------------------
// Agent Lifecycle
// ---------------------------------------------------------------------------

export const AgentLifecycleSchema = z.object({
  on_start: z.string().url().optional(),
  on_done: z.string().url().optional(),
  on_fail: z.string().url().optional(),
  heartbeat: HeartbeatConfigSchema.optional(),
})

export type AgentLifecycle = z.infer<typeof AgentLifecycleSchema>

// ---------------------------------------------------------------------------
// Agent Spec (used both inline in Company and as standalone Agent resource)
// ---------------------------------------------------------------------------

export const AgentSpecSchema = z.object({
  role: z.string(),
  persona: z.string().optional(),
  model: ModelConfigSchema,
  capabilities: z.array(AgentCapabilitySchema).optional(),
  budget: AgentBudgetSchema.optional(),
  lifecycle: AgentLifecycleSchema.optional(),
  memory: z
    .object({
      enabled: z.boolean(),
      max_entries: z.number().int().positive().optional(),
    })
    .optional(),
  reports_to: z.string().nullable().optional(),
})

export type AgentSpec = z.infer<typeof AgentSpecSchema>

// ---------------------------------------------------------------------------
// Inline Agent (used inside Company.spec.agents — has a name field)
// ---------------------------------------------------------------------------

export const InlineAgentSchema = z
  .object({ name: z.string() })
  .merge(AgentSpecSchema)

export type InlineAgent = z.infer<typeof InlineAgentSchema>

// ---------------------------------------------------------------------------
// Standalone Agent Resource
// ---------------------------------------------------------------------------

export const AgentSchema = BaseResourceSchema('Agent', AgentSpecSchema)
export type Agent = z.infer<typeof AgentSchema>
