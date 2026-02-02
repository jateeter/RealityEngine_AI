# Machine JSON API Documentation

**Version**: 1.0.0
**Date**: 2026-02-02
**Status**: ✅ Complete

---

## Overview

The Machine JSON API provides endpoints for loading, saving, and managing Reality Engine machines using the standardized JSON format. This enables:

- **Loading machines from JSON files** on startup
- **Importing custom machines** via API
- **Exporting machines** to JSON for sharing
- **Listing available** machine definitions

---

## API Endpoints

### 1. List Available Machine JSON Files

**Endpoint**: `GET /api/machines/json/list`

**Description**: Returns a list of all available machine JSON files in the `examples/machines` directory.

**Response**:
```json
{
  "machines": [
    {
      "filename": "RS2.json",
      "name": "RS2",
      "description": "Two-step RS flip-flop with hold state and 2-event sequences",
      "version": "1.0.0",
      "metadata": {
        "category": "digital-logic",
        "author": "Reality Engine",
        "tags": ["flip-flop", "digital-logic", "two-step"]
      },
      "sequenceCount": 2
    }
  ]
}
```

**Example**:
```bash
curl http://localhost:3000/api/machines/json/list
```

---

### 2. Load Machine from JSON File

**Endpoint**: `GET /api/machines/json/:name`

**Description**: Loads a machine from a JSON file in the `examples/machines` directory and adds it to the engine.

**Parameters**:
- `name` (string) - Machine filename (with or without `.json` extension)

**Response**:
```json
{
  "success": true,
  "machine": {
    "id": "uuid",
    "name": "RS2",
    "description": "Two-step RS flip-flop...",
    "sequences": [...],
    "perceptualMapping": {...},
    "isExample": true,
    "createdAt": 1234567890,
    "updatedAt": 1234567890,
    "lastAccessedAt": null
  },
  "message": "Machine \"RS2\" loaded successfully from RS2.json"
}
```

**Example**:
```bash
curl http://localhost:3000/api/machines/json/RS2
```

**Error Responses**:
- `400` - Machine name required
- `404` - Machine JSON file not found
- `500` - Failed to load machine

---

### 3. Import Machine from JSON String

**Endpoint**: `POST /api/machines/json/import`

**Description**: Imports a machine from a JSON string (e.g., uploaded file) and adds it to the engine.

**Request Body**:
```json
{
  "json": "{\"version\":\"1.0.0\",\"machine\":{...}}"
}
```

**Response**:
```json
{
  "success": true,
  "machine": {
    "id": "uuid",
    "name": "Custom Machine",
    ...
  },
  "message": "Machine \"Custom Machine\" imported successfully"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/machines/json/import \
  -H "Content-Type: application/json" \
  -d '{"json": "{...}"}'
```

**Validation**: The JSON is validated before import. Invalid JSON returns:
```json
{
  "error": "Invalid machine JSON",
  "details": [
    "Missing required field: version",
    "Sequence 0: Missing required field: name"
  ]
}
```

---

### 4. Export Machine to JSON

**Endpoint**: `GET /api/machines/:id/export`

**Description**: Exports a machine to JSON format for download or sharing.

**Parameters**:
- `id` (string) - Machine ID
- `pretty` (query param, optional) - Format JSON with indentation (default: `true`)

**Response Headers**:
- `Content-Type`: `application/json`
- `Content-Disposition`: `attachment; filename="MachineName.json"`

**Response Body**: JSON string of the machine

**Example**:
```bash
curl http://localhost:3000/api/machines/abc123/export?pretty=true -o MyMachine.json
```

---

## Integration with Visualizer

The visualizer backend automatically proxies all machine JSON endpoints:

```
Frontend → Visualizer Backend (port 3001) → Reality Engine (port 3000)
```

**Visualizer Endpoints**:
- `GET http://localhost:3001/api/machines/json/list`
- `GET http://localhost:3001/api/machines/json/:name`
- `POST http://localhost:3001/api/machines/json/import`
- `GET http://localhost:3001/api/machines/:id/export`

**WebSocket Broadcasting**: When machines are loaded or imported, the visualizer broadcasts updates to all connected clients:

```javascript
{
  type: 'machine-loaded',
  machine: {...},
  timestamp: 1234567890
}
```

