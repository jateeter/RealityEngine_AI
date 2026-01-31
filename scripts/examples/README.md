# Reality Engine Examples

This directory contains example scripts demonstrating various use cases of the Reality Engine.

## Available Examples

### 🎛️ RS Flip-Flop (NEW!)
**File**: `rs-flipflop.sh`

A complete implementation of an RS (Reset-Set) flip-flop demonstrating bistable memory and sequential logic.

**Features**:
- 5 distinct states (RESET, SET, HOLD×2, INVALID)
- Demonstrates bistable memory behavior
- State transitions with hold capability
- Complete with test suite

**Quick Start**:
```bash
# Create the flip-flop
./rs-flipflop.sh

# Test it
./test-rs-flipflop.sh
```

**Learn More**: See [RS_FLIPFLOP_QUICKREF.md](RS_FLIPFLOP_QUICKREF.md) or [/docs/examples/RS_FLIPFLOP.md](../../docs/examples/RS_FLIPFLOP.md)

---

### 📊 Multi-Zone 8D
**File**: `multi-zone-8d.sh`

Creates a complex multi-zone monitoring system with 8-dimensional vectors.

**Features**:
- Multiple monitoring zones
- High-dimensional event vectors
- Complex state transitions

**Usage**:
```bash
./multi-zone-8d.sh
```

---

### 🔍 Pattern Recognition
**File**: `pattern-recognition.sh`

Demonstrates pattern matching and recognition using event sequences.

**Usage**:
```bash
./pattern-recognition.sh
```

---

### 🎯 Simple Sequence Creation
**File**: `create-sequence.sh`

Basic example of creating a 2-state critical event sequence via the API.

**Usage**:
```bash
./create-sequence.sh
```

---

### 🔄 Process Input
**File**: `process-input.sh`

Shows how to process input vectors through sequences.

**Usage**:
```bash
./process-input.sh
```

---

### 🎵 Sampler Demo
**File**: `sampler-demo.sh`

Demonstrates sampling and signal processing capabilities.

**Usage**:
```bash
./sampler-demo.sh
```

---

## Getting Started

### Prerequisites

1. **Start Reality Engine**:
   ```bash
   cd /Users/johnt/workspace/GitHub/RealityEngine_AI
   ./scripts/start.sh
   ```

2. **Verify Services**:
   ```bash
   ./scripts/status.sh
   ```

### Running Examples

All examples are executable bash scripts:

```bash
cd /Users/johnt/workspace/GitHub/RealityEngine_AI/scripts/examples

# Make executable (if needed)
chmod +x *.sh

# Run any example
./<example-name>.sh
```

### View in Visualizer

After creating sequences, view them in the visualizer:

```
http://localhost:5173
```

## Example Categories

### 🔧 Digital Logic
- **RS Flip-Flop**: Bistable memory, sequential logic

### 📈 Pattern Recognition
- **Pattern Recognition**: Match and identify patterns

### 🏭 Monitoring & Control
- **Multi-Zone 8D**: Complex monitoring systems

### 🎓 Learning
- **Create Sequence**: Basic API usage
- **Process Input**: Input handling
- **Sampler Demo**: Signal processing

## Creating Your Own Examples

### Template Structure

```bash
#!/bin/bash

# Your Example Name
# Description of what it does

PORT=${PORT:-3000}
API_URL="http://localhost:$PORT/api"

echo "Creating example sequence..."

# Create sequence
curl -X POST $API_URL/sequences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Sequence Name",
    "vectors": [
      {
        "id": "state-1",
        "elements": [
          {"value": 1.0, "comparatorType": "equals"}
        ],
        "isInitial": true,
        "nextVectorIds": ["state-2"],
        "outputVectors": [...]
      }
    ]
  }'
```

## Documentation

- **API Reference**: `/docs/API.md`
- **Sequences Guide**: `/docs/SEQUENCES.md`
- **Examples Index**: `/docs/examples/`

## Testing Examples

Most examples include test scripts:

```bash
# Create the example
./example-name.sh

# Test it (if available)
./test-example-name.sh
```

## Troubleshooting

### Services Not Running
```bash
./scripts/start.sh
./scripts/status.sh
```

### Port Conflicts
```bash
# Use different port
PORT=3001 ./example-name.sh
```

### API Errors
```bash
# Check logs
./scripts/logs.sh

# Health check
curl http://localhost:3000/api/health
```

## Example Data

Example data files are in `/data/`:
- `rs-flipflop.json` - RS flip-flop specification

## Contributing

To add a new example:

1. Create script in `/scripts/examples/`
2. Add documentation in `/docs/examples/`
3. Add test script if applicable
4. Update this README
5. Add reference data to `/data/` if needed

## Resources

### Learning Path

1. **Start Simple**: `create-sequence.sh`
2. **Add Logic**: `rs-flipflop.sh`
3. **Go Complex**: `multi-zone-8d.sh`
4. **Advanced**: `pattern-recognition.sh`

### External Resources

- [Reality Engine Documentation](../../README.md)
- [API Documentation](../../docs/API.md)
- [Digital Logic Basics](https://en.wikipedia.org/wiki/Digital_electronics)
- [Sequential Circuits](https://en.wikipedia.org/wiki/Sequential_logic)

## Quick Links

| Example | Script | Test | Docs | Complexity |
|---------|--------|------|------|------------|
| RS Flip-Flop | [rs-flipflop.sh](rs-flipflop.sh) | [test-rs-flipflop.sh](test-rs-flipflop.sh) | [📖](../../docs/examples/RS_FLIPFLOP.md) | ⭐⭐ |
| Create Sequence | [create-sequence.sh](create-sequence.sh) | - | - | ⭐ |
| Multi-Zone 8D | [multi-zone-8d.sh](multi-zone-8d.sh) | - | - | ⭐⭐⭐ |
| Pattern Recognition | [pattern-recognition.sh](pattern-recognition.sh) | - | - | ⭐⭐⭐ |
| Process Input | [process-input.sh](process-input.sh) | - | - | ⭐ |
| Sampler Demo | [sampler-demo.sh](sampler-demo.sh) | - | - | ⭐⭐ |

## Need Help?

- Check `/docs/` for detailed documentation
- Run `./scripts/status.sh` to verify services
- View `./scripts/logs.sh` for debugging
- Open visualizer at http://localhost:5173

Happy experimenting! 🚀
