import yaml from 'js-yaml'
import { PipelineSchema } from '../schema/pipeline'
import type { Pipeline } from '../schema/pipeline'

/**
 * Parse a YAML string into a validated Pipeline AST.
 * Throws a ZodError if the YAML doesn't match the schema.
 */
export function parseYAML(yamlString: string): Pipeline {
  const raw = yaml.load(yamlString)
  return PipelineSchema.parse(raw)
}

/**
 * Serialize a Pipeline AST back to a YAML string.
 */
export function serializeAST(pipeline: Pipeline): string {
  return yaml.dump(pipeline, { indent: 2, lineWidth: 120 })
}

/**
 * Validate a YAML string without throwing — returns success/error result.
 */
export function validateYAML(yamlString: string): { success: true; data: Pipeline } | { success: false; error: unknown } {
  try {
    const raw = yaml.load(yamlString)
    const result = PipelineSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, error: result.error }
  } catch (e) {
    return { success: false, error: e }
  }
}
