# Plan B2: Node UI Components

## Overview
Build the visual React components for each pipeline node type and their configuration forms, living in `@agentflow/ui`. The `AgentPodNodeCard` is the centerpiece: it shows the agent's role, persona snippet, remaining budget, and live status — not just a generic "pod name" label. All node cards receive run status from the canvas for animated execution overlays.

## Tech Context
- **Primary package:** `packages/ui/`
- **Key directories:** `packages/ui/src/nodes/`, `packages/ui/src/forms/`
- **Tech:** React 19, TypeScript 5.7, Tailwind CSS 3.4, @xyflow/react (Handle), react-hook-form, @monaco-editor/react
- **Prerequisite types from A0/A1:** `AgentSpec`, `Company`, `LLMNode`, `AgentPodNode`, `CodeNode`, etc.

---

## Goals
- Canvas card component for each of the 14 node types
- `AgentPodNodeCard` shows agent role, persona snippet, budget meter, live status
- Configuration form per node type for the ConfigPanel
- Shared widgets: `VariableReferencePicker`, `ModelSelector`, `PromptEditor`, `ConditionBuilder`, `AgentSelector`, `CodeEditor`
- Run status overlay on every node card (idle / running pulse / completed check / failed X)

---

## Checklist

### Phase 1: Shared Node Card Anatomy
- [ ] **`packages/ui/src/nodes/BaseNodeCard.tsx`**:
  - [ ] Props: `id`, `type`, `label`, `icon`, `accentColor`, `runStatus?: NodeRunStatus`, `selected?: boolean`, `children?: ReactNode`
  - [ ] Width: `240px` fixed, dark theme (`bg-gray-800 border border-gray-700`)
  - [ ] Header: left-color-accent + icon + label + run status indicator (top-right dot)
  - [ ] Run status styles:
    - `idle`: no overlay
    - `running`: `animate-pulse ring-2 ring-yellow-400`, spinning loader
    - `completed`: `ring-2 ring-green-500`, green checkmark `✓`
    - `failed`: `ring-2 ring-red-500`, red `✗`, error tooltip on hover
    - `skipped`: `opacity-50`, dash `—`
  - [ ] Selected: `ring-2 ring-blue-500`

- [ ] **`packages/ui/src/nodes/NodeHandle.tsx`**:
  - [ ] Input handle (left): `type="target"`, black dot white border
  - [ ] Output handle (right): `type="source"`, white dot gray border
  - [ ] Conditional handle: labeled with branch name

- [ ] **`packages/ui/src/nodes/colors.ts`** — node type color map:
  - [ ] `start`/`end` → purple | `llm` → blue | `agent_pod` → indigo | `code` → orange | `http` → green | `if_else` → yellow | `template` → teal | `variable_*` → gray | `iteration` → pink | `human_input` → red | `knowledge_retrieval` → emerald | `sub_workflow` → violet

### Phase 2: AgentPod Node Card (Most Important)
- [ ] **`packages/ui/src/nodes/AgentPodNodeCard.tsx`**:
  ```
  ┌──────────────────────────────────────┐
  │ 👤  alice                   [● run] │  ← agent name + status
  │     Lead Engineer                    │  ← role badge (colored)
  ├──────────────────────────────────────┤
  │ "Senior Python engineer. Direct..."  │  ← persona snippet (60 chars)
  │ ──────────────────────────────────── │
  │ Model: claude-sonnet-4-6             │
  │ ──────────────────────────────────── │
  │ Budget: ████████░░ $80/$100          │  ← bar: green/yellow/red
  └──────────────────────────────────────┘
  ```
  - [ ] Props: `data: AgentPodNode & { agentSpec?: AgentSpec, runStatus?: NodeRunStatus }`
  - [ ] If `agentSpec` provided (resolved from company): show role, persona snippet, budget bar, model
  - [ ] If `agentSpec` missing (agent_ref not set or company not loaded): show "Select agent ▾" placeholder in orange
  - [ ] Budget bar: green ≤ 60%, yellow 60-80%, red > 80%
  - [ ] Input handle (left), output handle (right)

### Phase 3: Control Flow Node Cards
- [ ] **`StartNodeCard.tsx`** — shows output variable chips; no input handle
- [ ] **`EndNodeCard.tsx`** — shows "Pipeline Output"; no output handle
- [ ] **`IfElseNodeCard.tsx`** — shows condition count; multiple labeled output handles per branch
- [ ] **`IterationNodeCard.tsx`** — shows `for {iterator_var} in {input_list}`; shows progress during run `(2/10)`

### Phase 4: AI & Model Node Cards
- [ ] **`LLMNodeCard.tsx`** — shows provider badge + model name + prompt preview (60 chars); token badge after run
- [ ] **`KnowledgeRetrievalNodeCard.tsx`** — shows knowledge base name + top_k

### Phase 5: Data Processing Node Cards
- [ ] **`CodeNodeCard.tsx`** — shows language badge (Python/JS) + first code line
- [ ] **`HTTPNodeCard.tsx`** — shows method badge (color-coded) + URL (30 chars)
- [ ] **`TemplateNodeCard.tsx`** — shows template preview (60 chars)
- [ ] **`VariableAssignerCard.tsx`** — shows variable name chips being set
- [ ] **`VariableAggregatorCard.tsx`** — shows aggregation strategy badge; multiple input handles

### Phase 6: Integration & Human Node Cards
- [ ] **`HumanInputCard.tsx`** — shows prompt preview + `⏱ 5 min`; shows "⏳ Waiting for approval" during run
- [ ] **`SubWorkflowCard.tsx`** — shows referenced pipeline name

