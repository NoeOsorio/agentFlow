# AgentFlow - Production Deployment Guide

> How to deploy AgentFlow to a real server so your team (or the world) can use it.

---

## Overview: Two Ways to Deploy

| Method | Best for | Difficulty |
|--------|----------|-----------|
| **Docker Compose** | Small teams, single server | Easier |
| **Kubernetes** | Scaling, high availability | Advanced |

This guide covers both. Start with Docker Compose if you're not sure.

---

# Method 1: Docker Compose (Single Server)

### What you'll need

- A Linux server (Ubuntu 22.04+ recommended) with:
  - At least 4 GB RAM
  - 20 GB disk space
  - Docker and Docker Compose installed
- A domain name (optional, but recommended)

### Step 1: Get the code on your server

```bash
# SSH into your server
ssh your-user@your-server-ip

# Clone the repo
git clone <your-repo-url>
cd agentflow
```

### Step 2: Create your environment file

```bash
cp apps/api/.env.example .env
```

Now edit `.env` with **real values**. This is critical for security:

```bash
nano .env
```

```env
# CHANGE THESE - use strong random strings
AGENTFLOW_SECRET_KEY=generate-a-64-char-random-string-here
INTERNAL_SECRET=generate-another-random-string-here

# Database - change the password!
DATABASE_URL=postgresql+asyncpg://postgres:YOUR_STRONG_PASSWORD@postgres:5432/agentflow

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0

# Environment
AGENTFLOW_ENV=production

# Your domain (for CORS)
CORS_ORIGINS=["https://yourdomain.com"]

# LLM keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

> **How to generate a random string:**
> ```bash
> openssl rand -hex 32
> ```

### Step 3: Update the database password in docker-compose.yml

Edit `docker-compose.yml` and change the postgres password to match your `.env`:

```yaml
postgres:
  environment:
    POSTGRES_PASSWORD: YOUR_STRONG_PASSWORD   # <-- same password as in .env
```

### Step 4: Deploy!

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

> **What does this command do?**
> - `-f docker-compose.yml` = the base config (services, ports, etc.)
> - `-f docker-compose.prod.yml` = production overrides (no hot-reload, auto-restart, etc.)
> - `-d` = run in the background
> - `--build` = rebuild images with latest code

### Step 5: Verify everything is running

```bash
# Check all services are up
docker compose ps

# Check API health
curl http://localhost:8000/health

# Check the logs
docker compose logs -f api
```

### What's running now

| Service | Internal Port | What it does |
|---------|--------------|-------------|
| **web** | 3000 | Frontend app |
| **api** | 8000 | Backend API (auto-runs DB migrations on start) |
| **postgres** | 5432 | Database |
| **redis** | 6379 | Queue & cache |
| **celery-worker** | - | Processes background jobs |
| **celery-beat** | - | Runs scheduled tasks |
| **runtime** | - | Executes agent pipelines |

### Step 6: Set up a reverse proxy (recommended)

You'll want Nginx or Caddy in front so you can use HTTPS and a domain name.

**Quick Caddy setup** (auto-HTTPS):

```bash
# Install Caddy
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

```bash
sudo systemctl restart caddy
```

Caddy will automatically get an SSL certificate from Let's Encrypt.

---

### Updating to a New Version

```bash
cd agentflow

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime for stateless services)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

> The API entrypoint script automatically runs database migrations before starting, so schema updates are applied on every deploy.

### Viewing Logs

```bash
# All services
docker compose logs -f

# Just the API
docker compose logs -f api --tail 100

# Just errors
docker compose logs -f api 2>&1 | grep ERROR
```

### Monitoring the Task Queue

To enable Flower (the Celery task monitor):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile monitoring up -d
```

Then visit `http://your-server:5555` to see task queue status.

> **Security note:** Don't expose Flower to the internet without authentication. Keep port 5555 behind a firewall or VPN.

### Backups

**Database backup:**

```bash
# Create a backup
docker compose exec postgres pg_dump -U postgres agentflow > backup_$(date +%Y%m%d).sql

# Restore from backup
docker compose exec -T postgres psql -U postgres agentflow < backup_20240101.sql
```

Set up a cron job to back up daily:

```bash
crontab -e
```

Add:

```
0 2 * * * cd /path/to/agentflow && docker compose exec -T postgres pg_dump -U postgres agentflow > /backups/agentflow_$(date +\%Y\%m\%d).sql
```

---

# Method 2: Kubernetes (Advanced)

> Use this if you need auto-scaling, high availability, or are deploying to a cloud provider like AWS EKS, GCP GKE, or Azure AKS.

