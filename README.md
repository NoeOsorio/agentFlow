<div align="center">

# ⚡ AgentFlow

**AI agent pipelines. Declarative. Observable. Autonomous.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![LangGraph](https://img.shields.io/badge/LangGraph-latest-1C3C3C?logo=langchain&logoColor=white)](https://github.com/langchain-ai/langgraph)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

```yaml
pipeline: wellness-website
trigger: stripe.payment.success
agents: [research, copywriter, identity, frontend, qa]
output:
  type: website
  deploy: vercel
  notify: email
```

*That's all you write. AgentFlow handles the rest.*

</div>

---

## What is AgentFlow?

AgentFlow runs multi-agent AI pipelines end-to-end from a single YAML file — no glue code, no babysitting. Define **what** you want. The runtime figures out **how**.

Think Kubernetes, but for intelligent pipelines.

---

## The Problem

Building with AI agents today is chaotic: loose agents nobody monitors, hardcoded prompts, zero cost visibility, and when something breaks — nobody knows where or why.

AgentFlow fixes this with three principles:

| | |
|---|---|
| **Declarative** | Describe the desired state, not the steps. Like k8s. |
| **Observable** | Every agent reports its status, cost, and output. Nothing runs silently. |
| **Autonomous** | Once configured, the pipeline runs itself. You only intervene when something fails — and the system tells you exactly where. |

---

## How It Works

```
Trigger → Orchestrator → AgentPods → Output
```

1. **Trigger** — A Stripe payment, form submission, Linear task, or any webhook fires the pipeline.
2. **Orchestrator** — Reads the YAML, builds a dependency graph (DAG), and executes agents in order — parallelizing everything it can.
3. **AgentPods** — Each agent is an isolated unit with its own prompt, model, token limit, timeout, and output validation.
4. **Output** — The result is assembled, deployed (Vercel, email, social post, etc.), and delivered — without the operator touching anything.

---

## Interfaces

| Level | Interface | Who uses it |
|---|---|---|
| Visual | Drag & drop canvas (GUI) | Operators, no-code |
| Declarative | `agentflow.yaml` | Developers |
| Autonomous | Runtime | Nobody — it runs itself |

All three stay in sync. GUI changes update the YAML. YAML changes update the GUI. **The YAML is always the source of truth.**

---

## Quick Start

**Requirements:** Node.js ≥ 20, pnpm ≥ 9, Python ≥ 3.12, [uv](https://docs.astral.sh/uv/)

```bash
# Clone and install everything
git clone https://github.com/your-org/agentflow
cd agentflow
pnpm install

# Start infrastructure
docker compose up postgres redis -d

# Run database migrations (required on first setup and after pulls)
cd apps/api && uv run alembic upgrade head && cd ../..

# Run the stack
pnpm dev                                              # Frontend (http://localhost:3000)
cd apps/api && uv run uvicorn agentflow_api.main:app --reload --port 8000  # API
```

Full stack via Docker:
```bash
docker compose up
# Web → http://localhost:3000
# API → http://localhost:8000
# Docs → http://localhost:8000/docs
```

## AgentFlow CLI

The kubectl-style **`agentflow`** command is implemented in **`packages/sdk`** and calls the same HTTP API as the web app. The compiled entrypoint is `packages/sdk/dist/cli/index.js`.

**1. Build the SDK** (required once, or after changing the CLI):

```bash
pnpm --filter @agentflow/sdk build
```

**2. Run it from the repo root** using the **`af`** script (recommended):

```bash
pnpm run af -- --help
pnpm run af -- config set-context --url http://localhost:8000
pnpm run af -- get pipelines
pnpm run af -- run <pipeline-name>
```

The `--` separates pnpm arguments from CLI arguments. The wrapper **`packages/sdk/run-cli.cjs`** removes an extra `--` that pnpm injects so Commander parses flags correctly.

**Alternative — SDK package script:**

```bash
pnpm --filter @agentflow/sdk run agentflow -- --help
```

**Alternative — Node only:**

```bash
node packages/sdk/dist/cli/index.js --help
```

**Why not `pnpm exec agentflow`?** In this workspace, `pnpm exec agentflow` usually fails with “command not found” because pnpm does not expose `@agentflow/sdk`’s `bin` on `PATH` for `exec` the way a global install does. The root package is also named `agentflow`, which is easy to confuse with the CLI binary.

**Runs and execution:** `agentflow run` (and **Run** in the canvas) call `POST /api/pipelines/{name}/execute` and create a **pending** run in the database. Status moves to running/completed only after a **runtime worker** is wired up to consume that queue (see `plans/` and `services/runtime/`).

---

## Monorepo Structure

```
apps/web/          Vite + React + Tailwind — canvas GUI
apps/api/          FastAPI — pipeline CRUD and run management
services/runtime/  LangGraph DAG engine and AgentPod base (Python)
packages/core/     YAML schema + Zod parser, shared TS types
packages/ui/       Shared React component library
packages/sdk/      TypeScript SDK + `agentflow` CLI (see [AgentFlow CLI](#agentflow-cli))
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Canvas GUI | React Flow |
| State | Zustand |
| YAML | js-yaml |
| Job queue | BullMQ + Redis |
| Orchestration | LangGraph |
| Deploy | Vercel API |
| Email | Resend |
| LLMs | Anthropic / OpenAI / Groq (per-agent) |

---

## Architecture

For a full architectural breakdown — layer diagrams, AgentPod lifecycle, YAML spec reference, DAG engine internals — see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Contributing

AgentFlow is designed to be extended. Any agent that implements the `AgentPod` interface plugs into the system. Any output that implements `OutputRouter` can receive a pipeline result.

Full interface docs will ship with the first release.

---

<div align="center">

*AgentFlow — build once, run forever.*

</div>