---

## Initialization on Startup

The Reality Engine automatically loads machines from JSON files on startup:

```
Loading example machines from JSON files on startup...
  ✓ RS Flip Flop loaded from RSFlipFlop.json
  ✓ RS2 loaded from RS2.json
  ✓ Multi-Step State Machine loaded from MultiStep.json
  ✓ Data Center Monitoring loaded from DataCenterMonitoring.json
  ✓ Kleene Star Operator loaded from KleeneStar.json

Machine loading complete: 5 loaded, 0 failed
```

**Configuration**: Edit `src/api/routes.ts` to change which machines load on startup:

```typescript
const machinesToLoad = [
  'RSFlipFlop.json',
  'RS2.json',
  'MultiStep.json',
  'DataCenterMonitoring.json',
  'KleeneStar.json'
];
```

---

## Usage Examples

### Load a Machine via API

```javascript
// Load RS2 machine
const response = await fetch('http://localhost:3000/api/machines/json/RS2');
const data = await response.json();

console.log(`Loaded: ${data.machine.name}`);
console.log(`Sequences: ${data.machine.sequences.length}`);
```

### Import a Custom Machine

```javascript
const machineJSON = {
  version: "1.0.0",
  machine: {
    name: "My Custom Machine",
    description: "Custom machine definition",
    arbiterRule: "PASSTHROUGH",
    sequences: [...]
  }
};

const response = await fetch('http://localhost:3000/api/machines/json/import', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ json: JSON.stringify(machineJSON) })
});

const data = await response.json();
console.log(data.message); // "Machine \"My Custom Machine\" imported successfully"
```

### Export a Machine

```javascript
// Get machine ID
const machinesResponse = await fetch('http://localhost:3000/api/machines');
const { machines } = await machinesResponse.json();
const rs2 = machines.find(m => m.name === 'RS2');

// Export to JSON
const exportResponse = await fetch(`http://localhost:3000/api/machines/${rs2.id}/export?pretty=true`);
const json = await exportResponse.text();

// Save to file
fs.writeFileSync('RS2_export.json', json);
```

---

## Programmatic Usage

You can also use the `MachineLoader` service directly in TypeScript:

```typescript
import { MachineLoader } from './services/MachineLoader';
import { readFileSync, writeFileSync } from 'fs';

// Load from JSON file
const json = readFileSync('examples/machines/RS2.json', 'utf8');
const machine = MachineLoader.loadFromJSON(json);
engine.addMachine(machine);

// Save to JSON file
const exportedJSON = MachineLoader.saveToJSON(machine, true);
writeFileSync('MyMachine.json', exportedJSON);

// Validate JSON
const validation = MachineLoader.validate(json);
if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common Error Codes**:
- `400` - Bad Request (missing parameters, invalid JSON)
- `404` - Not Found (machine or file not found)
- `500` - Server Error (loading/parsing failed)

---

## File Format

See [MACHINE_JSON_FORMAT.md](./MACHINE_JSON_FORMAT.md) for the complete JSON schema specification.

---

## Testing

Run the API integration tests:

```bash
# Start the Reality Engine
npm start

# In another terminal, run the tests
node test-api-integration.js
```

**Test Coverage**:
- ✓ List available machine JSON files
- ✓ Load machine from JSON file
- ✓ Get all machines (verify loaded)
- ✓ Export machine to JSON
- ✓ Import machine from JSON string

---

## Files

### Backend Implementation
- `src/services/MachineLoader.ts` - Machine JSON loader/saver service
- `src/api/routes.ts` - API endpoint handlers

### Visualizer Integration
- `visualizer/backend/src/server.ts` - Proxy endpoints and WebSocket broadcasting

### Examples
- `examples/machines/*.json` - Machine JSON files
- `test-machine-loader.js` - Unit tests for MachineLoader
- `test-api-integration.js` - API integration tests

### Documentation
- `docs/MACHINE_JSON_FORMAT.md` - JSON format specification
- `docs/MACHINE_JSON_API.md` - This file (API documentation)

---

**Status**: ✅ Complete and Ready for Use
**Build**: ✅ All tests pass
**Integration**: ✅ Fully integrated with Reality Engine and Visualizer
