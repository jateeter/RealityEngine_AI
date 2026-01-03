# Reality Engine Visualizer - User Guide

## Overview

The Reality Engine Visualizer provides a clean, production-ready interface for managing and visualizing critical event sequence machines. The interface is organized around two primary views optimized for different workflows.

---

## Application Architecture

### Two-View System

1. **Machine Selection View** - Library and management interface
2. **Machine Administration View** - Full-screen visualization and control

### Smart Navigation

The application automatically loads your last viewed machine on startup, or presents the machine library if no recent activity is detected.

---

## Machine Selection View

### Purpose
The Machine Selection View serves as your central library for browsing, managing, and selecting machines for visualization and administration.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ Reality Engine          [Search...]       [+ New Machine]│ ← Header (60px)
├──────────────────────────────────────────────────────────┤
│ [All] [Examples] [Custom]              Sort: [Last Used] │ ← Toolbar (50px)
├──────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │   Machine   │  │   Machine   │  │   Machine   │      │
│  │     #1      │  │     #2      │  │     #3      │      │
│  │             │  │             │  │             │      │
│  │  5 seqs     │  │  3 seqs     │  │  7 seqs     │      │
│  │  120 vecs   │  │  45 vecs    │  │  200 vecs   │      │
│  └─────────────┘  └─────────────┘  └─────────────┘      │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Interactive Elements

#### 1. Search Bar
- **Location**: Top-right header
- **Function**: Real-time filtering by machine name or description
- **Behavior**: Type to filter, clear to show all

#### 2. Create New Machine Button
- **Location**: Top-right header (blue button with "+" icon)
- **Action**: Opens Machine Create Dialog
- **Keyboard**: N/A (mouse click only)

#### 3. Filter Tabs
- **All**: Shows all machines (examples + custom)
- **Examples**: Shows only pre-loaded example machines
- **Custom**: Shows only user-created machines
- **Visual Feedback**: Active tab has blue background

#### 4. Sort Dropdown
- **Options**:
  - Last Accessed (default)
  - Name (alphabetical)
  - Sequences (count)
- **Behavior**: Re-orders machine grid immediately

#### 5. Machine Cards
Each card (300×200px) displays:
- Machine name
- Description (2-line preview)
- Sequence count
- Vector count
- Last accessed timestamp
- "Example" badge (if applicable)

**Card Interactions**:
- **Click**: Opens machine in Administration View
- **Hover**: Shows edit/delete buttons, card lifts with shadow effect
- **Edit Button**: Opens Machine Edit Dialog
- **Delete Button**: Shows confirmation, then deletes (custom machines only)

---

## Machine Administration View

### Purpose
Full-screen workspace for visualizing, monitoring, and controlling a single machine and its critical event sequences.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│ ← Machines / Machine Name                    [View Mode] │ ← Top Navigation (60px)
├──────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│           Critical Event Graph Visualization              │
│                  (Full Screen)                            │
│                                                            │
│                                                            │
│                                 ┌──────────────────────┐  │
│                                 │ Floating Control     │  │
│                                 │ [Overview][Sim]...   │  │
│                                 └──────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Top Navigation Bar

#### Back Button
- **Location**: Far left
- **Icon**: "←" with "Back" text
- **Action**: Returns to Machine Selection View
- **Preserves**: Current machine saved to localStorage

#### Breadcrumb
- **Format**: "Machines / [Machine Name]"
- **Click "Machines"**: Returns to Selection View
- **Current Machine**: Non-clickable, shown in white

#### Machine Stats
- **Displays**: Sequence count, vector count
- **Example Badge**: Shows "Example" if applicable
- **Visual**: Right side of nav bar

### Graph Visualization

The full-screen graph displays all critical event sequences for the current machine.

#### Visual Elements

**Nodes (Events)**:
- **Blue Circles**: Initial events (Input Event Space)
- **Green Circles**: Active events (currently matched)
- **Gray Circles**: Inactive events
- **Orange Border (thick)**: Events with outputs (Output Event Space)

