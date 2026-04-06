# Getting Started with AgentFlow Schemas

Welcome to AgentFlow! This guide will walk you through defining your AI agents and companies using simple YAML files. No coding required to get started.

---

## How It Works

AgentFlow uses YAML files to describe **who** your AI agents are and **how** they work together. Think of it like writing a job description, but for AI workers.

Every YAML file follows this basic shape:

```yaml
apiVersion: agentflow.ai/v1   # Always this value
kind: Company                   # What you're defining (Company or Agent)
metadata:
  name: my-company              # A unique name (lowercase, hyphens ok)
spec:
  # ... the details go here
```

That's it. Four top-level fields. Let's build something.

---

## Your First Company (5 minutes)

The simplest possible company has just one agent:

```yaml
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: my-startup
spec:
  agents:
    - name: alex
      role: Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
```

Save this as `my-startup.yaml` and you're done. You have a company called `my-startup` with one agent named `alex` who works as an Engineer using Claude Sonnet.

### What's required?

For a company, you only need:
- `metadata.name` -- your company's identifier
- `spec.agents` -- at least one agent with a `name`, `role`, and `model`

Everything else is optional.

---

## Adding More Agents

Let's grow the team. Each agent gets their own entry under `agents`:

```yaml
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: my-startup
spec:
  description: "A small AI-powered dev shop"
  agents:
    - name: alex
      role: Lead Engineer
      persona: "Senior developer. Pragmatic and quality-focused."
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
        temperature: 0.2
      capabilities: [coding, review, planning]
      reports_to: null              # Top of the chain

    - name: jamie
      role: Junior Developer
      persona: "Eager learner. Asks good questions."
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      capabilities: [coding]
      reports_to: alex              # Reports to Alex

    - name: sam
      role: Content Writer
      persona: "Clear communicator. Loves simplicity."
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      capabilities: [writing, research]
      reports_to: alex
```

### New fields explained

| Field | What it does | Required? |
|-------|-------------|-----------|
| `persona` | A short description of the agent's personality and style | No |
| `capabilities` | What the agent can do (see list below) | No |
| `reports_to` | Name of the agent's manager (creates an org chart) | No |
| `temperature` | How creative the model is (0 = focused, 2 = wild) | No |

### Available capabilities

Use any of these built-in capabilities, or add your own custom ones:

| Capability | Best for |
|-----------|----------|
| `coding` | Writing and modifying code |
| `research` | Gathering and synthesizing information |
| `writing` | Creating content, docs, copy |
| `analysis` | Reviewing data, spotting patterns |
| `review` | Code review, quality checks |
| `planning` | Strategy, architecture, roadmaps |
| `execution` | Running tasks, automation |
| `management` | Coordinating other agents |

You can also use any custom string like `"design"` or `"customer-support"`.

---

## Setting Budgets

Control how much each agent can spend:

```yaml
    - name: alex
      role: Lead Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      budget:
        monthly_usd: 100            # Max $100/month
        tokens_limit: 5000000       # Optional: cap total tokens
        alert_threshold_pct: 80     # Alert at 80% usage (default)
```

---

## Organizing into Departments

Group your agents into teams:

```yaml
spec:
  agents:
    - name: alex
      role: Lead Engineer
      # ...
    - name: jamie
      role: Junior Developer
      # ...
    - name: sam
      role: Content Writer
      # ...

  departments:
    - name: engineering
      description: "Builds and maintains the product"
      agent_names: [alex, jamie]

    - name: content
      description: "Creates user-facing content"
      agent_names: [sam]
```

Departments are just labels for grouping -- they don't affect how agents run, but they help you organize larger teams.

---

## Setting Company-Wide Policies

Add guardrails that apply to the whole company:

```yaml
spec:
  policy:
    max_monthly_budget_usd: 500       # Total spend cap
    require_approval_above_usd: 50    # Flag expensive runs
    max_concurrent_runs: 10           # How many pipelines at once

  agents:
    # ...
```

---

## Adding Lifecycle Hooks

Want to know when an agent starts, finishes, or fails? Add webhooks:

```yaml
    - name: alex
      role: Lead Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      lifecycle:
        on_start: https://hooks.example.com/started
        on_done: https://hooks.example.com/done
        on_fail: https://hooks.example.com/failed
        heartbeat:
          interval_seconds: 30       # Ping every 30s
          timeout_seconds: 120       # Fail if no response in 2min
          on_timeout: fail           # What to do: continue, fail, or retry
```

---

## Standalone Agents

Sometimes you want to define an agent on its own, outside of a company. Use `kind: Agent`:

```yaml
apiVersion: agentflow.ai/v1
kind: Agent
metadata:
  name: alex
  namespace: my-startup
  labels:
    department: engineering
spec:
  role: Lead Engineer
  persona: "Senior developer. Pragmatic and quality-focused."
  model:
    provider: anthropic
    model_id: claude-sonnet-4-6
    temperature: 0.2
  capabilities: [coding, review, planning]
  budget:
    monthly_usd: 100
    alert_threshold_pct: 80
  reports_to: bob
  memory:
    enabled: true
    max_entries: 1000
```

### When to use standalone agents?

- **Inside a Company** (`kind: Company` with inline agents) -- when agents work together as a team
- **Standalone** (`kind: Agent`) -- when you want to reuse an agent across companies or manage it independently

---

## Enabling Agent Memory

Let agents remember context across runs:

```yaml
      memory:
        enabled: true
        max_entries: 1000    # Optional: cap stored memories
```

---

## Naming Rules

Names must follow DNS label format:
- Lowercase letters, numbers, and hyphens only
- Must start with a letter
- Max 63 characters
- Examples: `my-company`, `alex`, `lead-eng-v2`

---

## Full Example

Here's a complete, production-ready company definition:

```yaml
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
  namespace: default
  labels:
    industry: software
spec:
  description: "AI-first software company"
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
        temperature: 0.2
      budget:
        monthly_usd: 100
        alert_threshold_pct: 80
      capabilities: [coding, review, planning]
      reports_to: bob
      lifecycle:
        heartbeat:
          interval_seconds: 30
          timeout_seconds: 120
          on_timeout: fail

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

---

## Quick Reference

| What you want | Where to put it |
|--------------|----------------|
| Define a team of agents | `kind: Company` with agents in `spec.agents` |
| Define a single reusable agent | `kind: Agent` with config in `spec` |
| Set spending limits | `spec.agents[].budget` or `spec.policy` |
| Group agents into teams | `spec.departments` |
| Create a reporting chain | `spec.agents[].reports_to` |
| Get notified on events | `spec.agents[].lifecycle` |
| Let agents remember things | `spec.agents[].memory` |

---

## Next Steps

1. Create your first company YAML file
2. Add it to the `packages/core/examples/` directory
3. Run the pipeline parser to validate it
4. Build a pipeline that uses your agents (see Pipeline docs)

Happy building!