### Phase 7: Shared Form Widgets
- [ ] **`packages/ui/src/forms/widgets/AgentSelector.tsx`**:
  - [ ] Props: `value: AgentReference | null`, `onChange`, `availableAgents: AgentSpec[]`
  - [ ] Dropdown showing agents from the linked company
  - [ ] Each item: `[role-color avatar] Alice — Lead Engineer ($80 left)`
  - [ ] "No agent selected" placeholder with warning style
  - [ ] Search/filter by name or role

- [ ] **`packages/ui/src/forms/widgets/VariableReferencePicker.tsx`**:
  - [ ] Dropdown of all upstream node outputs grouped by node
  - [ ] Shows `{{#node_id.variable.path#}}` preview
  - [ ] Toggle: "literal value" mode

- [ ] **`packages/ui/src/forms/widgets/ModelSelector.tsx`**:
  - [ ] Provider dropdown: Anthropic, OpenAI, Google
  - [ ] Model dropdown filtered by provider (with latest models)
  - [ ] Temperature slider, max tokens input

- [ ] **`packages/ui/src/forms/widgets/PromptEditor.tsx`**:
  - [ ] System/User tabs, textarea with `{{#...#}}` syntax highlighting
  - [ ] "Insert Variable" button → opens `VariableReferencePicker` popover

- [ ] **`packages/ui/src/forms/widgets/ConditionBuilder.tsx`**:
  - [ ] Add condition rows: `[left ref] [operator dropdown] [right ref or literal]`
  - [ ] AND/OR toggle, add/remove branches, default branch input

- [ ] **`packages/ui/src/forms/widgets/CodeEditor.tsx`**:
  - [ ] Monaco Editor, `vs-dark` theme, 300px height, Python/JS syntax

### Phase 8: Node Configuration Forms
- [ ] **`AgentPodForm.tsx`**:
  - [ ] **Agent** field: `AgentSelector` widget (most important field)
  - [ ] **Instruction** field: `PromptEditor` (single tab, supports variable refs)
  - [ ] **Inputs** table: key → `VariableReferencePicker` rows (for passing data to agent)
  - [ ] Read-only info panel: "Agent details from company" — shows role, persona, model, budget (non-editable)
  - [ ] Link to company agent: "Edit agent in Company Editor →"

- [ ] **`LLMNodeForm.tsx`** — `ModelSelector` + `PromptEditor` + optional `JSONSchemaEditor`
- [ ] **`CodeNodeForm.tsx`** — language selector + inputs table + `CodeEditor` + outputs list
- [ ] **`HTTPNodeForm.tsx`** — method, URL, headers table, body editor, timeout
- [ ] **`IfElseNodeForm.tsx`** — `ConditionBuilder` + default branch name
- [ ] **`TemplateNodeForm.tsx`** — `PromptEditor` (single tab) + input bindings
- [ ] **`VariableAssignerForm.tsx`** — assignments table: key + `VariableReferencePicker`
- [ ] **`VariableAggregatorForm.tsx`** — branches list + output key + strategy selector
- [ ] **`IterationNodeForm.tsx`** — `VariableReferencePicker` for input_list + iterator var name
- [ ] **`HumanInputForm.tsx`** — prompt textarea + timeout + fallback radio
- [ ] **`StartNodeForm.tsx`** — output variables: add/edit/delete `VariableDefinition` rows
- [ ] **`SubWorkflowForm.tsx`** — pipeline selector + inputs table

### Phase 9: Package Exports & Dependencies
- [ ] **Update `packages/ui/src/index.ts`** — export all node cards, config forms, widgets
- [ ] Export `nodeTypes` map and `nodeConfigForms` map
- [ ] Install: `pnpm --filter @agentflow/ui add @monaco-editor/react monaco-editor react-hook-form`

---

## Acceptance Criteria
- `AgentPodNodeCard` shows agent role + persona + budget bar when `agentSpec` provided
- `AgentPodNodeCard` shows orange "Select agent ▾" when `agentSpec` is null
- `AgentSelector` dropdown shows company agents with budget remaining
- `AgentPodForm` has agent selector as primary field + read-only agent details panel
- Budget bar shows correct colors at 55%, 75%, 90% thresholds
- `ConditionBuilder` supports all 12 operators
- `pnpm --filter @agentflow/ui build` passes with zero TypeScript errors

---

## Deliverable

Upon completion of Plan B2, you will have:

**1. Complete Node Component Library** (`packages/ui/`):
- 14 node card components for React Flow canvas rendering
- 13 config form components for the ConfigPanel side panel
- 7 shared widgets: `AgentSelector`, `VariableReferencePicker`, `ModelSelector`, `PromptEditor`, `ConditionBuilder`, `CodeEditor`, `JSONSchemaEditor`

**2. Agent-Identity-Aware Components**:
> `AgentPodNodeCard` with `agentSpec` from company renders: role badge "Lead Engineer", persona snippet "Senior Python engineer...", model "claude-sonnet-4-6", budget bar at 80% in yellow — all from the Company YAML, zero manual configuration in the pipeline node.

**3. Ready for Canvas Integration**:
- `nodeTypes` export: plug directly into React Flow's `nodeTypes` prop
- `nodeConfigForms` export: plug into `ConfigPanel` for automatic form rendering

---

## Routing

### This plan enables (must complete B2 before starting):
- **[Plan B1](plan-B1-canvas-editor.md)** — canvas imports all node components
- **[Plan B0](plan-B0-company-editor.md)** — `AgentCard` and `BudgetMeter` widgets used in company editor

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — `AgentSpec`, `Company` types for `AgentPodNodeCard` and `AgentSelector` props
- **[Plan A1](plan-A1-schema-dsl.md)** — all node TypeScript types: `LLMNode`, `AgentPodNode`, `CodeNode`, `IfElseNode`, etc.
