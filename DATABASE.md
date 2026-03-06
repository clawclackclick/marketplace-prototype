# Database Setup & Cloud Migration Guide

## Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start PostgreSQL with Docker
```bash
npm run db:start
```

### 3. Start the Bot
```bash
npm start
```

## Database Schema

### Deal Statuses
- `on_air` - Deal is visible and available for purchase
- `under_escrow` - Deal has a pending transaction
- `flagged` - Deal is flagged (no operations possible)
- `taken` - Deal has been sold
- `archived` - Deal is archived by seller

### Tables
- **deals** - Main marketplace listings
- **reviews** - User reviews for deals
- **users** - Cached Discord user data with reputation
- **transactions** - Purchase transactions with escrow

## Cloud Migration

### AWS RDS PostgreSQL

1. **Create RDS Instance**
```bash
aws rds create-db-instance \
  --db-instance-identifier marketplace-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username marketplace \
  --master-user-password YOUR_PASSWORD \
  --allocated-storage 20
```

2. **Update Environment Variable**
```bash
export DATABASE_URL="postgres://marketplace:YOUR_PASSWORD@marketplace-db.XXX.us-east-1.rds.amazonaws.com:5432/marketplace"
```

### Google Cloud SQL

1. **Create Instance**
```bash
gcloud sql instances create marketplace-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-central1
```

2. **Create Database**
```bash
gcloud sql databases create marketplace --instance=marketplace-db
```

3. **Update Connection String**
```bash
export DATABASE_URL="postgres://marketplace:PASSWORD@/marketplace?host=/cloudsql/PROJECT:REGION:marketplace-db"
```

### Railway / Render / Supabase

These platforms provide managed PostgreSQL with connection URLs:

```bash
# Just set the DATABASE_URL environment variable
export DATABASE_URL="postgres://user:pass@host:5432/database"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://marketplace:marketplace_secret@localhost:5432/marketplace` |
| `MARKETPLACE_BOT_TOKEN` | Discord bot token | Required |
| `MARKETPLACE_CLIENT_ID` | Discord application ID | Required |
| `GUILD_ID` | Test guild ID (optional) | - |

## Database Commands

```bash
# Start database
npm run db:start

# Stop database
npm run db:stop

# Reset database (deletes all data!)
npm run db:reset

# Start bot with local database
npm run start

# Start bot without Docker (requires local PostgreSQL)
npm run start:local
```

## Backup & Restore

### Backup
```bash
docker exec marketplace-db pg_dump -U marketplace marketplace > backup.sql
```

### Restore
```bash
docker exec -i marketplace-db psql -U marketplace marketplace < backup.sql
```

## Performance Notes

- Connection pool size: 20 (adjust via `DATABASE_URL` query params)
- Indexes on: status, seller_id, created_at, deal_id for reviews/transactions
- Automatic triggers for rating updates and user stats
- Ready for read replicas (just add replica connection string)