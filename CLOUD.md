# Cloud Deployment Guide

## Running on Mac Mini (Local Development)

```bash
# Start everything (PostgreSQL + Bot)
npm start

# Or step by step:
npm run db:start      # Start PostgreSQL
npm run start:local   # Start bot directly
```

Health check: http://localhost:8080/health

## Cloud Deployment Options

### Option 1: Docker Compose (VPS / Dedicated Server)

```bash
# On any VPS with Docker installed
docker-compose up --build -d
```

### Option 2: Railway / Render (Easiest)

1. Connect GitHub repo
2. Set environment variables
3. Deploy automatically

### Option 3: AWS ECS / Fargate

```bash
# Build and push to ECR
docker build -t marketplace-bot .
docker tag marketplace-bot:latest YOUR_ECR_REPO/marketplace-bot:latest
docker push YOUR_ECR_REPO/marketplace-bot:latest

# Deploy to ECS using the task definition
```

### Option 4: Google Cloud Run

```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT/marketplace-bot
gcloud run deploy marketplace-bot \
  --image gcr.io/PROJECT/marketplace-bot \
  --port 8080 \
  --env-vars-file .env.yaml
```

### Option 5: Kubernetes

```bash
kubectl apply -f k8s/
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MARKETPLACE_BOT_TOKEN` | Yes | Discord bot token |
| `MARKETPLACE_CLIENT_ID` | Yes | Discord application ID |
| `GUILD_ID` | No | Test guild ID (for development) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `HEALTH_PORT` | No | Health check port (default: 8080) |

## Health Check Endpoints

- `GET /health` - Returns 200 if bot and DB are healthy
- `GET /ready` - Kubernetes-style readiness probe

## Graceful Shutdown

The bot handles SIGTERM and SIGINT signals for clean shutdown:
1. Closes health server
2. Destroys Discord client
3. Closes database pool
4. Exits cleanly