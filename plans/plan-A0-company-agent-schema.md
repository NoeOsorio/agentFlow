# Plan A0: Company & Agent Resource Schema

## Overview
Define `Company` and `Agent` as first-class Kubernetes-inspired YAML resources (`apiVersion/kind/metadata/spec`). This is the **absolute foundation** of AgentFlow: a company is a collection of agents with roles, budgets, models, and heartbeat configs — analogous to a Kubernetes Deployment defining pods. Pipelines reference companies to borrow their agents. This plan establishes the resource model that every other plan builds on.

## Tech Context
- **Primary package:** `packages/core/`
- **New files:** `packages/core/src/schema/resource.ts`, `packages/core/src/schema/company.ts`
- **Updated files:** `packages/core/src/index.ts`
- **Tech:** TypeScript 5.7, Zod 3.24, tsup 8.3

---

## Goals
- Establish `apiVersion/kind/metadata/spec` as the universal resource envelope (Kubernetes pattern)
- Define `Company` kind: namespace, agents list, org structure, global budget policy
- Define `Agent` kind: role, persona, model config, monthly budget, heartbeat config, capabilities
- Define `AgentBudget` for runtime cost tracking
- Define `CompanyReference` type for pipelines to reference a company's agents
- Export full TypeScript types for use across the monorepo
- Provide canonical example YAML files: a company with 3 agents and a pipeline using them

---

## Checklist

### Phase 1: Kubernetes-Style Resource Envelope
- [ ] **Create `packages/core/src/schema/resource.ts`**:
  - [ ] `ApiVersionSchema` — `z.enum(["agentflow.ai/v1"])` (extensible for future versions)
  - [ ] `ResourceMetadataSchema`:
    ```typescript
    {
      name: string,           // DNS-label format: lowercase, hyphens, max 63 chars
      namespace?: string,     // default: "default"
      labels?: Record<string, string>,
      annotations?: Record<string, string>,
      created_at?: string,    // ISO 8601, filled by API
      updated_at?: string,
    }
    ```
  - [ ] `BaseResourceSchema<TKind extends string, TSpec>`:
    ```typescript
    {
      apiVersion: ApiVersion,
      kind: TKind,
      metadata: ResourceMetadata,
      spec: TSpec,
    }
    ```
  - [ ] `parseMultiDocumentYAML(yaml: string): BaseResource[]` — splits YAML by `---` and parses each document
  - [ ] `serializeMultiDocumentYAML(resources: BaseResource[]): string` — serializes multiple resources separated by `---`
  - [ ] `getResourceKey(resource: BaseResource): string` — returns `"${kind}/${metadata.namespace}/${metadata.name}"`

### Phase 2: Agent Schema
- [ ] **Create `packages/core/src/schema/agent.ts`**:
  - [ ] `AgentCapabilitySchema` — `z.enum(["coding", "research", "writing", "analysis", "review", "planning", "execution", "management"])` (extensible via `z.string()` for custom capabilities)

  - [ ] `AgentBudgetSchema`:
    ```typescript
    {
      monthly_usd: number,          // hard limit per calendar month
      tokens_limit?: number,        // optional token-count limit
      alert_threshold_pct?: number, // default: 80 — warn when X% consumed
    }
    ```

  - [ ] `HeartbeatConfigSchema`:
    ```typescript
    {
      interval_seconds: number,   // how often agent is expected to check in
      timeout_seconds: number,    // how long before considered unhealthy
      on_timeout: z.enum(["continue", "fail", "retry"]),
    }
    ```

  - [ ] `AgentLifecycleSchema`:
    ```typescript
    {
      on_start?: string,    // webhook URL called when agent starts a task
      on_done?: string,     // webhook URL called on task success
      on_fail?: string,     // webhook URL called on task failure
      heartbeat?: HeartbeatConfigSchema,
    }
    ```

  - [ ] `AgentSpecSchema`:
    ```typescript
    {
      role: string,           // "CEO", "Lead Engineer", "UX Designer"
      persona?: string,       // personality/style injected as system prompt prefix
      model: ModelConfigSchema,
      capabilities?: AgentCapability[],
      budget?: AgentBudgetSchema,
      lifecycle?: AgentLifecycleSchema,
      memory?: {
        enabled: boolean,     // persistent memory across runs
        max_entries?: number,
      },
      reports_to?: string,    // agent name — defines org hierarchy
    }
    ```

  - [ ] `AgentSchema` — `BaseResourceSchema<"Agent", AgentSpecSchema>`
    - Example:
      ```yaml
      apiVersion: agentflow.ai/v1
      kind: Agent
      metadata:
        name: alice
        namespace: acme-corp
        labels:
          department: engineering
      spec:
        role: Lead Engineer
        persona: "Senior Python engineer. Direct and pragmatic. Mentors junior devs."
        model:
          provider: anthropic
          model_id: claude-sonnet-4-6
          temperature: 0.2
        capabilities: [coding, review, planning]
        budget:
          monthly_usd: 100
          alert_threshold_pct: 80
        reports_to: bob
        lifecycle:
          heartbeat:
            interval_seconds: 30
            timeout_seconds: 120
            on_timeout: fail
      ```

