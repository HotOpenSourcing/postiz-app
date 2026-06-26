# Coolify Deployment Guide for Postiz

## Overview
This guide covers deploying Postiz to Coolify, which manages PostgreSQL and Redis externally. The temporal workflow engine requires specific PostgreSQL configuration to work correctly.

## Critical Prerequisites

### Required Environment Variables
You **MUST** set these environment variables in the Coolify UI before deployment, or the temporal container will fail to start:

#### Temporal PostgreSQL Connection
```bash
TEMPORAL_PG_HOST=<your-coolify-postgres-host>
TEMPORAL_PG_USER=<your-postgres-user>
TEMPORAL_PG_PASSWORD=<your-postgres-password>
```

#### Application PostgreSQL Connection
```bash
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
```

#### Application Redis Connection
```bash
REDIS_URL=redis://<host>:<port>
```

## Common Deployment Failures

### Issue 1: Temporal Container Unhealthy
**Symptom:** 
```
Container temporal-xxx  Waiting → Waiting → Error → Error
dependency failed to start: container temporal-xxx is unhealthy
```

**Root Cause:** Temporal cannot connect to PostgreSQL because `TEMPORAL_PG_HOST`, `TEMPORAL_PG_USER`, or `TEMPORAL_PG_PASSWORD` are not set, causing it to fall back to the default `postgres` hostname which doesn't exist in Coolify.

**Solution:** Set all three `TEMPORAL_PG_*` environment variables in Coolify UI pointing to your managed PostgreSQL instance.

### Issue 2: Postiz Service Won't Start
**Symptom:**
```
postiz service waiting indefinitely
```

**Root Cause:** The `postiz` service depends on `temporal` being healthy (`depends_on: temporal: condition: service_healthy`). If temporal fails, postiz cannot start.

**Solution:** Fix the temporal service first (see Issue 1).

### Issue 3: Container Name Conflicts
**Symptom:**
```
Error: container name "temporal" already in use
```

**Root Cause:** Coolify generates dynamic container names, but static `container_name` directives in docker-compose conflict.

**Solution:** ✅ Already fixed in `docker-compose-coolify.yaml` - all static container names have been removed.

## Deployment Checklist

- [ ] Set `TEMPORAL_PG_HOST` in Coolify UI
- [ ] Set `TEMPORAL_PG_USER` in Coolify UI
- [ ] Set `TEMPORAL_PG_PASSWORD` in Coolify UI
- [ ] Set `DATABASE_URL` for Postiz application
- [ ] Set `REDIS_URL` for Postiz application
- [ ] Verify PostgreSQL is accessible from container network
- [ ] Deploy using `docker-compose-coolify.yaml`
- [ ] Monitor temporal container health: `docker ps` (should show "healthy" status after ~2 minutes)
- [ ] Check postiz logs: `docker logs <postiz-container-id>`

## Architecture

```
┌─────────────────────────────────────┐
│         Coolify Platform            │
├─────────────────────────────────────┤
│  External Services (Managed):       │
│  • PostgreSQL (main + temporal DB)  │
│  • Redis                            │
└─────────────────────────────────────┘
           ↓ connections ↓
┌─────────────────────────────────────┐
│      Docker Compose Services        │
├─────────────────────────────────────┤
│  temporal (port 7233)               │
│    ├─ healthcheck: nc -z :7233      │
│    ├─ retries: 12 × 15s = 3min      │
│    └─ start_period: 120s            │
│                                     │
│  postiz (ports 3000, 3002, 4200)    │
│    └─ depends_on: temporal healthy  │
│                                     │
│  temporal-ui (internal only)        │
│    └─ depends_on: temporal healthy  │
│                                     │
│  nginx (port 5000)                  │
│    ├─ /api/* → backend:3000         │
│    ├─ / → frontend:4200             │
│    └─ /uploads/* → filesystem       │
└─────────────────────────────────────┘
```

## Healthcheck Details

### Temporal Healthcheck
- **Command:** `nc -z localhost 7233` (checks if port 7233 is listening)
- **Interval:** 15 seconds between checks
- **Timeout:** 5 seconds per check
- **Retries:** 12 attempts (3 minutes total)
- **Start Period:** 120 seconds grace period before first check
- **Total Warmup:** Up to 4 minutes (120s start + 12×15s retries)

The temporal service will be marked "healthy" once port 7233 responds, which happens after:
1. PostgreSQL connection established
2. Schema migrations completed
3. Temporal server started and listening

## Troubleshooting

### View Temporal Logs
```bash
docker logs <temporal-container-id>
```

Look for errors like:
- `failed to connect to postgresql` → Check TEMPORAL_PG_* env vars
- `password authentication failed` → Check TEMPORAL_PG_PASSWORD
- `could not translate host name` → Check TEMPORAL_PG_HOST is correct

### Verify Environment Variables
```bash
docker exec <temporal-container-id> env | grep POSTGRES
```

Should show:
```
POSTGRES_USER=<your-user>
POSTGRES_PWD=<your-password>
POSTGRES_SEEDS=<your-host>
```

### Manual Health Check
```bash
docker exec <temporal-container-id> nc -z localhost 7233 && echo "✅ Healthy" || echo "❌ Unhealthy"
```

### Test PostgreSQL Connection from Container
```bash
docker exec <temporal-container-id> nc -z $POSTGRES_SEEDS 5432 && echo "✅ Can reach PostgreSQL" || echo "❌ Cannot reach PostgreSQL"
```

## Changes Made to docker-compose-coolify.yaml

### ✅ Fixed Issues
1. **Removed static container names** for `postiz`, `temporal`, `temporal-admin-tools`, `temporal-ui`, `spotlight`
   - Prevents conflicts with Coolify's dynamic naming
   
2. **Simplified PostgreSQL environment variables** in temporal service
   - Removed triple-fallback pattern: `${TEMPORAL_PG_HOST:-${PG_HOST:-postgres}}`
   - Now uses direct fallback: `${TEMPORAL_PG_HOST:-postgres}`
   - Added prominent comment warning these are REQUIRED
   
3. **Increased temporal healthcheck resilience**
   - Retries: 10 → 12 (allows 3 minutes instead of 2.5)
   - Start period: 90s → 120s (gives more time for schema migrations)
   - Memory limits: 384M → 512M (prevents OOM during startup)

4. **Removed TEMPORAL_PG_PORT variable**
   - Simplified to hardcoded `DB_PORT=5432` (PostgreSQL standard)

## Support

If deployment still fails after following this guide:
1. Check Coolify platform logs
2. Verify network connectivity between containers and managed services
3. Ensure PostgreSQL schema is empty or contains compatible temporal schema
4. Check that PostgreSQL version is 12+ (required by temporal)
