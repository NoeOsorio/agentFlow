// @plan B1-PR-3
// Re-export the nodeConfigForms map from @agentflow/ui for internal canvas use.
// Usage: const Form = nodeConfigForms[node.type]; if (Form) <Form ... />
export { nodeConfigForms } from '@agentflow/ui'
