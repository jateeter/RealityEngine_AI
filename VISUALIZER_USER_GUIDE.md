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
Full-screen workspace for visualizing, monitoring, and controlling a single machine and its critical event sequences. The view presents a visual metaphor of a machine with **input vectors flowing in**, **internal critical event processing**, and **output vectors flowing out**.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ ← Machines / Machine Name                             [View Mode]   │ ← Top Navigation (60px)
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────────────────────────────┐  ┌──────────┐  │
│ │  INPUT   │  │     MACHINE CONTAINER            │  │  OUTPUT  │  │
│ │  STREAM  │→ │  ┌───────────────────────────┐  │ →│  STREAM  │  │
│ │          │  │  │  Critical Event Sequences │  │  │          │  │
│ │  ┌────┐  │  │  │    (Graph Visualization)  │  │  │  ┌────┐  │  │
│ │  │ V1 │→ │  │  │                           │  │  │→ │ O1 │  │  │
│ │  │ V2 │→ │  │  │   [Active Nodes & Edges]  │  │  │→ │ O2 │  │  │
│ │  │ V3 │→ │  │  │                           │  │  │  └────┘  │  │
│ │  └────┘  │  │  └───────────────────────────┘  │  │          │  │
│ │          │  │                                  │  │          │  │
│ └──────────┘  └──────────────────────────────────┘  └──────────┘  │
│                                 ┌──────────────────────┐            │
│                                 │ Floating Control     │            │
│                                 │ [Overview][Sim]...   │            │
│                                 └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Three-Panel Architecture

The machine view is divided into three synchronized panels that visualize the complete data flow:

#### Left Panel: Input Stream (220px width)
**Visual Design:**
- Blue-themed gradient background (`#0f172a` → `#1e293b`)
- Blue border (`#3b82f6`) indicating input event space
- Vertical queue showing next 5 input vectors

**Contents:**
- **Header**: "→ INPUT STREAM" with current vector position (e.g., "Vector 3 / 10")
- **Vector Queue**: Stack of upcoming vectors to be processed
  - Active vector (currently processing): Blue gradient with glow effect
  - Next vectors: Gray cards showing preview
  - Animated arrow (→) pointing into the machine when playing

**Behavior:**
- Automatically scrolls to show current vector at top
- Pulses and animates during active processing
- Shows vector values in monospace format: `[0.52, 0.79]`

#### Center Panel: Machine Container (Flexible width)
**Visual Design:**
- Dark container with mechanical border (`#475569`)
- Blue glow effect suggesting active machinery
- Internal grid pattern background
- Header showing machine name and status

**Contents:**
- **Machine Header Bar**:
  - Machine name and "Internal State Visualization" label
  - Status indicator (green dot = playing, orange = paused, gray = stopped)
  - Real-time status text

- **Critical Event Graph**:
  - Full ReactFlow visualization of sequences
  - Node colors: Blue (initial), Green (active), Gray (inactive)
  - Edge animations showing transitions
  - Output nodes marked with orange borders

- **Processing Indicator**:
  - Bottom-center overlay when simulation is running
  - Shows "PROCESSING VECTOR N" with animated dot

**Behavior:**
- Graph updates in real-time as vectors are processed
- Nodes light up green when activated
- Edges animate when transitions occur
- Maintains zoom and pan controls

#### Right Panel: Output Stream (220px width)
**Visual Design:**
- Orange-themed gradient background (`#1e293b` → `#0f172a`)
- Orange border (`#f59e0b`) indicating output event space
- Vertical stack showing most recent outputs (up to 10)

**Contents:**
- **Header**: "OUTPUT STREAM →" with total output count
- **Output Queue**: Reverse-chronological list of outputs
  - Most recent output: Orange gradient with glow effect
  - Older outputs: Faded gray cards
  - Animated arrow (→) pointing out of the machine for new outputs

