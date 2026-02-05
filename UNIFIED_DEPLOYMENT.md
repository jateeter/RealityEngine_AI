# Unified Deployment Architecture

## Overview
Both local and Docker deployments now access machine.json files from the same location on the host file system, ensuring consistency and enabling live updates without rebuilding containers.

## Architecture Changes

### Before: Inconsistent File Access
- **Local Deployment:** Direct access to `examples/machines/` directory
- **Docker Deployment:** No access to machine files (missing volume mount)
- **Problem:** Docker containers couldn't load machine definitions from local file system

### After: Unified File Access
- **Local Deployment:** Direct access to `examples/machines/` directory
- **Docker Deployment:** Volume mount to `examples/machines/` directory
- **Result:** Both deployments read from the same source of truth

## Implementation Details

### 1. Dockerfile Updates

**File:** `Dockerfile`

Added copying of examples directory during Docker build:
```dockerfile
# Copy examples directory for machine JSON files
COPY --from=build /app/examples ./examples
```

This ensures:
- Examples directory exists in the container
- Fallback available if volume mount fails
- Consistent directory structure

### 2. Docker Compose Updates

**File:** `docker-compose.yml`

Added volume mount for machine definitions:
```yaml
volumes:
  - ./data:/app/data
  - ./logs:/app/logs
  - ./examples/machines:/app/examples/machines  # NEW: Machine JSON files
```

This enables:
- Live updates: Changes to JSON files are immediately available
- Shared source: Both host and container read same files
- No rebuild needed: Update files without rebuilding images

### 3. File Access Pattern

**API Routes:** `src/api/routes.ts`

Uses `process.cwd()` for path resolution:
```typescript
const machinesDir = join(process.cwd(), 'examples/machines');
```

Works consistently because:
- Local: `process.cwd()` = project root
- Docker: `process.cwd()` = `/app` (workdir)
- Both resolve to correct path with proper setup

## Deployment Comparison

### Local Deployment
```bash
# Start services
npm start                    # API on port 3000
cd visualizer/backend && npm start  # Backend on 3001
cd visualizer/frontend && npm run dev  # Frontend on 5173

# Machine files accessed from:
/path/to/project/examples/machines/*.json
```

### Docker Deployment
```bash
# Start services
docker-compose up -d

# Machine files accessed from:
Host: /path/to/project/examples/machines/*.json
Container: /app/examples/machines/*.json (mounted from host)
```

## Benefits

### 1. Live Updates
- Edit machine JSON files on host
- Changes immediately available in containers
- No need to rebuild or restart containers
- Works for both local and Docker deployments

### 2. Single Source of Truth
- All deployments read from same files
- No duplicate/divergent configurations
- Consistent behavior across environments

### 3. Development Workflow
- Test changes locally
- Same files used in Docker
- Production deployment uses same structure
- Easy CI/CD integration

### 4. Simplified Management
- Edit files in IDE on host
- Version control tracks actual files
- No need to enter containers to modify configs
- Easy backup and restore

## Machine File Structure

```
examples/machines/
├── RSFlipFlop.json           # RS flip-flop state machine
├── RS2.json                  # RS flip-flop variant
├── MultiStep.json            # Multi-step sequences
├── KleeneStar.json          # Kleene star operator
└── DataCenterMonitoring.json # Data center monitoring
```

## API Endpoints

All endpoints work identically in both deployments:

### List Available Machines
```bash
GET /api/machines/json/list
```

Returns all machine JSON files from `examples/machines/`

### Load Machine from JSON
```bash
POST /api/machines/json/load
Body: { "filename": "RSFlipFlop.json" }
```

Loads machine definition from the unified location

### Get Loaded Machines
```bash
GET /api/machines
```

Returns currently loaded machines (loaded from unified location)

## Testing the Unified Deployment

### Test Local Deployment
```bash
# Start services
npm run build
npm start

# Verify machine files accessible
curl http://localhost:3000/api/machines/json/list
```

### Test Docker Deployment
```bash
# Build and start
docker-compose up -d --build

# Wait for services to be healthy
docker-compose ps

# Verify machine files accessible
curl http://localhost:3000/api/machines/json/list
```

### Verify Volume Mount
```bash
# Check mounted files in container
docker exec reality-engine-app ls -la /app/examples/machines/

# Should show same files as host:
# ls -la examples/machines/
```

### Test Live Updates
```bash
# Start Docker deployment
docker-compose up -d

# Modify a machine file on host
echo '...' > examples/machines/TestMachine.json

# Verify change visible in container
docker exec reality-engine-app ls -la /app/examples/machines/
# TestMachine.json should appear

# Verify API sees the change
curl http://localhost:3000/api/machines/json/list
# Should include TestMachine.json
```

## Troubleshooting

### Files Not Visible in Docker

**Problem:** Machine files not appearing in container

**Solution:**
1. Verify volume mount in docker-compose.yml
2. Check file permissions: `ls -la examples/machines/`
3. Restart containers: `docker-compose restart reality-engine`
4. Check logs: `docker logs reality-engine-app`

### Permission Errors

**Problem:** Permission denied accessing files in container

**Solution:**
1. Check host directory permissions
2. Ensure files are readable: `chmod +r examples/machines/*.json`
3. On Linux, verify user IDs match or use appropriate permissions

### Path Resolution Issues

**Problem:** API cannot find examples/machines directory

**Solution:**
1. Verify working directory: `docker exec reality-engine-app pwd`
   - Should be `/app`
2. Check directory exists: `docker exec reality-engine-app ls -la /app/examples/`
3. Verify volume mount: `docker inspect reality-engine-app`

## Migration Notes

### Upgrading from Previous Versions

If upgrading from a version without unified deployment:

1. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

2. **Rebuild Docker images:**
   ```bash
   docker-compose down
   docker-compose build --no-cache
   docker-compose up -d
   ```

3. **Verify machine files accessible:**
   ```bash
   curl http://localhost:3000/api/machines/json/list
   ```

### No Changes Required For:
- Machine JSON file format
- API endpoint paths
- Frontend code
- Existing machine definitions

## Security Considerations

### Read-Only Mount (Optional)

For production, consider read-only volume mounts:

```yaml
volumes:
  - ./examples/machines:/app/examples/machines:ro
```

This prevents container from modifying host files.

### File Validation

The API validates all loaded machine JSON files:
- Schema validation
- Required fields check
- Perceptual mapping validation

Invalid files are rejected with error messages.

## Summary

The unified deployment architecture ensures:

✅ **Consistency:** Same files used in all environments  
✅ **Live Updates:** Changes immediately available  
✅ **Simplicity:** Single source of truth  
✅ **Flexibility:** Easy to add/modify machines  
✅ **Development Friendly:** Edit on host, test anywhere  

Both local and Docker deployments now share the same machine.json files from the host file system, eliminating deployment inconsistencies and enabling seamless development and production workflows.