**Edges (Transitions)**:
- **Gray Lines**: Inactive transitions
- **Green Animated Lines**: Active transitions with "⚡" label
- **Arrow Markers**: Direction of state flow

**Legend** (top-right):
- Event Spaces section explains Input/Output event spaces
- Event States section shows color meanings
- Transitions section explains edge types

#### Graph Controls (ReactFlow)
- **Zoom**: Mouse wheel or Controls panel
- **Pan**: Click and drag
- **Fit View**: Button in Controls panel
- **Mini-map**: Bottom-right corner (shows full graph overview)

### Floating Control Panel

**Position**: Bottom-right, 20px offset
**Size**: 400px wide × 60px collapsed, 500px expanded
**Behavior**: Click tabs to expand, collapse button to minimize

#### Panel States

**Collapsed (60px height)**:
- Shows machine name
- Expand button (▲)
- Minimal screen footprint

**Expanded (500px height)**:
- Full tab interface
- Scrollable content
- Collapse button (▼)

#### Tab: Overview

**Content**:
- Machine name and description
- Statistics (sequences, vectors)
- Sequence list with IDs
- Metadata (ID, created, updated, last accessed)

**Interactions**:
- Read-only display
- Scrollable if content exceeds panel height

#### Tab: Simulation

**Purpose**: Control simulation playback of input vector streams

**Controls**:

1. **Status Indicator**
   - Green dot: Playing
   - Orange dot: Paused
   - Gray dot: Stopped
   - Shows current vector index / total

2. **Playback Buttons** (2×2 grid):
   - **Play/Resume** (green): Start or resume simulation
   - **Pause** (orange): Pause without resetting progress
   - **Step** (blue): Advance one vector (disabled while playing)
   - **Stop** (red): Stop and prepare for new run
   - **Reset** (gray): Reset to initial state

3. **Speed Control**:
   - Buttons: 100ms, 500ms, 1000ms, 2000ms
   - Sets delay between vector processing
   - Click to change speed

4. **Progress Display**:
   - Shows total input vectors loaded
   - Current position in stream
   - Progress bar (blue gradient)

**Interaction Flow**:
```
Load Vectors → Play → (Pause/Resume) → Stop → Reset
              ↓
           Step (manual advance)
```

#### Tab: Sequences

**Purpose**: Manage and inspect individual critical event sequences

**Features**:

1. **Sequence List**:
   - Each sequence shown as expandable card
   - Active indicator (green dot with glow)
   - Sequence name and ID
   - Click to select (highlights in graph)
   - Expand/collapse button (▶/▼)

2. **Bulk Actions**:
   - Expand All: Opens all sequence details
   - Collapse All: Closes all sequence details

3. **Expanded Sequence Details**:
   - Stats grid: Total/Active/Initial/Output vectors
   - Metadata JSON (scrollable)
   - Color-coded stats (active = green, output = orange)

**Interactions**:
- Click sequence header → Select in graph
- Click expand button → Show/hide details
- Limit: Maximum 3 sequences expanded simultaneously (performance)

#### Tab: Settings

**Purpose**: Configure visualization and machine settings

**Sections**:

1. **Visualization Settings**:
   - Activation Heatmap toggle (on/off)
   - Shows vector activation patterns

2. **Auto-Refresh Settings**:
   - Enable/disable toggle
   - Interval selection (1s, 2s, 5s, 10s)
   - Automatically refreshes graph data

3. **Machine Information** (read-only):
   - Machine ID (monospace font)
   - Sequence count
   - Vector count

4. **Danger Zone** (custom machines only):
   - Delete Machine button
   - Shows confirmation dialog
   - Navigates to Selection View after deletion

---

## Dialogs

### Machine Create Dialog

**Trigger**: Click "+ New Machine" button in Selection View
**Size**: 500×600px modal
**Overlay**: Dark backdrop with blur

**Form Fields**:
1. **Name** (required)
   - Single line text input
   - Validation: Cannot be empty