### Phase 3: Company Schema
- [ ] **Create `packages/core/src/schema/company.ts`**:
  - [ ] `DepartmentSchema`:
    ```typescript
    {
      name: string,
      description?: string,
      agent_names: string[],    // references to Agent.metadata.name
      parent_department?: string,
    }
    ```

  - [ ] `CompanyPolicySchema`:
    ```typescript
    {
      max_monthly_budget_usd?: number,      // total company budget cap
      default_model?: ModelConfigSchema,    // fallback for agents without model
      require_approval_above_usd?: number,  // tasks above this need human approval
      max_concurrent_runs?: number,         // default: 10
    }
    ```

  - [ ] `CompanySpecSchema`:
    ```typescript
    {
      description?: string,
      agents: AgentSpecSchema[],      // inline agents (alternative to separate Agent resources)
      departments?: DepartmentSchema[],
      policy?: CompanyPolicySchema,
    }
    ```

  - [ ] `CompanySchema` — `BaseResourceSchema<"Company", CompanySpecSchema>`
    - Example:
      ```yaml
      apiVersion: agentflow.ai/v1
      kind: Company
      metadata:
        name: acme-corp
        namespace: default
        labels:
          industry: software
      spec:
        description: "AI-first software company building AgentFlow"
        policy:
          max_monthly_budget_usd: 500
          require_approval_above_usd: 50
        agents:
          - name: bob
            role: CEO
            persona: "Strategic visionary. Prioritizes product-market fit."
            model:
              provider: anthropic
              model_id: claude-opus-4-6
            budget:
              monthly_usd: 150
            capabilities: [planning, management]
            reports_to: null
          - name: alice
            role: Lead Engineer
            persona: "Senior Python engineer. Pragmatic. Quality-focused."
            model:
              provider: anthropic
              model_id: claude-sonnet-4-6
            budget:
              monthly_usd: 100
            capabilities: [coding, review]
            reports_to: bob
          - name: carol
            role: UX Designer
            persona: "User-empathy first. Loves clean interfaces."
            model:
              provider: anthropic
              model_id: claude-sonnet-4-6
            budget:
              monthly_usd: 80
            capabilities: [writing, analysis]
            reports_to: bob
        departments:
          - name: engineering
            agent_names: [alice]
          - name: design
            agent_names: [carol]
      ```

  - [ ] `CompanyReferenceSchema`:
    ```typescript
    {
      name: string,
      namespace?: string,  // default: "default"
    }
    ```

  - [ ] `AgentReferenceSchema`:
    ```typescript
    {
      name: string,           // agent name from Company.spec.agents
      company_ref?: CompanyReferenceSchema,  // optional if inherited from pipeline
    }
    ```

  - [ ] Helper: `resolveAgent(company: Company, agentName: string): AgentSpec | undefined`
  - [ ] Helper: `getOrgTree(company: Company): OrgNode[]` — builds tree from `reports_to` chain
  - [ ] Helper: `getAgentsByCapability(company: Company, capability: AgentCapability): AgentSpec[]`

### Phase 4: Multi-Document YAML Parser
- [ ] **Update `packages/core/src/parser/index.ts`**:
  - [ ] `parseResource(yaml: string): BaseResource` — parses a single YAML document, dispatches to correct schema by `kind`
  - [ ] `parseMultiDocument(yaml: string): BaseResource[]` — handles `---` separated documents
  - [ ] `validateResource(yaml: string): SafeParseResult<BaseResource>` — validates without throwing
  - [ ] `getKind(yaml: string): string | null` — fast extraction of `kind:` field without full parse
  - [ ] Support `kind` dispatch:
    ```typescript
    const schemas: Record<string, ZodSchema> = {
      Company: CompanySchema,
      Agent: AgentSchema,
      Pipeline: PipelineSchema,  // from A1
    }
    ```
  - [ ] `serializeResource(resource: BaseResource): string` — outputs valid YAML with `apiVersion/kind/metadata/spec`
  - [ ] `serializeMultiDocument(resources: BaseResource[]): string` — joins with `---\n`

