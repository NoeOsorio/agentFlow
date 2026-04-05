# Plan A1: Pipeline Schema & DSL Extension

## Overview
Extend the `Pipeline` resource to follow the Kubernetes-style `apiVersion/kind/metadata/spec` envelope established in Plan A0, and add all Dify-inspired node types. A Pipeline references a Company (from A0) to borrow its agents, and defines the execution DAG as `nodes` and `edges`. This plan owns all node-type schemas, variable reference syntax, conditional edge schemas, and canvas positional metadata.

## Tech Context
- **Primary package:** `packages/core/`
- **Key files:**
  - `packages/core/src/schema/pipeline.ts` — update to K8s-wrapped Pipeline
  - `packages/core/src/schema/nodes.ts` — new: all node type schemas
  - `packages/core/src/schema/variable.ts` — new: variable reference system
  - `packages/core/src/schema/conditions.ts` — new: IF/ELSE condition schemas
  - `packages/core/src/schema/canvas.ts` — new: positional metadata
  - `packages/core/src/parser/index.ts` — update parser
- **Tech:** TypeScript 5.7, Zod 3.24, js-yaml 4.1, tsup 8.3
- **Prerequisite types from A0:** `BaseResourceSchema`, `CompanyReferenceSchema`, `AgentReferenceSchema`, `ModelConfigSchema`

---

## Goals
- Wrap `Pipeline` in the `apiVersion/kind/metadata/spec` resource envelope
- Add `company_ref` to Pipeline: agents come from the referenced Company
- Define all 14 node types as Zod schemas with TypeScript inference
- Define variable reference syntax `{{#node_id.variable.path#}}` for inter-node data passing
- Define conditional edge schemas for IF/ELSE routing
- Embed canvas positional metadata inside the YAML spec (for persistence)
- Maintain backward compatibility with existing `PipelineSchema`

---

## Checklist

### Phase 0: Pipeline Resource Wrapper
- [ ] **Update `packages/core/src/schema/pipeline.ts`**:
  - [ ] Wrap top-level `PipelineSchema` in `BaseResourceSchema<"Pipeline", PipelineSpecSchema>`:
    ```yaml
    # Canonical Pipeline YAML:
    apiVersion: agentflow.ai/v1
    kind: Pipeline
    metadata:
      name: ship-feature
      namespace: default
      labels:
        team: engineering
    spec:
      company_ref:
        name: acme-corp
        namespace: default
      trigger:
        type: webhook
        source: github
      nodes:
        - id: plan
          type: agent_pod
          agent_ref: { name: alice }
          ...
      edges:
        - source: plan
          target: implement
    ```
  - [ ] `PipelineSpecSchema`:
    ```typescript
    {
      company_ref?: CompanyReference,  // agents come from here
      trigger?: TriggerConfig,
      nodes: PipelineNode[],
      edges: PipelineEdge[],
      variables?: VariableDefinition[],  // pipeline-level input variables
      policy?: PolicyConfig,
      canvas_meta?: CanvasMeta,
    }
    ```
  - [ ] Backward compat: preserve existing `PipelineSchema` as deprecated alias (add `@deprecated` JSDoc)