**Output Card Details:**
- **ID**: Output identifier or auto-generated name
- **Vector**: Numerical values in monospace: `[1.00, 0.50]`
- **Metadata**: Optional metadata preview (truncated to 50 chars)
- **Sparkle Effect**: ✨ appears on brand new outputs (< 3 seconds old)

**Behavior:**
- New outputs slide in from the left with animation
- Most recent output highlighted with orange glow
- Auto-scrolls to show latest outputs
- Outputs persist until simulation reset

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

1. **Load Input Vectors** (Always visible):
   - **Load Example Vectors Button** (blue):
     - Pre-configured binary truth table vectors
     - Loads [[0,0], [0,1], [1,0], [1,1]]
     - Default speed: 2000ms delay for easier observation
     - Disabled while simulation is playing

   - **Custom Vector Input** (JSON textarea):
     - Format: Array of arrays, e.g., `[[0,0], [0,1], [1,0], [1,1]]`
     - Placeholder shows example format
     - **Load Custom Vectors** button validates and loads
     - Disabled while simulation is playing
     - Shows error message if JSON is invalid

   - **Reload Capability**:
     - Section remains visible even after vectors are loaded
     - Can reload with different vectors while stopped
     - Cannot change vectors during playback

2. **Status Indicator**
   - Green dot: Playing
   - Orange dot: Paused
   - Gray dot: Stopped
   - Shows current vector index / total

3. **Playback Buttons** (2×2 grid):
   - **Play/Resume** (green): Start or resume simulation
   - **Pause** (orange): Pause without resetting progress
   - **Step** (blue): Advance one vector (disabled while playing)
   - **Stop** (red): Stop and prepare for new run
   - **Reset** (gray): Reset to initial state

4. **Speed Control**:
   - Buttons: 100ms, 500ms, 1000ms, 2000ms
   - Sets delay between vector processing
   - Click to change speed
   - Default: 2000ms for example vectors (slower playback)

5. **Progress Display**:
   - Shows total input vectors loaded
   - Current position in stream
   - Progress bar (blue gradient)

**Interaction Flow**:
```
Load Vectors (Example or Custom) → Play → (Pause/Resume) → Stop → Reset
                                     ↓
                                  Step (manual advance)
                                     ↓
                                  Reload new vectors (if stopped)
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
3. Load input vectors (choose one):
   → Option A: Click "📊 Load Example Vectors" (quick start)
   → Option B: Enter custom JSON vectors in textarea, click "Load Custom Vectors"
   ↓
4. Vectors loaded confirmation:
   - "Total: X vectors" appears
   - Progress section shows vector count
   - Playback controls become enabled
   ↓
5. Click "Play" button (green)
   ↓
6. Graph animates: nodes turn green, edges animate
   ↓
7. Status shows "Playing", progress advances automatically
   ↓
8. (Optional) Click "Pause" to pause simulation
   ↓
9. (Optional) Click "Resume" to continue from pause
   ↓
10. (Optional) Click "Step" to manually advance one vector at a time
   ↓
11. Click "Stop" to end simulation
   ↓
12. Click "Reset" to return to initial state
   ↓
13. (Optional) Reload different vectors and repeat
```

**Click Responses**:
- **Load Example Vectors**: Vectors load instantly, confirmation message appears, controls enable
- **Load Custom Vectors**: JSON is parsed and validated, error shown if invalid, vectors load on success
- **Play**: Button changes to "Pause", status dot turns green, animation starts at 2000ms intervals
- **Pause**: Button changes to "Resume", status dot turns orange, animation freezes at current vector
- **Resume**: Animation continues from paused position
- **Step**: Graph advances one vector, progress increments, disabled during playback
- **Stop**: Animation stops, button states reset, ready for new playback
- **Reset**: Graph returns to initial state, progress bar clears, vector index resets to 0
- **Speed buttons**: Selected button highlights blue, speed changes take effect immediately

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
