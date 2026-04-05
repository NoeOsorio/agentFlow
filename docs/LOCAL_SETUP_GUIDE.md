# AgentFlow - Local Development Guide

> Get AgentFlow running on your laptop in under 10 minutes.

---

## What You'll Need

Before starting, make sure you have these installed:

| Tool | Why you need it | How to install (Mac) |
|------|----------------|---------------------|
| **Docker Desktop** | Runs the database and Redis | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Node.js 20+** | Runs the frontend | `brew install node` |
| **pnpm 9+** | Manages JavaScript packages | `npm install -g pnpm@9` |
| **Python 3.12+** | Runs the API and runtime | `brew install python@3.12` |
| **uv** | Manages Python packages (fast!) | `brew install uv` |

To check if you have everything:

```bash
docker --version       # Docker version 24+
node --version         # v20+
pnpm --version         # 9+
python3 --version      # 3.12+
uv --version           # 0.x
```

---

## Step-by-step Setup

### Step 1: Clone the repo

```bash
git clone <your-repo-url>
cd agentflow
```

### Step 2: Install JavaScript dependencies

From the root of the project:

```bash
pnpm install
```

This installs everything for the frontend, the core library, and the SDK.

### Step 3: Start the database and Redis

These are the "backend services" that store your data and manage queues:

```bash
docker compose up postgres redis -d
```

> **What's happening?** This starts two containers in the background:
> - **PostgreSQL** (the database) on port `5432`
> - **Redis** (message queue + cache) on port `6379`

To check they're running:

```bash
docker compose ps
```

You should see both with status "healthy".

### Step 4: Set up the API

```bash
cd apps/api

# Copy the example environment file
cp .env.example .env

# Install Python dependencies
uv sync
```

Now open `.env` in your editor and add your API keys if you have them:

```
ANTHROPIC_API_KEY=sk-ant-...    # For Claude-powered agents
OPENAI_API_KEY=sk-...           # For GPT-powered agents
```

> **Tip:** The API will work without these keys, but agents won't be able to call LLMs.

### Step 5: Start the API

Still inside `apps/api/`:

```bash
uv run uvicorn agentflow_api.main:app --reload --port 8000
```

> **What's happening?** This starts the backend API server. The `--reload` flag means it auto-restarts when you edit code.

Verify it's working: open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser. You should see the API documentation page.

### Step 6: Start the frontend

Open a **new terminal** and go back to the project root:

```bash
# From the project root
pnpm dev
```

> **What's happening?** This starts the Vite dev server with hot-reload. Every time you save a file, the browser updates automatically.

Open [http://localhost:5173](http://localhost:5173) in your browser to see the AgentFlow canvas.

---

## Option B: Run Everything with Docker (one command)

If you don't want to install Node.js, Python, etc., you can run the entire stack in Docker:

```bash
docker compose up --build
```

This starts **everything**:

| Service | URL | What it does |
|---------|-----|-------------|
| Web (frontend) | [http://localhost:3000](http://localhost:3000) | The visual canvas |
| API | [http://localhost:8000](http://localhost:8000) | Backend REST API |
| API Docs | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive API docs |
| Flower | [http://localhost:5555](http://localhost:5555) | Task queue monitor |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Queue & cache |

To stop everything:

```bash
docker compose down
```

To stop and **delete all data** (fresh start):

```bash
docker compose down -v
```

---

## Common Tasks

### Run database migrations

If someone changed the database schema, you need to apply those changes:

```bash
cd apps/api
make migrate
```

### Create a new migration

If YOU changed the database models and need to generate a migration:

```bash
cd apps/api
make migrate-new name="describe_your_change"
```

### Check migration status

```bash
cd apps/api
make migrate-status
```

### Run tests

```bash
# JavaScript tests (from project root)
pnpm test

# Python API tests
cd apps/api
uv run pytest

# Python runtime tests
cd services/runtime
uv run pytest
```

### Run linting

```bash
# JavaScript (from project root)
pnpm lint

# Python (from apps/api or services/runtime)
uv run ruff check .
```

### View logs (Docker mode)

```bash
# All services
docker compose logs -f

# Just the API
docker compose logs -f api

# Just the database
docker compose logs -f postgres
```

---

## Troubleshooting

### "Port already in use"

Something else is using that port. Find and stop it:

```bash
# Find what's using port 8000
lsof -i :8000

# Kill it (replace PID with the number from above)
kill -9 <PID>
```

### Database won't start

```bash
# Reset the database completely
docker compose down -v
docker compose up postgres redis -d
```

### "Module not found" errors (Python)

```bash
cd apps/api
uv sync    # Re-install dependencies
```

### "Module not found" errors (JavaScript)

```bash
# From project root
pnpm install    # Re-install dependencies
```

### Docker is slow / taking too much memory

In Docker Desktop, go to **Settings > Resources** and make sure you have at least **4 GB of RAM** allocated.

---

## Architecture at a Glance

```
You (browser)
    |
    v
[Frontend :5173]  ------>  [API :8000]  ------>  [PostgreSQL :5432]
                               |
                               v
                        [Redis :6379]
                               |
                    +----------+----------+
                    |          |          |
              [Worker]  [Beat]    [Runtime]
              (runs      (scheduled  (executes
               tasks)     tasks)     agent DAGs)
```

- **Frontend**: What you see in the browser (the canvas where you design pipelines)
- **API**: Receives requests, stores pipelines in the database
- **Redis**: Acts as a message broker ("hey worker, there's a new job")
- **Worker**: Picks up jobs from Redis and processes them
- **Beat**: Like a cron job - triggers scheduled pipelines
- **Runtime**: The engine that actually runs your agent DAGs via LangGraph
