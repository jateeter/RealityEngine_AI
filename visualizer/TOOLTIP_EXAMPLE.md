# Event Tooltip Visual Example

## How It Looks

When you hover over an event node in the D3.js visualization, you'll see a rich tooltip like this:

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ Temperature Sensor Reading              ┃ ← Event Name (blue, bold)
┃ ┌─────────┐ ┌────────┐ ┌────────┐      ┃
┃ │ INITIAL │ │ ACTIVE │ │ OUTPUT │      ┃ ← State Badges
┃ └─────────┘ └────────┘ └────────┘      ┃
┃ ID: sensor-temp-room-a-001              ┃ ← Event ID
┃ Label: Temp Sensor A1                   ┃ ← Label (if different)
┃ Sequence: HVAC Monitoring System        ┃ ← Sequence Name
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ EVENT VECTOR (5 elements)               ┃
┃ ┌────────────────────────────────────┐  ┃
┃ │ [0]  0.750  GREATER_THAN           │  ┃ ← Element 0
┃ │ [1]  1.000  EQUALS                 │  ┃ ← Element 1
┃ │ [2]  0.500  LESS_THAN (threshold:  │  ┃ ← Element 2 with threshold
┃ │              0.25)                  │  ┃
┃ │ [3]  0.333  BETWEEN                │  ┃ ← Element 3
┃ │ [4]  0.125  NOT_EQUALS             │  ┃ ← Element 4
┃ └────────────────────────────────────┘  ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ METADATA                                ┃
┃ type:         sensor-reading            ┃
┃ location:     room-a                    ┃
┃ floor:        3                         ┃
┃ zone:         north-wing                ┃
┃ unit:         celsius                   ┃
┃ threshold:    25.5                      ┃
┃ priority:     high                      ┃
┃ created:      2026-01-20T15:45:00Z     ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ OUTPUT VECTORS (2)                      ┃
┃ ┌────────────────────────────────────┐  ┃
┃ │ #1: temp-alert-high-001            │  ┃
┃ │ [1.00, 0.00, 0.75, 0.50]           │  ┃
┃ │ "High temperature alert"           │  ┃
┃ │ ⏱ 3:45:22 PM                       │  ┃
┃ ├────────────────────────────────────┤  ┃
┃ │ #2: temp-alert-critical-001        │  ┃
┃ │ [1.00, 1.00, 1.00, 1.00]           │  ┃
┃ │ {"severity": "critical",           │  ┃
┃ │  "action": "shutdown"}             │  ┃
┃ │ ⏱ 3:45:23 PM                       │  ┃
┃ └────────────────────────────────────┘  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
      ↑
      Scrollable if content is too long
```

## Color Scheme

### Header Section
- **Event Name**: Bright blue (`#3b82f6`) - Large, bold
- **State Badges**:
  - INITIAL: Blue background, white text
  - ACTIVE: Green background, black text
  - OUTPUT: Orange background, black text
- **ID**: Monospace, gray text
- **Sequence**: Purple text (`#8b5cf6`)

### Event Vector Section
- **Section Title**: Uppercase, muted gray
- **Element Index**: Dark gray `[0], [1], [2]`
- **Element Value**: Bright green (`#22c55e`), bold
- **Comparator**: Light gray text
- **Background**: Dark blue-gray box

### Metadata Section
- **Keys**: Muted gray, aligned left
- **Values**: Light gray, left-padded

### Output Vectors Section
- **Background**: Orange-tinted (`rgba(245, 158, 11, 0.1)`)
- **Border**: Orange left border (`#f59e0b`)
- **Output ID**: Yellow text (`#fbbf24`)
- **Vector**: Monospace, light gray
- **Timestamp**: Small, dark gray

## Interaction Flow

### 1. Mouse Enters Node
```
1. Node expands: radius 15px → 18px
2. Node brightness increases: 1.0 → 1.5
3. Tooltip fades in: opacity 0 → 1 (150ms)
4. Connected links highlighted
5. Connected nodes highlighted
6. Other nodes/links dimmed to 30% opacity
```

### 2. Mouse Hovers
```
- Tooltip remains visible
- Smart positioning keeps tooltip on screen
- Scrollbar appears if content exceeds window height
- All event details displayed
```

### 3. Mouse Leaves Node
```
1. Node shrinks back: radius 18px → 15px
2. Node brightness resets: 1.5 → 1.0
3. Tooltip fades out: opacity 1 → 0 (100ms)
4. All highlights removed
5. All nodes/links restore to 100% opacity
```

## Smart Positioning Examples

### Tooltip Near Right Edge
```
Mouse Position: (1800, 400) on 1920px screen

WITHOUT smart positioning:
┌─────────────────┐
│     Screen      │
│                 │ 🖱️ ┌────────┐
│                 │    │ TOOLTIP│ ← Goes off screen!
│                 │    └────────┘
└─────────────────┘

WITH smart positioning:
┌─────────────────┐
│     Screen      │
│         ┌───────┤ 🖱️
│         │TOOLTIP│
│         └───────┤
└─────────────────┘
```