### Phase 1: Node Type Schema Definitions
- [ ] **Create `packages/core/src/schema/nodes.ts`** — define all node schemas:
  - [ ] `StartNodeSchema` — `{ type: "start", outputs: VariableDefinition[] }` — must exist exactly once per pipeline
  - [ ] `EndNodeSchema` — `{ type: "end", inputs: VariableReference[] }`
  - [ ] `LLMNodeSchema` — `{ type: "llm", model: ModelConfig, prompt: PromptSchema, output_schema?: JsonSchema, agent_ref?: AgentReference }`
    - Note: if `agent_ref` is provided, model and persona are loaded from the referenced agent
  - [ ] `AgentPodNodeSchema`:
    ```typescript
    {
      type: "agent_pod",
      agent_ref: AgentReference,      // references agent from Company
      instruction: string,            // task instruction (supports {{#...#}} refs)
      inputs?: Record<string, VariableReference>,
      resource?: ResourceConfig,
    }
    ```
  - [ ] `CodeNodeSchema` — `{ type: "code", language: "python"|"javascript", code: string, inputs: VariableReference[], outputs: VariableDefinition[], timeout_seconds?: number }`
  - [ ] `HTTPNodeSchema` — `{ type: "http", method: "GET"|"POST"|"PUT"|"DELETE"|"PATCH", url: string, headers?: Record<string,string>, body?: string|object, timeout_ms?: number }`
  - [ ] `IfElseNodeSchema` — `{ type: "if_else", conditions: ConditionGroup[], default_branch: string }`
  - [ ] `TemplateNodeSchema` — `{ type: "template", template: string, inputs: VariableReference[] }`
  - [ ] `VariableAssignerNodeSchema` — `{ type: "variable_assigner", assignments: { key: string, value: VariableReference | LiteralValue }[] }`
  - [ ] `VariableAggregatorNodeSchema` — `{ type: "variable_aggregator", branches: string[], output_key: string, strategy: "first"|"merge"|"list" }`
  - [ ] `IterationNodeSchema` — `{ type: "iteration", input_list: VariableReference, iterator_var: string, body_nodes: string[] }`
  - [ ] `HumanInputNodeSchema` — `{ type: "human_input", prompt: string, timeout_seconds?: number, fallback: "skip"|"fail" }`
  - [ ] `KnowledgeRetrievalNodeSchema` — `{ type: "knowledge_retrieval", query: VariableReference, knowledge_base_id: string, top_k?: number }`
  - [ ] `SubWorkflowNodeSchema` — `{ type: "sub_workflow", pipeline_ref: { name: string, namespace?: string }, inputs: Record<string, VariableReference> }`

  - [ ] `NodeSchema` — discriminated union:
    ```typescript
    z.discriminatedUnion("type", [
      StartNodeSchema, EndNodeSchema, LLMNodeSchema, AgentPodNodeSchema,
      CodeNodeSchema, HTTPNodeSchema, IfElseNodeSchema, TemplateNodeSchema,
      VariableAssignerNodeSchema, VariableAggregatorNodeSchema, IterationNodeSchema,
      HumanInputNodeSchema, KnowledgeRetrievalNodeSchema, SubWorkflowNodeSchema,
    ])
    ```
  - [ ] Add `id: string` (node ID, unique within pipeline) and `label?: string` to each node via intersection

### Phase 2: Variable Reference System
- [ ] **Create `packages/core/src/schema/variable.ts`**:
  - [ ] `VariableTypeSchema` — `z.enum(["string","number","boolean","object","array","file"])`
  - [ ] `VariableDefinitionSchema` — `{ key: string, type: VariableType, description?: string, required?: boolean, default?: unknown }`
  - [ ] `VariableReferenceSchema` — `{ node_id: string, variable: string, path?: string[] }`
  - [ ] `LiteralValueSchema` — `{ literal: string | number | boolean | null }`
  - [ ] `parseVariableRef(str: string): VariableReference` — parses `{{#node_id.variable.path#}}`
  - [ ] `serializeVariableRef(ref: VariableReference): string` — `{{#node_id.variable.path#}}`
  - [ ] `resolveVariableRefs(obj: unknown): unknown` — walks any object and converts `{{#...#}}` strings to `VariableReference` objects

### Phase 3: Condition Schemas
- [ ] **Create `packages/core/src/schema/conditions.ts`**:
  - [ ] `ConditionOperatorSchema` — `z.enum(["eq","ne","gt","gte","lt","lte","contains","not_contains","starts_with","ends_with","is_empty","is_not_empty"])`
  - [ ] `ConditionSchema` — `{ left: VariableReference, operator: ConditionOperator, right?: VariableReference | LiteralValue, branch_id: string }`
  - [ ] `ConditionGroupSchema` — `{ logic: "and"|"or", conditions: Condition[], branch_id: string }`

