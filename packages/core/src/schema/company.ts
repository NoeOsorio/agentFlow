import { z } from 'zod'
import { BaseResourceSchema, ModelConfigSchema } from './resource'
import type { AgentCapability } from './agent'
import { InlineAgentSchema } from './agent'

// ---------------------------------------------------------------------------
// Department
// ---------------------------------------------------------------------------

export const DepartmentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  agent_names: z.array(z.string()),
  parent_department: z.string().optional(),
})

export type Department = z.infer<typeof DepartmentSchema>

// ---------------------------------------------------------------------------
// Company Policy
// ---------------------------------------------------------------------------

export const CompanyPolicySchema = z.object({
  max_monthly_budget_usd: z.number().positive().optional(),
  default_model: ModelConfigSchema.optional(),
  require_approval_above_usd: z.number().positive().optional(),
  max_concurrent_runs: z.number().int().positive().default(10),
})

export type CompanyPolicy = z.infer<typeof CompanyPolicySchema>

// ---------------------------------------------------------------------------
// Company Spec
// ---------------------------------------------------------------------------

export const CompanySpecSchema = z.object({
  description: z.string().optional(),
  agents: z.array(InlineAgentSchema).min(1),
  departments: z.array(DepartmentSchema).optional(),
  policy: CompanyPolicySchema.optional(),
})

export type CompanySpec = z.infer<typeof CompanySpecSchema>

// ---------------------------------------------------------------------------
// Company Resource
// ---------------------------------------------------------------------------

export const CompanySchema = BaseResourceSchema('Company', CompanySpecSchema)
export type Company = z.infer<typeof CompanySchema>

// ---------------------------------------------------------------------------
// Reference Types (for use by Pipelines)
// ---------------------------------------------------------------------------

export const CompanyReferenceSchema = z.object({
  name: z.string(),
  namespace: z.string().default('default'),
})

export type CompanyReference = z.infer<typeof CompanyReferenceSchema>

export const AgentReferenceSchema = z.object({
  name: z.string(),
  company_ref: CompanyReferenceSchema.optional(),
})

export type AgentReference = z.infer<typeof AgentReferenceSchema>

// ---------------------------------------------------------------------------
// Org Tree
// ---------------------------------------------------------------------------

export interface OrgNode {
  name: string
  role: string
  children: OrgNode[]
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

export function resolveAgent(
  company: Company,
  agentName: string,
): z.infer<typeof InlineAgentSchema> | undefined {
  return company.spec.agents.find((a) => a.name === agentName)
}

export function getOrgTree(company: Company): OrgNode[] {
  const agents = company.spec.agents
  const nodeMap = new Map<string, OrgNode>()

  for (const agent of agents) {
    nodeMap.set(agent.name, { name: agent.name, role: agent.role, children: [] })
  }

  const roots: OrgNode[] = []

  for (const agent of agents) {
    const node = nodeMap.get(agent.name)!
    if (agent.reports_to && nodeMap.has(agent.reports_to)) {
      nodeMap.get(agent.reports_to)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export function getAgentsByCapability(
  company: Company,
  capability: AgentCapability,
): z.infer<typeof InlineAgentSchema>[] {
  return company.spec.agents.filter((a) => a.capabilities?.includes(capability))
}