### Tooltip Near Bottom Edge
```
WITHOUT smart positioning:
┌─────────────────┐
│     Screen      │
│                 │
│              🖱️ │
├─────────────────┤
│ TOOLTIP         │ ← Goes off screen!
└─────────────────┘

WITH smart positioning:
┌─────────────────┐
│     Screen      │
│     TOOLTIP     │
│              🖱️ │
└─────────────────┘
```

## Scrollbar When Content Is Long

```
┏━━━━━━━━━━━━━━━━━┓
┃ Event Name     ┃┃
┃ [BADGES]       ┃┃
┣━━━━━━━━━━━━━━━━━┫┃
┃ VECTOR         ┃┃
┃ [0] 1.000      ┃┃
┃ [1] 0.500      ┃┃  ← Scrollbar appears
┃ [2] 0.750      ┃█    (blue thumb)
┣━━━━━━━━━━━━━━━━━┫█
┃ METADATA       ┃┃
┃ key: value     ┃┃
┃ key: value     ┃┃
┗━━━━━━━━━━━━━━━━━┛┃
                   ▼ Scrollable area
```

## Real-World Example: NAND Gate Event

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ NAND Gate Output                ┃
┃ ┌────────┐ ┌────────┐           ┃
┃ │ ACTIVE │ │ OUTPUT │           ┃
┃ └────────┘ └────────┘           ┃
┃ ID: nand-gate-001               ┃
┃ Sequence: NAND Logic Gate       ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ EVENT VECTOR (2 elements)       ┃
┃ ┌──────────────────────────────┐┃
┃ │ [0]  1.000  EQUALS           │┃
┃ │ [1]  1.000  EQUALS           │┃
┃ └──────────────────────────────┘┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ METADATA                        ┃
┃ type:         logic-gate        ┃
┃ operation:    NAND              ┃
┃ inputs:       2                 ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃ OUTPUT VECTORS (1)              ┃
┃ ┌──────────────────────────────┐┃
┃ │ #1: nand-output-001          │┃
┃ │ [0.00]                       │┃
┃ │ "NAND(1,1) = 0"              │┃
┃ │ ⏱ 3:45:22 PM                 │┃
┃ └──────────────────────────────┘┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Minimal Example: Simple Event

```
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ Simple Event        ┃
┃ ┌─────────┐         ┃
┃ │ INITIAL │         ┃
┃ └─────────┘         ┃
┃ ID: event-001       ┃
┃ Sequence: Test      ┃
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ EVENT VECTOR        ┃
┃ (No elements)       ┃
┗━━━━━━━━━━━━━━━━━━━━━━┛
```

## Animation Timeline

```
Time (ms)    Event
─────────────────────────────────
0           Mouse enters node
            ├─ Node radius: 15 → 18px
            ├─ Node brightness: 1.0 → 1.5
            └─ Tooltip: display=block, opacity=0

10          Tooltip position calculated
            ├─ Check window boundaries
            ├─ Adjust X if near right edge
            ├─ Adjust Y if near bottom edge
            └─ Set max-height based on screen

20          Tooltip content rendered
            ├─ Helper functions format data
            ├─ HTML structure built
            └─ Dimensions calculated

30-180      Fade in transition
            └─ Opacity: 0 → 1 (150ms ease)

180         Tooltip fully visible
            └─ User can read content

---         Mouse leaves node
            ├─ Node radius: 18 → 15px
            ├─ Node brightness: 1.5 → 1.0
            └─ Begin fade out

+100        Tooltip hidden
            └─ display=none
```

## Keyboard Accessibility

While the tooltip is mouse-driven, the visualization itself supports:
- **Zoom**: Scroll wheel
- **Pan**: Click and drag background
- **Node Drag**: Click and drag nodes

Future enhancement could add:
- Tab navigation through nodes
- Enter/Space to "pin" tooltip
- Escape to close pinned tooltip
- Arrow keys to navigate between nodes

## Technical Details

### Tooltip Element Structure
```html
<div style="position: absolute; ...">  <!-- Container -->
  <div style="border-bottom: ...">     <!-- Header -->
    <div>Event Name</div>
    <div>Badges...</div>
    <div>ID...</div>
    <div>Label...</div>
    <div>Sequence...</div>
  </div>

  <div>                                <!-- Event Vector -->
    <div>EVENT VECTOR</div>
    <div style="background: ...">
      Element items...
    </div>
  </div>

  <div>                                <!-- Metadata -->
    <div>METADATA</div>
    Metadata items...
  </div>

  <div>                                <!-- Output Vectors -->
    <div>OUTPUT VECTORS</div>
    <div style="max-height: ...">
      Output items...
    </div>
  </div>
</div>
```

### CSS Classes Applied
- Inline styles (no external CSS classes)
- Dynamic positioning via JavaScript
- Transition properties in style tag

## Browser-Specific Notes

### Chrome/Edge
- Full scrollbar customization
- Smooth animations
- Excellent performance

### Safari
- Full scrollbar customization
- Smooth animations
- Excellent performance

### Firefox
- Uses scrollbar-width property
- Smooth animations
- Excellent performance

All modern browsers fully support all features.
