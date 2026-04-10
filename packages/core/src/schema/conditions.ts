import { z } from 'zod'
import { VariableReferenceSchema, LiteralValueSchema } from './variable'

// ---------------------------------------------------------------------------
// Condition Operators
// ---------------------------------------------------------------------------

export const ConditionOperatorSchema = z.enum([
  'eq',
  'ne',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
])

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>

// ---------------------------------------------------------------------------
// Single Condition
// ---------------------------------------------------------------------------

export const ConditionSchema = z.object({
  left: VariableReferenceSchema,
  operator: ConditionOperatorSchema,
  right: z.union([VariableReferenceSchema, LiteralValueSchema]).optional(),
  branch_id: z.string(),
})

export type Condition = z.infer<typeof ConditionSchema>

// ---------------------------------------------------------------------------
// Condition Group (AND/OR of multiple conditions → one branch)
// ---------------------------------------------------------------------------

export const ConditionGroupSchema = z.object({
  logic: z.enum(['and', 'or']),
  conditions: z.array(ConditionSchema).min(1),
  branch_id: z.string(),
})

export type ConditionGroup = z.infer<typeof ConditionGroupSchema>
