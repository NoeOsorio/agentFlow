# B2-PR-4: Form widgets + config forms + package exports

**Commit:** `feat(ui/forms): widgets compartidos, config forms y exports del paquete [B2-PR-4]`
**Rama:** `feat/B2-PR-4-forms-and-exports`

---

## Qué resuelve

Completa el paquete `@agentflow/ui` con los 6 widgets de formulario compartidos, los 13 config forms por tipo de nodo, y los exports públicos `nodeTypes` y `nodeConfigForms` que el canvas consuma directamente.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `packages/ui/src/forms/widgets/VariableReferencePicker.tsx` | upstream variables, node outputs, literal toggle |
| Crear | `packages/ui/src/forms/widgets/ModelSelector.tsx` | provider dropdown, model filter, temperature slider |
| Crear | `packages/ui/src/forms/widgets/PromptEditor.tsx` | system/user tabs, variable syntax highlighting |
| Crear | `packages/ui/src/forms/widgets/ConditionBuilder.tsx` | condition rows, AND/OR, branches |
| Crear | `packages/ui/src/forms/widgets/CodeEditor.tsx` | Monaco, vs-dark, Python/JS |
| Crear | `packages/ui/src/forms/AgentPodForm.tsx` | AgentSelector, instruction, inputs table |
| Crear | `packages/ui/src/forms/LLMNodeForm.tsx` | ModelSelector, PromptEditor |
| Crear | `packages/ui/src/forms/CodeNodeForm.tsx` | language selector, CodeEditor |
| Crear | `packages/ui/src/forms/HTTPNodeForm.tsx` | method, URL, headers, body |
| Crear | `packages/ui/src/forms/IfElseNodeForm.tsx` | ConditionBuilder, default branch |
| Crear | `packages/ui/src/forms/TemplateNodeForm.tsx` | PromptEditor, input bindings |
| Crear | `packages/ui/src/forms/VariableAssignerForm.tsx` | assignments table |
| Crear | `packages/ui/src/forms/VariableAggregatorForm.tsx` | branches, strategy selector |
| Crear | `packages/ui/src/forms/IterationNodeForm.tsx` | input_list picker, iterator var |
| Crear | `packages/ui/src/forms/HumanInputForm.tsx` | prompt, timeout, fallback |
| Crear | `packages/ui/src/forms/StartNodeForm.tsx` | variable definitions |
| Crear | `packages/ui/src/forms/SubWorkflowForm.tsx` | pipeline selector, inputs |
| Actualizar | `packages/ui/src/index.ts` | re-exports públicos, nodeTypes, nodeConfigForms |
| Crear | `packages/ui/src/nodeTypes.ts` | React Flow nodeTypes map |
| Crear | `packages/ui/src/nodeConfigForms.ts` | ConfigPanel form map |

## Símbolos exportados

- **Widgets:** `VariableReferencePicker`, `ModelSelector`, `PromptEditor`, `ConditionBuilder`, `CodeEditor`, `AgentSelector` (re-export de B2-PR-2)
- **Forms:** `AgentPodForm`, `LLMNodeForm`, `CodeNodeForm`, `HTTPNodeForm`, `IfElseNodeForm`, `TemplateNodeForm`, `VariableAssignerForm`, `VariableAggregatorForm`, `IterationNodeForm`, `HumanInputForm`, `StartNodeForm`, `SubWorkflowForm`
- **Maps:** `nodeTypes: Record<string, ComponentType>`, `nodeConfigForms: Record<string, ComponentType>`

## Dependencias

- **Depende de:** B2-PR-2 (`AgentSelector`, `AgentPodNodeCard`), B2-PR-3 (todos los node cards), `@monaco-editor/react`, `react-hook-form`
- **Requerido por:** B1-PR-1 (`nodeTypes` plugged into React Flow), B1-PR-3 (`nodeConfigForms` usado en `ConfigPanel`)

## Warnings

- Instalar dependencias antes de implementar: `pnpm --filter @agentflow/ui add @monaco-editor/react monaco-editor react-hook-form`
- `ConditionBuilder` debe soportar los 12 operadores definidos en A1 `ConditionOperator` enum
- `VariableReferencePicker` depende del hook `useVariableScope` de B3 — usar prop drilling (la lista de variables se pasa como prop, no se llama el hook directamente desde `@agentflow/ui`)

## Tests

**`packages/ui/src/__tests__/forms.test.tsx`**
- [ ] `ConditionBuilder` con 3 condiciones renderiza 3 filas y botón "Add condition"
- [ ] `PromptEditor` resalta `{{#node_id.variable#}}` con clase de color especial
- [ ] `AgentPodForm` muestra `AgentSelector` como primer campo
- [ ] `AgentPodForm` panel read-only muestra role, persona, model del agentSpec
- [ ] `ModelSelector` filtrado a provider "anthropic" solo muestra modelos de Anthropic
- [ ] `nodeTypes` contiene exactamente 14 entradas (una por tipo de nodo)

## Definition of Done

- [ ] `pnpm --filter @agentflow/ui build` sin errores de tipo
- [ ] Tests pasan
- [ ] `nodeTypes` y `nodeConfigForms` exportados desde `packages/ui/src/index.ts`
- [ ] `VariableReferencePicker` acepta `availableVariables: AvailableVariable[]` como prop (no importa store)
- [ ] Cada archivo tiene header comment con `@plan B2-PR-4`