### Phase 4: Canvas Metadata Schema
- [ ] **Create `packages/core/src/schema/canvas.ts`**:
  - [ ] `NodePositionSchema` — `{ x: number, y: number }`
  - [ ] `ViewportSchema` — `{ x: number, y: number, zoom: number }`
  - [ ] `CanvasMetaSchema` — `{ viewport: Viewport, node_positions: Record<string, NodePosition> }`

### Phase 5: Edge Schema
- [ ] **Create `PipelineEdgeSchema`** in `nodes.ts`:
  - [ ] `{ id: string, source: string, target: string, source_handle?: string, target_handle?: string, label?: string, condition_branch?: string }`
  - [ ] Conditional edge: `source_handle = "branch_true"` or a branch ID

### Phase 6: Prompt & Model Schema
- [ ] **Create `packages/core/src/schema/model.ts`**:
  - [ ] `ModelProviderSchema` — `z.enum(["anthropic","openai","google","mistral","local"])`
  - [ ] `ModelConfigSchema` — `{ provider: ModelProvider, model_id: string, temperature?: number, max_tokens?: number, top_p?: number, system_prompt?: string }`
  - [ ] `PromptSchema` — `{ system?: string, user: string }` (both support `{{#...#}}` interpolation)

### Phase 7: Update Parser
- [ ] **Update `packages/core/src/parser/index.ts`**:
  - [ ] `parsePipeline(yamlString: string): Pipeline` — parses and validates Pipeline resource
  - [ ] `serializePipeline(pipeline: Pipeline): string` — serializes to YAML with `apiVersion/kind/metadata/spec`
  - [ ] `validatePipeline(yamlString: string): SafeParseResult<Pipeline>` — safe parse
  - [ ] `resolveVariableRefs(pipeline: Pipeline): Pipeline` — walk all node fields and parse `{{#...#}}` strings
  - [ ] `compileEdges(pipeline: Pipeline): CompiledGraph` — builds adjacency map:
    ```typescript
    type CompiledGraph = {
      nodes: Record<string, { node: PipelineNode, dependsOn: string[], provides: string[] }>,
      entryPoints: string[],  // nodes with no dependsOn
      exitPoints: string[],   // nodes with no outgoing edges
    }
    ```
  - [ ] Re-export `parseResource`, `parseMultiDocument` from A0 parser

### Phase 8: TypeScript Exports
- [ ] **Update `packages/core/src/index.ts`**:
  - [ ] All A0 types (re-exported)
  - [ ] `Pipeline`, `PipelineSpec`, `PipelineNode`, `PipelineEdge`, `CanvasMeta`, `Viewport`, `NodePosition`
  - [ ] `NodeType` (discriminated union), individual node types: `LLMNode`, `AgentPodNode`, `CodeNode`, `HTTPNode`, `IfElseNode`, etc.
  - [ ] `VariableDefinition`, `VariableReference`, `VariableType`, `LiteralValue`
  - [ ] `ConditionOperator`, `Condition`, `ConditionGroup`
  - [ ] `ModelConfig`, `ModelProvider`, `Prompt`
  - [ ] `CompiledGraph`
  - [ ] Parser functions: `parsePipeline`, `serializePipeline`, `validatePipeline`, `resolveVariableRefs`, `compileEdges`
  - [ ] Variable utilities: `parseVariableRef`, `serializeVariableRef`

### Phase 9: Tests
- [ ] **`packages/core/src/__tests__/pipeline.test.ts`**:
  - [ ] Parses Pipeline YAML with `apiVersion/kind/metadata/spec` envelope
  - [ ] Validates `company_ref` field
  - [ ] Round-trip: serialize → parse → serialize produces identical YAML
  - [ ] `compileEdges` produces correct DAG adjacency for 3-node pipeline
  - [ ] `compileEdges` detects cycle and throws `CyclicDependencyError`
  - [ ] `resolveVariableRefs` converts `{{#llm_1.output.text#}}` to `{ node_id: "llm_1", variable: "output", path: ["text"] }`