2. **Description** (optional)
   - Multi-line textarea (4 rows)
   - Resizable

**Actions**:
- **Cancel**: Closes dialog without saving
- **Create Machine**: Validates and creates new machine
- **Close (×)**: Same as Cancel

**Behavior**:
- Click outside dialog → No action (must use buttons)
- Escape key → Closes dialog
- After creation → Refreshes machine list, closes dialog

### Machine Edit Dialog

**Trigger**: Click "Edit" button on machine card
**Size**: 500×600px modal
**Pre-filled**: Current machine name and description

**Form Fields**:
1. **Name** (required)
   - Pre-filled with current name

2. **Description** (optional)
   - Pre-filled with current description

**Additional Displays**:
- Example badge (if applicable, with info message)
- Machine statistics (read-only grid)

**Actions**:
- **Cancel**: Closes without saving changes
- **Save Changes**: Updates machine, refreshes list
- **Close (×)**: Same as Cancel

**Behavior**:
- Example machines: Can edit metadata but cannot delete
- Validation: Name cannot be empty
- After save → Refreshes machine list, closes dialog

---

## User Workflows

### Workflow 1: Browse and Select Machine

**Entry Path**: Application Launch or Manual Navigation

```
1. Application loads
   ↓
2. Checks localStorage for lastViewedMachineId
   ↓
3a. If found → Loads machine → Administration View
3b. If not found → Selection View

[From Selection View]
4. User browses machine library
   ↓
5. Uses search/filter/sort to find machine
   ↓
6. Clicks machine card
   ↓
7. Administration View opens with full-screen graph
   ↓
8. Machine ID saved to localStorage
```

**Click Responses**:
- **Card click**: Instant navigation, loading indicator during machine load
- **Hover**: Card lifts (4px), shadow effect, edit/delete buttons appear
- **Filter tabs**: Immediate grid re-filtering with fade transition
- **Sort dropdown**: Immediate re-ordering

### Workflow 2: Run Simulated Input Stream

**Entry Path**: Machine Administration View → Simulation Tab

```
1. Open Floating Control Panel (click to expand)
   ↓
2. Click "Simulation" tab
   ↓
3. Input vectors already loaded (from machine setup)
   ↓
4. Click "Play" button (green)
   ↓
5. Graph animates: nodes turn green, edges animate
   ↓
6. Status shows "Playing", progress advances
   ↓
7. (Optional) Click "Pause" to pause
   ↓
8. (Optional) Click "Step" to manually advance
   ↓
9. Click "Stop" to end simulation
   ↓
10. Click "Reset" to return to initial state
```

**Click Responses**:
- **Play**: Button changes to "Pause", status dot turns green, animation starts
- **Pause**: Button changes to "Resume", status dot turns orange, animation freezes
- **Step**: Graph advances one vector, disabled during playback
- **Stop**: Animation stops, button states reset
- **Reset**: Graph returns to initial state, progress bar clears
- **Speed buttons**: Selected button highlights blue, speed changes immediately

### Workflow 3: Add New Critical Event Sequence

**Status**: Not yet implemented in current UI
**Planned Location**: Sequences tab → "+ Add Sequence" button

**Planned Flow**:
```
1. Open Sequences tab in Floating Control Panel
   ↓
2. Click "+ Add Sequence" button
   ↓
3. Opens "Create Sequence" dialog
   ↓
4. Enter sequence name
   ↓
5. Define initial vectors
   ↓
6. Add transitions and outputs
   ↓
7. Click "Save Sequence"
   ↓
8. Sequence added to machine, graph updates
```

---

## Keyboard Shortcuts

Currently, the UI is mouse-driven. Planned keyboard shortcuts:

- `Esc`: Close open dialog
- `Ctrl/Cmd + N`: New machine (from Selection View)
- `Space`: Play/Pause simulation (from Administration View)
- `Arrow Right`: Step forward (when paused)
- `R`: Reset simulation
- `Ctrl/Cmd + B`: Back to Selection View

