# Changelog

All notable changes to the Reality Engine AI project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-31

### Added

#### Output Arbiter Architecture
- **3-Phase Reality Engine Workflow**: Implemented new processing workflow
  - Phase 1: Resolve new input reality vector
  - Phase 2: Apply input to all active events (sequences)
  - Phase 3: Resolve machine output via arbiter
- **OutputArbiter Class** (`/src/models/OutputArbiter.ts`)
  - Combinatorial logic for machine-level output generation
  - Support for AND, OR, and PASSTHROUGH rules
  - Output vector combination and metadata aggregation
- **Machine-Level Processing**: New `Machine.processInput()` method
  - Processes inputs through complete 3-phase workflow
  - Returns `MachineTransitionResult` with arbiter metadata
- **New API Endpoint**: `POST /api/machines/:id/process`
  - Process input through specific machine
  - Returns structured result with arbiter information

#### Output Vector Visualization
- **Persistent Output Badges**: Purple glowing badges above final event nodes
  - Display output vector values (e.g., `[1.0, 0.0]` or `[0.5, 0.3, 0.8...]`)
  - Persist even after node becomes inactive
  - Clear only when next input is processed
- **lastOutputVector Tracking**: Added to `RealityVector` model
  - Stores most recent output for visualization
  - Serialized/deserialized in JSON operations
  - Integrated into graph data transformation

#### Interactive Output Highlighting
- **Hover-to-Highlight**: Mouse over final events to highlight outputs
  - Auto-scroll output stream to relevant output
  - Purple gradient highlight with glow effect
  - Smooth scroll animation with centering
- **Visual Feedback**: Enhanced output cards
  - Highlighted: Purple gradient (`#a855f7` → `#8b5cf6`)
  - Current: Orange gradient (most recent)
  - History: Dark slate (previous outputs)
  - Scale-up animation on highlight (1.05x)

#### Output Stream Features
- **Output History Accumulation**: Outputs now accumulate instead of replacing
  - Current section: Most recent output
  - History section: Scrollable previous outputs
  - Automatic scroll to top on new output
- **Auto-Play Output Updates**: Output stream updates during automatic playback
  - Stored last result in `SimulationController`
  - Included in state API response
  - Broadcast during polling for real-time updates

### Fixed

#### Match Propagation
- **Transitional Vector Deactivation**: Fixed state progression issues
  - Transitional vectors now deactivate after successful match
  - Only initial and final vectors remain active
  - Clean state progression through sequences
  - Final events now activate correctly on match

#### Active Event Visualization
- **Active Final Event Display**: Corrected visualization priority
  - Active matched events show green stroke (active state)
  - Combined purple + green glow for active matched events
  - Proper visual feedback for all state combinations
  - Active states no longer hidden by matched states

#### Output Stream Duplicates
- **Single Source of Truth**: Eliminated duplicate output insertion
  - WebSocket as primary output source
  - Fallback to direct API when disconnected
  - Prevented double-insertion during step operations
  - Clean, predictable output accumulation

### Changed

#### Graph Visualization
- **Enhanced Node Styling**: Improved visual indicators for active states
  - Active matched final events: Green stroke + combined glow
  - Active final events: Green stroke + green glow
  - Inactive matched events: Purple stroke + purple glow
  - Stroke width reflects state priority (6px → 2px)

#### State Management
- **Output State Tracking**: Added `highlightedOutputId` to global state
  - Enables cross-component output highlighting
  - Coordinated graph-to-stream interaction
  - Smooth user experience

### Documentation

#### Architecture Documentation
- `ARBITER_ARCHITECTURE.md`: Complete 3-phase workflow documentation
- `OUTPUT_STREAM_FILTERING.md`: Machine-specific output filtering
- `OUTPUT_VECTOR_VISUALIZATION.md`: Output badge visualization details
- `OUTPUT_HOVER_HIGHLIGHTING.md`: Interactive highlighting feature
- `MATCH_PROPAGATION_FIX.md`: State progression fix details
- `DUPLICATE_OUTPUT_FIX.md`: Output deduplication solution
- `AUTO_PLAY_OUTPUT_STREAM_FIX.md`: Auto-play streaming fix

### Technical Details

#### Performance
- No significant performance impact from new features
- Efficient ref-based DOM lookups for highlighting
- Optimized D3.js rendering with minimal re-renders
- Smooth scroll animations using native browser APIs

#### Backward Compatibility
- All existing API endpoints maintained
- Old sequence-level processing still functional
- New machine-level processing is opt-in
- No breaking changes to data models

---

## [1.0.1] - Previous Release

### Initial Features
- Basic Reality Engine with vector processing
- Critical Event Sequences
- Web-based visualizer with D3.js
- Simulation playback controls
- Real-time WebSocket updates

---

**Release Date**: 2026-01-31
**Contributors**: Claude Sonnet 4.5 (AI Assistant)
**Version**: 1.1.0
