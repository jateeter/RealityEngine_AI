# Machine View Button - Visual Indicator

**Date:** 2026-01-01

## Overview

Added a prominent **"🤖 Machine View"** button that appears when viewing a machine, providing clear visual feedback that all sequences are being displayed together.

---

## Button Features

### Visual Design

The Machine View button appears in the **top-right corner** of the graph when a machine is loaded:

```
┌──────────────────────────────────────────────┐
│                           🤖 Machine View     │
│                     Multi-Step State Machine  │
│                         (2 sequences)         │
│                                               │
│  [Graph showing all sequences together]       │
│                                               │
└──────────────────────────────────────────────┘
```

### Styling

- **Position:** Top-right corner, overlaid on graph
- **Background:** Purple gradient (#6366f1 → #8b5cf6)
- **Border:** 2px solid light purple (#a78bfa)
- **Shadow:** Glowing purple shadow for emphasis
- **Status Indicator:** Pulsing green dot (animated)
- **Hover Effect:** Scales up slightly with enhanced glow

### Information Displayed

1. **🤖 Icon:** Robot emoji indicates machine view
2. **"Machine View" Label:** Clear text indicator
3. **Machine Name:** Shows which machine is loaded
4. **Sequence Count:** Shows number of sequences in the machine

Example display:
```
🤖 Machine View
Multi-Step State Machine (2 sequences)
```

---

## Implementation

### Code Location

**File:** `/visualizer/frontend/src/components/CriticalEventGraphView.tsx`

**Component:**
```tsx
{currentMachine && (
  <div
    style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      zIndex: 100,
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      border: '2px solid #a78bfa',
      borderRadius: '12px',
      padding: '12px 20px',
      boxShadow: '0 8px 24px rgba(139, 92, 246, 0.5)',
      // ... additional styling
    }}
  >
    <div style={{
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      background: '#22c55e',
      boxShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
      animation: 'pulse 2s infinite'
    }} />
    <div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>
        🤖 Machine View
      </div>
      <div style={{ fontSize: '12px', color: '#c4b5fd' }}>
        {currentMachine.name} ({currentMachine.sequenceCount} sequences)
      </div>
    </div>
  </div>
)}
```

### Behavior

**When Visible:**
- Only appears when `currentMachine` is not null
- Automatically shows when loading Multi-Step Sequences example
- Persists while machine is active

**When Hidden:**
- Automatically disappears when machine is unloaded
- Not shown for individual sequence views
- Only shown when a complete machine is loaded

---

## User Experience Flow

### 1. Initial State (No Machine)
```
[Graph showing individual sequences or no selection]
[No Machine View button visible]
```

### 2. Load Machine
User clicks **"🔗 Multi-Step Sequences"** button in sidebar

### 3. Machine View Active
```
┌────────────────────────────────────────┐
│                    ┌──────────────────┐│
│                    │ 🤖 Machine View  ││
│                    │ Multi-Step State ││
│                    │ Machine          ││
│                    │ (2 sequences)    ││
│                    └──────────────────┘│
│                                        │
│  Sequence 1: 000 → 001 → 011 → [01]   │
│  Sequence 2: 100 → 101 → 111 → [10]   │
│                                        │
│  [All 6 events visible together]      │
│                                        │
└────────────────────────────────────────┘
```

### 4. Visual Indicators
- **Pulsing green dot:** Machine is active
- **Machine name:** Identifies which machine is loaded
- **Sequence count:** Shows how many sequences are unified
- **Hover effect:** Button scales up for interactivity

---

## Complete Machine Visualization System

When the Multi-Step Machine is loaded, users see:

### Top Controls (SimulationControls)
```
┌─────────────────────────────────────────────┐
│ [▶ Run Input Sequence] [Stop] [Reset] [...] │
│                                              │
│ 🤖 Machine: Multi-Step State Machine        │
│    (2 sequences, 11 input vectors)           │
└─────────────────────────────────────────────┘
```

### Graph View (CriticalEventGraphView)
```
┌─────────────────────────────────────────────┐
│                    🤖 Machine View  ←─────────── New Button!
│              Multi-Step State Machine        │
│                  (2 sequences)               │
│                                              │
│  ┌───────────────────────────────────────┐  │
│  │ Sequence 1: 000 → 001 → 011 → [01]   │  │
│  │   [000] → [001] → [011]               │  │
│  │                                        │  │
│  │ Sequence 2: 100 → 101 → 111 → [10]   │  │
│  │   [100] → [101] → [111]               │  │
│  └───────────────────────────────────────┘  │
│                                              │
│  [ReactFlow controls: zoom, pan, etc.]      │
└─────────────────────────────────────────────┘
```

### Sidebar
```
┌──────────────────────┐
│ Reality Engine       │
│ ● Connected          │
├──────────────────────┤
│ Statistics           │
│ Sequences: 2         │
│ Vectors: 6           │
│ Active: 6            │
├──────────────────────┤
│ [🎯 Load Demo]       │
│ [🏢 Data Center]     │
│ [🔗 Multi-Step] ← Active
│ [⭐ Kleene Star]     │
├──────────────────────┤
│ SEQUENCES (2)        │
│ ┌──────────────────┐ │
│ │ Sequence 1       │ │
│ │ 000→001→011→[01] │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ Sequence 2       │ │
│ │ 100→101→111→[10] │ │
│ └──────────────────┘ │
└──────────────────────┘
```

---

## Benefits

### 1. Clear Visual Feedback
- Users immediately know they're viewing a machine
- No confusion about whether sequences are related or independent
- Machine name clearly identifies the system

### 2. Status Indicator
- Pulsing green dot shows machine is active
- Animated effects draw attention to the indicator
- Provides at-a-glance confirmation

### 3. Contextual Information
- Machine name explains what the system does
- Sequence count shows complexity
- Positioned prominently but non-intrusively

### 4. Enhanced Discoverability
- New users understand they're viewing a unified system
- Matches the "Run Input Sequence" button terminology
- Reinforces the machine concept throughout the UI

---

## Testing

### Visual Verification ✅

**Tested:**
- ✅ Button appears when machine is loaded
- ✅ Shows correct machine name: "Multi-Step State Machine"
- ✅ Shows correct sequence count: "(2 sequences)"
- ✅ Green dot pulses continuously
- ✅ Hover effect works (scale + shadow)
- ✅ Button disappears when machine is unloaded
- ✅ Position doesn't overlap with controls
- ✅ Responsive and visible on different screen sizes

### Integration ✅

**Verified:**
- ✅ Works with existing SimulationControls machine info
- ✅ Coordinates with "Run Input Sequence" button
- ✅ Doesn't interfere with graph interactions
- ✅ Z-index properly layers above graph, below modals

---

## Comparison: Before vs After

### Before
```
User loads Multi-Step Sequences
→ Graph shows both sequences
→ Not immediately obvious why both are visible
→ Could be confused as separate sequences
```

### After
```
User loads Multi-Step Sequences
→ Graph shows both sequences
→ "🤖 Machine View" button appears prominently ← NEW!
→ Clear indication: "Multi-Step State Machine (2 sequences)"
→ User understands these sequences form a unified system
→ Matches "Run Input Sequence" button in controls
→ Complete machine visualization experience
```

---

## Files Modified

1. `/visualizer/frontend/src/components/CriticalEventGraphView.tsx` - Added Machine View button
2. `/Users/johnt/workspace/idahoApp/realityEngine/MACHINE_VIEW_BUTTON.md` - This documentation

---

## Conclusion

The **"🤖 Machine View"** button provides:
- ✅ Clear visual indicator when viewing a machine
- ✅ Machine name and sequence count display
- ✅ Animated status indicator (pulsing green dot)
- ✅ Elegant hover effects
- ✅ Non-intrusive positioning
- ✅ Automatic show/hide based on machine state

Users now have an explicit, prominent button that confirms they are viewing the machine described by Sequence 1 and Sequence 2 together as a unified system.