### Prerequisites

- A Kubernetes cluster (1.25+)
- `kubectl` configured to talk to your cluster
- Container images pushed to a registry (e.g., Docker Hub, ECR, GCR)

### Step 1: Build and push your images

```bash
# Build images
docker build -f apps/api/Dockerfile -t your-registry/agentflow-api:latest .
docker build -f services/runtime/Dockerfile -t your-registry/agentflow-runtime:latest .
docker build -f apps/web/Dockerfile -t your-registry/agentflow-web:latest .

# Push to your registry
docker push your-registry/agentflow-api:latest
docker push your-registry/agentflow-runtime:latest
docker push your-registry/agentflow-web:latest
```

### Step 2: Update Kubernetes configs

Edit the image references in `infrastructure/k8s/` to point to your registry:

- `infrastructure/k8s/api/deployment.yaml`
- `infrastructure/k8s/runtime/deployment.yaml`
- `infrastructure/k8s/worker/deployment.yaml`

### Step 3: Create secrets

Edit `infrastructure/k8s/secrets.yaml` with base64-encoded values:

```bash
# Encode a value
echo -n "your-secret-value" | base64
```

### Step 4: Deploy

Apply the manifests in order:

```bash
cd infrastructure/k8s

# 1. Namespace and config
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml

# 2. Databases (these need to be ready first)
kubectl apply -f postgres/
kubectl apply -f redis/

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis --timeout=120s

# 3. Application services
kubectl apply -f api/
kubectl apply -f worker/
kubectl apply -f runtime/
kubectl apply -f celery-beat/

# 4. Auto-scaling
kubectl apply -f api/hpa.yaml
kubectl apply -f worker/hpa.yaml
```

### Step 5: Verify

```bash
# Check all pods are running
kubectl get pods

# Check services
kubectl get svc

# Check API logs
kubectl logs -l app=api --tail=50

# Check auto-scaling status
kubectl get hpa
```

### What gets deployed

```
                    [Ingress / Load Balancer]
                         |           |
                    [Web x1]    [API x2]
                                    |
                    +-------+-------+-------+
                    |       |               |
              [Worker x3] [Beat x1]   [Runtime x1]
                    |       |               |
                    +---[Redis]---+         |
                         |                  |
                    [PostgreSQL]             |
                         +------------------+
```

### Auto-scaling

The Kubernetes setup includes Horizontal Pod Autoscalers (HPA):

| Service | Min pods | Max pods | Scales when |
|---------|----------|----------|-------------|
| API | 2 | 10 | CPU > 70% or Memory > 80% |
| Worker | 2 | 20 | CPU > 60% |

This means if your API gets lots of traffic, Kubernetes will automatically spin up more API pods (up to 10) to handle the load.

---

## Security Checklist

Before going live, make sure you've done these:

- [ ] Changed all default passwords (Postgres, Redis, secret keys)
- [ ] Set `AGENTFLOW_ENV=production`
- [ ] Set up HTTPS (SSL/TLS) via Caddy, Nginx, or cloud load balancer
- [ ] Restricted CORS to your actual domain
- [ ] Put Flower (port 5555) behind a firewall or disabled it
- [ ] Set up automated database backups
- [ ] Configured a firewall to only expose ports 80 and 443
- [ ] Stored API keys (Anthropic, OpenAI) securely (not in git!)
- [ ] Set up monitoring/alerting (e.g., Grafana, Datadog, or cloud-native)

---

## Quick Reference

### Useful Commands

```bash
# Docker Compose - check status
docker compose ps

# Docker Compose - restart a single service
docker compose restart api

# Docker Compose - view resource usage
docker stats

# Kubernetes - check pod status
kubectl get pods -w

# Kubernetes - restart a deployment
kubectl rollout restart deployment/api

# Kubernetes - check autoscaler
kubectl get hpa

# Kubernetes - emergency: scale manually
kubectl scale deployment/worker --replicas=10
```

### Important URLs

| What | URL |
|------|-----|
| Frontend | `https://yourdomain.com` |
| API Docs | `https://yourdomain.com/api/docs` |
| Health Check | `https://yourdomain.com/api/health` |
| Flower (if enabled) | `http://your-server:5555` |

### Getting Help

If something goes wrong:

1. **Check the logs** - 90% of issues are visible in the logs
2. **Check the health endpoints** - `curl localhost:8000/health`
3. **Check disk space** - `df -h` (databases need room to grow)
4. **Check memory** - `docker stats` or `kubectl top pods`