---

## Visual Feedback System

### Hover States
- **Machine Cards**: Scale 1.05, enhanced shadow
- **Buttons**: Background color change, cursor pointer
- **Nav elements**: Color brightening

### Active States
- **Tabs**: Blue background
- **Filters**: Blue background
- **Sort selection**: Highlighted in dropdown

### Loading States
- **Machine load**: Loading spinner overlay
- **Dialog submit**: Button shows "Creating..." or "Saving..."
- **API calls**: Disabled buttons during operation

### Error States
- **Validation errors**: Red border on input, error message below
- **API errors**: Red notification banner (top-center)
- **Delete confirmation**: Modal dialog with warning styling

### Success States
- **Machine created**: Appears in grid, dialog closes
- **Machine updated**: Refreshes in grid, dialog closes
- **Simulation events**: Activity feed entries (green = success)

---

## Accessibility Features

- **Color Coding**: Accompanied by shapes and labels (not color-only)
- **Contrast**: WCAG AA compliant (dark theme optimized)
- **Focus Indicators**: Visible keyboard focus rings
- **Screen Reader**: Semantic HTML with ARIA labels
- **Responsive**: Adapts to different screen sizes (1280px+ recommended)

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Recommended**: Latest Chrome or Firefox for optimal performance.

---

## Performance Considerations

### Large Machines
- Machines with >50 sequences may have rendering lag
- Use sequence expansion limit (max 3 simultaneous)
- Consider filtering by active sequences

### Simulation Speed
- Lower speeds (100ms) recommended for debugging
- Higher speeds (2000ms) for overview demonstration
- Graph updates may lag with >1000 vectors

### Browser Memory
- Each machine loads all sequences into memory
- Recommended: Close unused browser tabs
- Refresh if graph becomes unresponsive

---

## Common Issues and Solutions

### Machine Won't Load
- **Check**: Backend API running on port 3000
- **Check**: Browser console for errors
- **Try**: Refresh page, clear localStorage

### Graph Not Updating
- **Check**: Auto-refresh setting in Settings tab
- **Check**: WebSocket connection status
- **Try**: Manual refresh, restart Docker containers

### Simulation Not Playing
- **Check**: Input vectors loaded (shown in Simulation tab)
- **Check**: Simulation state (must be stopped to play)
- **Try**: Reset simulation, reload machine

### Dialog Won't Close
- **Try**: Click Cancel or Close (×) button
- **Try**: Press Escape key
- **Last Resort**: Refresh page (loses unsaved changes)

---

## Best Practices

### Machine Organization
- Use descriptive names (e.g., "Login Flow V2" vs "Machine 1")
- Add detailed descriptions
- Tag examples appropriately

### Simulation Testing
- Start with Step mode to understand behavior
- Use 500ms speed for demonstrations
- Reset between test runs

### Performance
- Collapse sequences you're not inspecting
- Use filter tabs to narrow focus
- Close panel when only viewing graph

### Workflow Efficiency
- Let the app remember your last machine
- Use search for quick machine finding
- Bookmark http://localhost:5173 for instant access

---

## Future Enhancements

Planned features for upcoming releases:

- **Sequence Builder**: Visual editor for creating sequences
- **Machine Templates**: Pre-configured machine patterns
- **Export/Import**: Save machines as JSON files
- **Collaboration**: Share machines via URL
- **History**: View simulation result history
- **Annotations**: Add notes to sequences and vectors
- **Dark/Light Theme**: Toggle UI theme
- **Keyboard Navigation**: Full keyboard control

---

## Support and Feedback

For issues or feature requests:
- GitHub: [Reality Engine Issues](https://github.com/jateeter/RealityEngine_AI/issues)
- Documentation: See README.md for technical details
- API Reference: See API_ENDPOINTS_GUIDE.md

---

**Last Updated**: January 2, 2026
**Version**: 2.0.0 (UI/UX Redesign)
