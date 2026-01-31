# Docker Cache Management - Updated Scripts

**Date**: January 23, 2026
**Status**: ✅ **COMPLETE**

---

## Overview

Updated all Docker stop and start scripts to automatically clear Docker build cache, preventing stale cache issues that can cause TypeScript compilation errors and deployment inconsistencies.

---

## Problem

Docker build cache can retain old source code, dependencies, and build artifacts. This causes:
- **TypeScript errors** from cached old code that no longer exists
- **Stale dependencies** from cached node_modules
- **Build inconsistencies** between local and Docker builds
- **Deployment issues** with outdated compiled code

### Example Issues:
- `robotics-assembly` errors when that directory doesn't exist (cached from old build)
- Dynamic import type inference errors (cached TypeScript compilation)
- Mismatched builds between local `npm run build` and Docker builds

---

## Solution

Added automatic cache clearing to all Docker management scripts:

### Cache Clearing Commands:
```bash
# Clear build cache
docker builder prune -f

# Remove dangling images
docker image prune -f

# Rebuild without cache
docker-compose build --no-cache
```

---

## Updated Scripts

### 1. `/docker-stop.sh`

**Purpose**: Stop all Docker services and clear cache

**Changes**:
- ✅ Added `docker builder prune -f` after stopping services
- ✅ Added `docker image prune -f` to remove dangling images
- ✅ Updated success message to confirm cache clearing

**Usage**:
```bash
./docker-stop.sh
```

**What it does**:
1. Stops all containers with `docker-compose down`
2. Clears Docker build cache
3. Removes unused/dangling images
4. Confirms cache cleared

---

### 2. `/docker-start.sh`

**Purpose**: Start all Docker services with fresh build

**Changes**:
- ✅ Added `docker builder prune -f` before building
- ✅ Changed to `docker-compose build --no-cache` for fresh builds
- ✅ Separated build and up commands for clarity

**Usage**:
```bash
./docker-start.sh
```

**What it does**:
1. Checks Docker daemon is running
2. Creates data/logs directories
3. Clears Docker build cache
4. Builds images WITHOUT cache (`--no-cache`)
5. Starts services with `docker-compose up -d`
6. Shows service status

**Before**:
```bash
docker-compose up -d --build
```

**After**:
```bash
docker builder prune -f
docker-compose build --no-cache
docker-compose up -d
```

---

### 3. `/docker-restart.sh`

**Purpose**: Restart services with fresh build

**Changes**:
- ✅ Changed from simple `docker-compose restart` to full rebuild
- ✅ Added `docker-compose down` to stop containers
- ✅ Added cache clearing with `builder prune` and `image prune`
- ✅ Added `--no-cache` rebuild
- ✅ Starts fresh containers

**Usage**:
```bash
./docker-restart.sh
```

**What it does**:
1. Stops all containers
2. Clears build cache and dangling images
3. Rebuilds all images without cache
4. Starts fresh containers
5. Waits for health checks
6. Shows service status

**Before**:
```bash
docker-compose restart
```

**After**:
```bash
docker-compose down
docker builder prune -f
docker image prune -f
docker-compose build --no-cache
docker-compose up -d
```

---

### 4. `/scripts/stop.sh`

**Purpose**: Stop all services (Docker + API) and clear cache

**Changes**:
- ✅ Added cache clearing after `docker-compose down`
- ✅ Suppressed verbose output (> /dev/null 2>&1)
- ✅ Added success confirmation message
- ✅ Updated documentation message

**Usage**:
```bash
./scripts/stop.sh
```

**What it does**:
1. Stops Reality Engine API (if running via PID)
2. Stops Docker services with `docker-compose down`
3. Clears Docker build cache
4. Removes dangling images
5. Confirms all cleaned up

---

### 5. `/scripts/start.sh`

**Purpose**: Start all services with fresh Docker builds

**Changes**:
- ✅ Added cache clearing before building
- ✅ Added explicit `docker-compose build --no-cache` step
- ✅ Separated build and up commands
- ✅ Suppressed verbose cache clearing output

**Usage**:
```bash
./scripts/start.sh
```

**What it does**:
1. Checks for existing containers and removes them
2. Clears Docker build cache
3. Removes dangling images
4. Builds Docker images WITHOUT cache
5. Starts Docker services (Qdrant, Visualizer Backend, Visualizer Frontend)
6. Waits for Qdrant health check
7. Starts Reality Engine API
8. Waits for API health check
9. Shows all service URLs

---

## Scripts NOT Modified

### `/visualizer/start-all.sh` and `/visualizer/stop-all.sh`

**Reason**: These scripts start/stop services locally (not Docker-based), so Docker cache management is not applicable.

**Purpose**: Development scripts for running services with `npm run dev`

---

## Benefits

### 1. Consistency ✅
- Local builds and Docker builds always match
- No stale code from previous builds
- Fresh TypeScript compilation every time

### 2. Reliability ✅
- Eliminates "works locally but fails in Docker" issues
- Prevents cached dependency mismatches
- Ensures latest source code is always built

### 3. Predictability ✅
- Every start is a fresh build
- No hidden cached layers
- Clear understanding of build state

### 4. Debugging ✅
- Eliminates cache as source of errors
- Easier to reproduce issues
- Clearer error messages

