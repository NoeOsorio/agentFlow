import { z } from 'zod'

// ---------------------------------------------------------------------------
// Model Provider
// ---------------------------------------------------------------------------

export const ModelProviderSchema = z.enum(['anthropic', 'openai', 'google', 'mistral', 'local'])
export type ModelProvider = z.infer<typeof ModelProviderSchema>

// ---------------------------------------------------------------------------
// Model Config
// ---------------------------------------------------------------------------

export const ModelConfigSchema = z.object({
  provider: ModelProviderSchema,
  model_id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  system_prompt: z.string().optional(),
})

export type ModelConfig = z.infer<typeof ModelConfigSchema>

// ---------------------------------------------------------------------------
// Prompt (supports {{#...#}} interpolation)
// ---------------------------------------------------------------------------

export const PromptSchema = z.object({
  system: z.string().optional(),
  user: z.string(),
})

export type Prompt = z.infer<typeof PromptSchema>
