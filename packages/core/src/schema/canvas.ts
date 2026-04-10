import { z } from 'zod'

// ---------------------------------------------------------------------------
// Node Position (canvas x/y coordinates)
// ---------------------------------------------------------------------------

export const NodePositionSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export type NodePosition = z.infer<typeof NodePositionSchema>

// ---------------------------------------------------------------------------
// Viewport (current canvas view state)
// ---------------------------------------------------------------------------

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
})

export type Viewport = z.infer<typeof ViewportSchema>

// ---------------------------------------------------------------------------
// Canvas Meta (persisted inside the Pipeline YAML spec)
// ---------------------------------------------------------------------------

export const CanvasMetaSchema = z.object({
  viewport: ViewportSchema,
  node_positions: z.record(NodePositionSchema),
})

export type CanvasMeta = z.infer<typeof CanvasMetaSchema>
