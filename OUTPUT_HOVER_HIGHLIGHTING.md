# Output Hover Highlighting Feature

## Overview

Interactive feature that allows users to hover over final event nodes in the graph visualization to automatically highlight and scroll to their corresponding output vectors in the output stream history.

## User Interaction

### Hover Behavior

When the user hovers their mouse over a **final event node** (a node with output vectors):

1. **Auto-Scroll**: The output stream history panel automatically scrolls to display the output vector produced by that final event
2. **Visual Highlight**: The corresponding output in the history is highlighted with:
   - Purple gradient background (`#a855f7` → `#8b5cf6`)
   - Thicker purple border (3px solid `#c084fc`)
   - Strong purple glow shadow (`0 0 30px rgba(168, 85, 247, 0.6)`)
   - Subtle scale-up effect (1.05x)

3. **Clear on Mouse Out**: When the mouse leaves the node, the highlight is cleared and the output returns to normal styling

### Requirements

The feature only activates when ALL of the following are true:
- Node has `hasOutput: true` (is a final event)
- Node has `lastOutputVector` (has produced an output)
- Output has a valid `id` field

## Implementation

### State Management

**File**: `/visualizer/frontend/src/store.ts`

Added new state field:
```typescript
highlightedOutputId: string | null;
```

Added new action:
```typescript
setHighlightedOutputId: (outputId: string | null) => void;
```

### Graph View Integration

**File**: `/visualizer/frontend/src/components/CriticalEventGraphView.tsx`

Added mouseover handlers to graph nodes:

```typescript
node
  .on('mouseover', (_event, d) => {
    // Only highlight if this is a final event with an output
    if (d.hasOutput && d.lastOutputVector && d.lastOutputVector.id) {
      setHighlightedOutputId(d.lastOutputVector.id);
    }
  })
  .on('mouseout', () => {
    setHighlightedOutputId(null);
  });
```

### Output Stream Visualization

**File**: `/visualizer/frontend/src/components/OutputStreamVisualization.tsx`

#### Added Props
```typescript
interface OutputStreamVisualizationProps {
  outputVectors: OutputVector[];
  maxVisible?: number;
  highlightedOutputId?: string | null;  // NEW
}
```

#### Auto-Scroll Implementation
```typescript
const outputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

// Auto-scroll to highlighted output when it changes
useEffect(() => {
  if (highlightedOutputId && historyRef.current) {
    const outputElement = outputRefs.current.get(highlightedOutputId);
    if (outputElement) {
      outputElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }
}, [highlightedOutputId]);
```

#### Visual Highlighting
```typescript
const renderOutputCard = (output: OutputVector, isCurrent: boolean, index?: number) => {
  const isHighlighted = highlightedOutputId === output.id;

  return (
    <div
      ref={(el) => {
        if (el && output.id) {
          outputRefs.current.set(output.id, el);
        }
      }}
      style={{
        background: isHighlighted
          ? 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)'
          : isCurrent
          ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
          : '#334155',
        border: isHighlighted
          ? '3px solid #c084fc'
          : isCurrent
          ? '2px solid #fbbf24'
          : '1px solid #475569',
        boxShadow: isHighlighted
          ? '0 0 30px rgba(168, 85, 247, 0.6)'
          : isCurrent
          ? '0 0 20px rgba(245, 158, 11, 0.4)'
          : 'none',
        transform: isHighlighted ? 'scale(1.05)' : 'scale(1)'
      }}
    >
      {/* Output content */}
    </div>
  );
};
```

### Container View Integration

**File**: `/visualizer/frontend/src/components/MachineContainerView.tsx`

Passed the highlighted state to the output visualization:

```typescript
const { highlightedOutputId } = useVisualizerStore();

<OutputStreamVisualization
  outputVectors={filteredOutputs}
  maxVisible={10}
  highlightedOutputId={highlightedOutputId}
/>
```

## Visual Design

### Color Scheme

**Highlighted Output**:
- Background: Purple gradient (`#a855f7` → `#8b5cf6`)
- Border: Light purple (`#c084fc`), 3px
- Glow: Strong purple shadow
- Scale: 1.05x

**Current Output** (most recent):
- Background: Orange gradient (`#f59e0b` → `#d97706`)
- Border: Yellow (`#fbbf24`), 2px
- Glow: Moderate orange shadow
- Scale: 1.0x

**History Output** (previous):
- Background: Dark slate (`#334155`)
- Border: Gray (`#475569`), 1px
- Glow: None
- Scale: 1.0x

### Transitions

All styling transitions use:
```css
transition: all 0.3s ease
```

This ensures smooth visual feedback when:
- Highlighting appears
- Highlighting disappears
- Scrolling occurs

## Use Cases

### 1. Debugging State Progression
User can hover over final events to see exactly what output each one produced and when it appears in the machine's output stream.

### 2. Understanding Output Sources
When multiple sequences produce outputs, hovering over different final events reveals which sequence contributed which outputs.

### 3. Timeline Navigation
Provides quick navigation through output history by hovering over the visual graph representation rather than scrolling manually.

### 4. Output Correlation
Links the graph visualization directly to the output stream, making it easy to understand the relationship between vector matching and output generation.

## Performance Considerations

- **Ref Map**: Uses a Map to store DOM references for efficient lookup
- **Smooth Scroll**: Uses native `scrollIntoView` with smooth behavior
- **Minimal Re-renders**: Only re-renders affected components when highlighted ID changes
- **Event Delegation**: Hover handlers attached to nodes, not individual elements

## Browser Compatibility

- **scrollIntoView**: Supported in all modern browsers
- **Smooth scrolling**: May fall back to instant scroll in older browsers
- **CSS transforms**: Widely supported

## Future Enhancements

Potential improvements:
1. Add tooltip showing output details on hover
2. Implement click-to-pin highlighting (stays highlighted until clicked again)
3. Add keyboard navigation (arrow keys to cycle through outputs)
4. Show connection line from node to highlighted output
5. Support highlighting multiple outputs from the same final event

---

**Date**: 2026-01-31
**Version**: 1.0.1
**Status**: Deployed