### Phase 5: TypeScript Exports
- [ ] **Update `packages/core/src/index.ts`**:
  - [ ] Export: `Company`, `CompanySpec`, `CompanyPolicy`, `CompanyReference`
  - [ ] Export: `Agent`, `AgentSpec`, `AgentBudget`, `AgentCapability`, `AgentLifecycle`, `HeartbeatConfig`, `AgentReference`
  - [ ] Export: `Department`, `OrgNode`
  - [ ] Export: `BaseResource`, `ResourceMetadata`, `ApiVersion`
  - [ ] Export: `parseResource`, `parseMultiDocument`, `validateResource`, `serializeResource`, `serializeMultiDocument`, `getKind`
  - [ ] Export: `resolveAgent`, `getOrgTree`, `getAgentsByCapability`

### Phase 6: Tests
- [ ] **Create `packages/core/src/__tests__/company.test.ts`**:
  - [ ] Parses Company YAML with 3 agents — all fields correctly typed
  - [ ] Validates required fields (`metadata.name`, `spec.agents` not empty)
  - [ ] Rejects Company with negative `budget.monthly_usd`
  - [ ] `resolveAgent("alice")` returns correct agent spec
  - [ ] `getOrgTree()` builds correct tree: CEO at root, alice and carol as children
  - [ ] `getAgentsByCapability(company, "coding")` returns only agents with that capability
  - [ ] Round-trip: serialize then parse gives identical object

- [ ] **Create `packages/core/src/__tests__/resource.test.ts`**:
  - [ ] `parseMultiDocument()` splits 3-document YAML correctly
  - [ ] `getKind()` returns correct kind from YAML string
  - [ ] `getResourceKey()` returns `"Company/default/acme-corp"`
  - [ ] `serializeMultiDocument([company, pipeline])` outputs valid YAML with `---` separator

### Phase 7: Example YAML Files
- [ ] **Create `packages/core/examples/acme-company.yaml`** — Full company with CEO, Lead Engineer, Designer
- [ ] **Create `packages/core/examples/standalone-agent.yaml`** — Single Agent resource
- [ ] **Create `packages/core/examples/minimal-company.yaml`** — Simplest valid Company (1 agent, no departments)
- [ ] **Create `packages/core/examples/full-manifest.yaml`** — Multi-document: Company + Pipeline in one file

---

## Acceptance Criteria
- `pnpm --filter @agentflow/core build` compiles with zero type errors
- All tests pass: `pnpm --filter @agentflow/core test`
- `parseMultiDocument(yaml)` correctly dispatches Company and Agent kinds
- `resolveAgent(company, "alice")` returns correct spec
- Round-trip parse → serialize → parse produces identical output
- Example YAML files all pass `validateResource()` without errors

---

## Deliverable

Upon completion of Plan A0, you will have:

**1. TypeScript Schema Package Extension** (`@agentflow/core`):
- `CompanySchema` and `AgentSchema` with Zod validation and TypeScript inference
- Kubernetes-style resource envelope (`apiVersion/kind/metadata/spec`) for all resources
- Multi-document YAML parser for files containing multiple resources
- Utility functions: `resolveAgent`, `getOrgTree`, `getAgentsByCapability`

**2. Canonical YAML Format** — developers know exactly how to write a Company:
```yaml
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
spec:
  agents:
    - name: alice
      role: Lead Engineer
      model: { provider: anthropic, model_id: claude-sonnet-4-6 }
      budget: { monthly_usd: 100 }
```

**3. Example Files** (`packages/core/examples/`):
- `acme-company.yaml` — reference company with 3 agents
- `full-manifest.yaml` — multi-document: Company + Pipeline
- `standalone-agent.yaml` — standalone Agent resource

**4. Foundation for All Other Plans**:
- A1 extends Pipeline to reference `company_ref`
- A2 loads agent identities from Company YAML at runtime
- A3 persists Company/Agent resources in PostgreSQL
- B0 builds the Company Editor UI using these types

---

## Routing

### This plan enables (must complete A0 before starting):
- **[Plan A1](plan-A1-schema-dsl.md)** — Pipeline schema needs `CompanyReference` and `AgentReference` types
- **[Plan A2](plan-A2-runtime-engine.md)** — Runtime needs `Company`, `AgentSpec`, `resolveAgent()` to load agent identities
- **[Plan A3](plan-A3-api-layer.md)** — API needs Company/Agent Zod schemas for persistence and validation
- **[Plan B0](plan-B0-company-editor.md)** — Company Editor UI needs all company types and example YAMLs
- **[Plan B2](plan-B2-node-components.md)** — Node components need `AgentSpec` type for `AgentPodNodeCard`
- **[Plan B3](plan-B3-state-management.md)** — Zustand store needs `Company` type for CompanyStore

### This plan depends on:
- None — A0 is the absolute root of the dependency graph