- [ ] **`packages/core/src/__tests__/nodes.test.ts`**:
  - [ ] Each node type validates correctly (happy path)
  - [ ] `AgentPodNodeSchema` requires `agent_ref`
  - [ ] `IfElseNodeSchema` requires at least one condition group
  - [ ] Discriminated union rejects unknown `type`
- [ ] **`packages/core/src/__tests__/variables.test.ts`**:
  - [ ] `parseVariableRef("{{#llm_1.output.text#}}")` → correct object
  - [ ] Round-trip parseVariableRef ↔ serializeVariableRef

### Phase 10: Example YAML Files (Pipeline)
- [ ] **`packages/core/examples/simple-pipeline.yaml`** — Start → LLM → End
- [ ] **`packages/core/examples/agent-pipeline.yaml`** — Pipeline with `company_ref` and 2 AgentPod nodes
- [ ] **`packages/core/examples/branching-pipeline.yaml`** — IF/ELSE with two branches
- [ ] **`packages/core/examples/parallel-pipeline.yaml`** — 3 parallel LLM nodes → VariableAggregator
- [ ] **`packages/core/examples/full-manifest.yaml`** — Multi-document: Company (from A0) + Pipeline in one file

---

## Acceptance Criteria
- `pnpm --filter @agentflow/core build` passes with zero type errors
- All tests pass
- Pipeline YAML with `apiVersion/kind/metadata/spec` envelope parses correctly
- `AgentPodNodeSchema` requires `agent_ref: { name: string }` (not just a string)
- Round-trip parse → serialize → parse produces identical output
- `compileEdges` correctly identifies parallel branches in a DAG
- Example `agent-pipeline.yaml` uses `company_ref` and `agent_ref` correctly

---

## Deliverable

Upon completion of Plan A1, you will have:

**1. Fully-Typed Pipeline Schema** (`@agentflow/core`):
- Pipeline as a Kubernetes-style resource with `apiVersion/kind/metadata/spec`
- 14 node types as Zod schemas with TypeScript inference
- `AgentPodNode` references agents by name from a linked Company
- Variable reference syntax parsed and serialized

**2. Canonical Pipeline YAML format**:
```yaml
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: feature-development
  namespace: default
spec:
  company_ref: { name: acme-corp }
  nodes:
    - id: start
      type: start
      outputs: [{ key: feature_description, type: string }]
    - id: plan
      type: agent_pod
      agent_ref: { name: alice }
      instruction: "Plan the implementation for: {{#start.feature_description#}}"
    - id: implement
      type: agent_pod
      agent_ref: { name: alice }
      instruction: "Implement the plan: {{#plan.output#}}"
      dependsOn: [plan]
  edges:
    - { source: start, target: plan }
    - { source: plan, target: implement }
```

**3. Parser Utilities**:
- `parsePipeline`, `serializePipeline`, `validatePipeline`
- `resolveVariableRefs`, `compileEdges`
- `parseVariableRef`, `serializeVariableRef`

**4. Example Files** (`packages/core/examples/`):
- 5 example Pipeline YAMLs covering all major use cases

---

## Routing

### This plan enables (must complete A1 before starting):
- **[Plan A2](plan-A2-runtime-engine.md)** — runtime uses `compileEdges()`, node type schemas, and `VariableReference` to build and execute the LangGraph DAG
- **[Plan A4](plan-A4-node-implementations.md)** — each node executor requires the typed node schemas
- **[Plan B2](plan-B2-node-components.md)** — frontend node components use TypeScript types for props
- **[Plan B3](plan-B3-state-management.md)** — Zustand store uses `Pipeline`, `PipelineNode`, `PipelineEdge`, `CanvasMeta` types

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — requires `BaseResourceSchema`, `CompanyReference`, `AgentReference`, `ModelConfig` types
