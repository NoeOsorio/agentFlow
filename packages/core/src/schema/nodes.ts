import { z } from 'zod'
import { VariableDefinitionSchema, VariableReferenceSchema, LiteralValueSchema } from './variable'
import { ModelConfigSchema, PromptSchema } from './model'
import { ConditionGroupSchema } from './conditions'
import { AgentReferenceSchema } from './company'

// ---------------------------------------------------------------------------
// Shared node base fields (id + label), merged via intersection
// ---------------------------------------------------------------------------

const NodeBaseSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Resource Config (compute limits per node)
// ---------------------------------------------------------------------------

const NodeResourceConfigSchema = z.object({
  tokens: z.number().int().positive().optional(),
  timeout: z.string().optional(),
})

// ---------------------------------------------------------------------------
// 1. Start Node
// ---------------------------------------------------------------------------

export const StartNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('start'),
    outputs: z.array(VariableDefinitionSchema),
  }),
)

export type StartNode = z.infer<typeof StartNodeSchema>

// ---------------------------------------------------------------------------
// 2. End Node
// ---------------------------------------------------------------------------

export const EndNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('end'),
    inputs: z.array(VariableReferenceSchema),
  }),
)

export type EndNode = z.infer<typeof EndNodeSchema>

// ---------------------------------------------------------------------------
// 3. LLM Node
// ---------------------------------------------------------------------------

export const LLMNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('llm'),
    model: ModelConfigSchema,
    prompt: PromptSchema,
    output_schema: z.record(z.unknown()).optional(),
    agent_ref: AgentReferenceSchema.optional(),
  }),
)

export type LLMNode = z.infer<typeof LLMNodeSchema>

// ---------------------------------------------------------------------------
// 4. Agent Pod Node
// ---------------------------------------------------------------------------

export const AgentPodNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('agent_pod'),
    agent_ref: AgentReferenceSchema,
    instruction: z.string(),
    inputs: z.record(VariableReferenceSchema).optional(),
    resource: NodeResourceConfigSchema.optional(),
  }),
)

export type AgentPodNode = z.infer<typeof AgentPodNodeSchema>

// ---------------------------------------------------------------------------
// 5. Code Node
// ---------------------------------------------------------------------------

export const CodeNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('code'),
    language: z.enum(['python', 'javascript']),
    code: z.string(),
    inputs: z.array(VariableReferenceSchema),
    outputs: z.array(VariableDefinitionSchema),
    timeout_seconds: z.number().int().positive().optional(),
  }),
)

export type CodeNode = z.infer<typeof CodeNodeSchema>

// ---------------------------------------------------------------------------
// 6. HTTP Node
// ---------------------------------------------------------------------------

export const HTTPNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('http'),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    url: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.union([z.string(), z.record(z.unknown())]).optional(),
    timeout_ms: z.number().int().positive().optional(),
  }),
)

export type HTTPNode = z.infer<typeof HTTPNodeSchema>

// ---------------------------------------------------------------------------
// 7. If/Else Node
// ---------------------------------------------------------------------------

export const IfElseNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('if_else'),
    conditions: z.array(ConditionGroupSchema).min(1),
    default_branch: z.string(),
  }),
)

export type IfElseNode = z.infer<typeof IfElseNodeSchema>

// ---------------------------------------------------------------------------
// 8. Template Node
// ---------------------------------------------------------------------------

export const TemplateNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('template'),
    template: z.string(),
    inputs: z.array(VariableReferenceSchema),
  }),
)

export type TemplateNode = z.infer<typeof TemplateNodeSchema>

// ---------------------------------------------------------------------------
// 9. Variable Assigner Node
// ---------------------------------------------------------------------------

export const VariableAssignerNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('variable_assigner'),
    assignments: z
      .array(
        z.object({
          key: z.string(),
          value: z.union([VariableReferenceSchema, LiteralValueSchema]),
        }),
      )
      .min(1),
  }),
)

export type VariableAssignerNode = z.infer<typeof VariableAssignerNodeSchema>

// ---------------------------------------------------------------------------
// 10. Variable Aggregator Node
// ---------------------------------------------------------------------------

export const VariableAggregatorNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('variable_aggregator'),
    branches: z.array(z.string()).min(1),
    output_key: z.string(),
    strategy: z.enum(['first', 'merge', 'list']),
  }),
)

export type VariableAggregatorNode = z.infer<typeof VariableAggregatorNodeSchema>

// ---------------------------------------------------------------------------
// 11. Iteration Node
// ---------------------------------------------------------------------------

export const IterationNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('iteration'),
    input_list: VariableReferenceSchema,
    iterator_var: z.string(),
    body_nodes: z.array(z.string()).min(1),
  }),
)

export type IterationNode = z.infer<typeof IterationNodeSchema>

// ---------------------------------------------------------------------------
// 12. Human Input Node
// ---------------------------------------------------------------------------

export const HumanInputNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('human_input'),
    prompt: z.string(),
    timeout_seconds: z.number().int().positive().optional(),
    fallback: z.enum(['skip', 'fail']),
  }),
)

export type HumanInputNode = z.infer<typeof HumanInputNodeSchema>

// ---------------------------------------------------------------------------
// 13. Knowledge Retrieval Node
// ---------------------------------------------------------------------------

export const KnowledgeRetrievalNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('knowledge_retrieval'),
    query: VariableReferenceSchema,
    knowledge_base_id: z.string(),
    top_k: z.number().int().positive().optional(),
  }),
)

export type KnowledgeRetrievalNode = z.infer<typeof KnowledgeRetrievalNodeSchema>

// ---------------------------------------------------------------------------
// 14. Sub-Workflow Node
// ---------------------------------------------------------------------------

export const SubWorkflowNodeSchema = NodeBaseSchema.merge(
  z.object({
    type: z.literal('sub_workflow'),
    pipeline_ref: z.object({
      name: z.string(),
      namespace: z.string().optional(),
    }),
    inputs: z.record(VariableReferenceSchema),
  }),
)

export type SubWorkflowNode = z.infer<typeof SubWorkflowNodeSchema>

// ---------------------------------------------------------------------------
// Discriminated Union of all 14 node types
// ---------------------------------------------------------------------------

export const NodeSchema = z.discriminatedUnion('type', [
  StartNodeSchema,
  EndNodeSchema,
  LLMNodeSchema,
  AgentPodNodeSchema,
  CodeNodeSchema,
  HTTPNodeSchema,
  IfElseNodeSchema,
  TemplateNodeSchema,
  VariableAssignerNodeSchema,
  VariableAggregatorNodeSchema,
  IterationNodeSchema,
  HumanInputNodeSchema,
  KnowledgeRetrievalNodeSchema,
  SubWorkflowNodeSchema,
])

export type PipelineNode = z.infer<typeof NodeSchema>

// ---------------------------------------------------------------------------
// Pipeline Edge Schema
// ---------------------------------------------------------------------------

export const PipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  source_handle: z.string().optional(),
  target_handle: z.string().optional(),
  label: z.string().optional(),
  condition_branch: z.string().optional(),
})

export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>
