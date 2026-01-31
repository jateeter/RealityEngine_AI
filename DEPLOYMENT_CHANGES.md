# Deployment Changes - NAND Example Removal

**Date:** January 9, 2026
**Version:** Next Deployment
**Type:** Breaking Change (for NAND references only)

## Summary

The NAND Gate example has been permanently disabled and will not appear in new deployments.

## Changes for New Deployments

### ✅ Automatic Changes (No Action Required)

1. **Reality Engine Backend**
   - NAND Gate machine will NOT be auto-loaded on startup
   - `/api/demo/nand-gate` endpoint disabled
   - System starts with 3 example machines instead of 4

2. **Visualizer Frontend**
   - NAND Gate card will NOT appear in machine selection
   - No NAND-specific UI elements
   - Clean machine library without NAND

3. **Visualizer Backend**
   - NAND proxy endpoint disabled
   - Mock NAND machine removed from initialization

### 📋 Available Examples After Deployment

New deployments will include:

1. **Multi-Step State Machine** (Recommended for new users)
   - Path: 000→001→011 and 100→101→111
   - Outputs: Binary vectors [0,1] and [1,0]
   - Use Case: Learning sequences and outputs

2. **Kleene Star Operator**
   - Zero or more repetitions with alternation
   - Advanced pattern demonstration

3. **Data Center Monitoring**
   - 5 monitoring sequences
   - Real-world infrastructure scenario

## Deployment Verification

After deploying, verify NAND removal:

```bash
# 1. Check Reality Engine logs - should NOT see "NAND Gate machine loaded"
docker logs reality-engine | grep -i nand
# Expected: No output (or only "NAND Gate Machine - DISABLED" comment)

# 2. Check available machines via API
curl http://localhost:3000/api/machines | jq '.machines[].name'
# Expected: Should NOT include "NAND Gate" or similar

# 3. Try to load NAND demo (should fail)
curl http://localhost:3000/api/demo/nand-gate
# Expected: 404 or error response

# 4. Check Visualizer machine selection
# Open http://localhost:5173
# Expected: No NAND Gate card in machine library
```

## Rollback (If Needed)

If NAND example must be restored:

1. **Revert Backend Changes:**
   ```bash
   git revert <commit-hash>
   ```

2. **Re-enable in routes.ts:**
   - Uncomment NAND loading in `initialize()` method
   - Uncomment `loadNANDGateExample()` method
   - Add back `/demo/nand-gate` route

3. **Re-enable Frontend:**
   - Uncomment `loadNANDGateExample()` in store.ts
   - Uncomment API method in api.ts

## Migration for Existing Deployments

### If You Have Custom Code Using NAND:

**Before (Deprecated):**
```typescript
// This will fail in new deployments
await api.loadNANDGateExample();
const nandMachine = machines.find(m => m.name === 'NAND Gate');
```

**After (Use Multi-Step):**
```typescript
// Use Multi-Step State Machine instead
await api.loadMultiStepExample();
const multiStepMachine = machines.find(m => m.name.includes('Multi-Step'));
```

## Impact Assessment

### Low Impact Areas ✅
- Docker configurations (no changes needed)
- Deployment scripts (no NAND references)
- Database/Qdrant (machine-agnostic)
- Core engine functionality

### Medium Impact Areas ⚠️
- Custom scripts that explicitly load NAND example
- Documentation referencing NAND (updated)
- Tests that use NAND specifically (need updates)

### No Impact Areas ✅
- General sequence processing
- Machine creation/management
- Vector processing
- WebSocket communication
- Output stream visualization

## Testing Checklist

Before deploying to production:

- [ ] Start fresh docker deployment
- [ ] Verify only 3 example machines load
- [ ] Confirm NAND endpoint returns error
- [ ] Test Multi-Step example as alternative
- [ ] Check visualizer machine library
- [ ] Verify no console errors related to NAND
- [ ] Run e2e tests (should pass)

## Files Modified

### Backend
- `src/api/routes.ts` - Disabled NAND machine loading
- `src/api/routes.ts` - Disabled `/api/demo/nand-gate` endpoint

### Frontend
- `visualizer/frontend/src/store.ts` - Removed loadNANDGateExample
- `visualizer/frontend/src/api.ts` - Disabled API method

### Visualizer Backend
- `visualizer/backend/src/server.ts` - Disabled proxy endpoint
- `visualizer/backend/src/server.ts` - Removed mock NAND machine

### Documentation
- `NAND_EXAMPLE_REMOVED.md` - New file documenting removal
- `MACHINE_VIEW_BUTTON.md` - Updated to remove NAND references
- `DEPLOYMENT_CHANGES.md` - This file

## Support

For questions about this change:
- See `NAND_EXAMPLE_REMOVED.md` for detailed migration guide
- Use Multi-Step State Machine as recommended alternative
- Contact development team if NAND example is critical to your use case

---

**Status:** ✅ Ready for Deployment
**Breaking Changes:** Only affects code explicitly using NAND example
**Recommended Action:** Deploy and verify using checklist above