---

## Performance Considerations

### Build Time Impact

**Without Cache**: ~30-60 seconds (fresh build)
**With Cache**: ~5-15 seconds (cached layers)

**Trade-off**: We sacrifice build speed for reliability and correctness.

### When This Matters:

**Development**: Frequent restarts
- Consider using `docker-compose restart` for quick restarts (no rebuild)
- Only use `./docker-start.sh` when you need fresh build

**Production/Deployment**: Infrequent builds
- Always use full cache-clearing rebuild
- Ensures deployment integrity

### Quick Restart (No Rebuild):

If you just need to restart containers without rebuilding:

```bash
# Quick restart (keeps existing images)
docker-compose restart

# Only use this if you haven't changed source code
```

---

## Usage Patterns

### Daily Development Workflow

```bash
# Morning: Start with fresh build
./docker-start.sh

# During day: Quick restarts if needed
docker-compose restart reality-engine

# Evening: Stop and clear
./docker-stop.sh
```

### After Code Changes

```bash
# Always use full rebuild after changes
./docker-restart.sh

# Or stop, then start
./docker-stop.sh
./docker-start.sh
```

### Deployment

```bash
# Production deployment - always fresh
./docker-stop.sh   # Clear everything
./docker-start.sh  # Fresh build
```

### Troubleshooting

```bash
# If experiencing build issues
./docker-stop.sh           # Stop and clear cache
docker system prune -f     # Additional cleanup
./docker-start.sh          # Fresh start
```

---

## Manual Cache Clearing

If you need to manually clear cache:

```bash
# Clear build cache only
docker builder prune -f

# Clear dangling images
docker image prune -f

# Clear all unused images (aggressive)
docker image prune -a -f

# Clear everything (nuclear option)
docker system prune -a -f --volumes
```

---

## Verification

### Check Cache Status

```bash
# View builder cache usage
docker builder du

# View image layers
docker images

# View build cache
docker buildx du
```

### Verify Fresh Build

After running updated scripts, check logs:

```bash
# Should see fresh npm installs
docker logs reality-engine-app | grep "added.*packages"

# Should see TypeScript compilation
docker logs reality-engine-app | grep "tsc"
```

---

## Comparison: Before vs After

### Before (Old Scripts)

```bash
# docker-start.sh
docker-compose up -d --build    # Uses cache by default

# docker-restart.sh
docker-compose restart          # No rebuild at all

# docker-stop.sh
docker-compose down             # No cache clearing
```

**Issues**:
- Cached TypeScript errors
- Stale dependencies
- Build inconsistencies
- Hard to debug

### After (Updated Scripts)

```bash
# docker-start.sh
docker builder prune -f         # Clear cache
docker-compose build --no-cache # Fresh build
docker-compose up -d            # Start fresh

# docker-restart.sh
docker-compose down             # Stop
docker builder prune -f         # Clear cache
docker image prune -f           # Remove dangling
docker-compose build --no-cache # Rebuild fresh
docker-compose up -d            # Start fresh

# docker-stop.sh
docker-compose down             # Stop
docker builder prune -f         # Clear cache
docker image prune -f           # Remove dangling
```

**Benefits**:
- ✅ No stale cache
- ✅ Consistent builds
- ✅ Predictable behavior
- ✅ Easy debugging

---

## Testing

### Test Sequence:

1. **Stop and Clear**:
   ```bash
   ./docker-stop.sh
   # Verify: "Docker cache cleared" message
   ```

2. **Start Fresh**:
   ```bash
   ./docker-start.sh
   # Verify: Builds without cache
   # Verify: All services healthy
   ```

3. **Check Logs**:
   ```bash
   docker logs reality-engine-app
   # Verify: Fresh npm install
   # Verify: TypeScript compilation
   # Verify: No cached errors
   ```

4. **Restart**:
   ```bash
   ./docker-restart.sh
   # Verify: Full rebuild
   # Verify: Services restart successfully
   ```

---

## Related Documentation

- **TYPESCRIPT_ERRORS_FIXED.md**: TypeScript errors caused by stale cache
- **REMOVE_FLOATING_PANEL_TITLE.md**: UI changes requiring fresh builds
- **Docker Compose**: `docker-compose.yml` service definitions

---

## Summary

### Changed Files:
- ✅ `/docker-stop.sh` - Added cache clearing
- ✅ `/docker-start.sh` - Added cache clearing + no-cache build
- ✅ `/docker-restart.sh` - Changed to full rebuild with cache clear
- ✅ `/scripts/stop.sh` - Added cache clearing
- ✅ `/scripts/start.sh` - Added cache clearing + no-cache build

### Commands Added:
- `docker builder prune -f` - Clear build cache
- `docker image prune -f` - Remove dangling images
- `docker-compose build --no-cache` - Fresh builds

### Impact:
- ✅ Eliminates stale cache issues
- ✅ Ensures consistent builds
- ✅ Prevents TypeScript errors from old code
- ✅ Improves deployment reliability
- ⚠️ Slightly slower builds (trade-off for correctness)

---

**Updated**: January 23, 2026
**Status**: ✅ Production Ready
**Testing**: ✅ Verified Working
