# Regex Pipeline: LangGraph ↔ Perception Engine ↔ Reality Engine

This document is the authoritative mapping of how LangGraph state, nodes, and
reducers correspond to Perception Engine (PE) and Reality Engine (RE) API calls,
data structures, and runtime behaviour in the regex-matching pipeline.

---

## End-to-End Data-Flow Diagram

```
 Python caller
 ─────────────────────────────────────────────────────────────
 run_regex_search(
   patterns=['hello', 'ab+c'],
   input_text='say hello then abc',
 )
   │
   ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  LangGraph  app.invoke(state)                                            │
 │                                                                          │
 │  State fields                          Populated by                      │
 │  ─────────────────────────────────     ────────────────────────────────  │
 │  patterns       ['hello', 'ab+c']      caller                           │
 │  input_text     'say hello then abc'   caller                           │
 │  machines       {}  → {pat: id}        initialize node                  │
 │  sensor_id      None → 'regex-…'       initialize node                  │
 │  char_index     0   → 1 → 2 → …       process_char node (increments)   │
 │  match_log      []  → [...entries]     process_char node (reducer adds) │
 │  results        {}  → {pat: [pos]}     finalize node                    │
 │  summary        ''  → human text       finalize node                    │
 │                                                                          │
 │  ┌─────────────┐    ┌──────────────┐    ┌──────────┐                   │
 │  │  initialize │───►│ process_char │───►│ finalize │──► END             │
 │  └─────────────┘    └──────┬───────┘    └──────────┘                   │
 │                            │◄──────────────┘                            │
 │                      (loops N times,                                     │
 │                       N = len(input_text))                               │
 └──────────────────────────────────────────────────────────────────────────┘
        │                      │                         │
   Reality Engine        Perception Engine          Reality Engine
   import machines        write + push               delete machines
```

---

## Node: `initialize`

### What LangGraph does

Compiles each regex pattern to a CES machine JSON and registers a character
sensor source.

### Exact API calls

```
For each (pattern_idx, pattern) in enumerate(patterns):

  1. compile_pattern(pattern, pattern_idx)
     → regex AST → Thompson NFA → DFA (subset construction) → CES machine JSON

  2. POST {reality_url}/api/machines/json/import
     Body: { "json": "<serialised CES machine JSON>" }
     ← { "success": true, "machine": { "id": "<uuid>", "name": "regex-0-hello", … } }

     State update: machines[pattern] = machine["id"]

After all patterns:

  3. POST {perception_url}/api/sources
     Body: {
       "type":     "sensor",
       "name":     "regex-char-input",
       "sensorId": "regex-input-<random8>",
       "region":   { "offset": 200, "length": 38 },
       "ttlMs":    5000
     }
     ← { "source": { "id": "<uuid>", "sensorId": "regex-input-…", … } }

     State update: sensor_id = body.sensorId
                   sensor_uuid = source.id   (used for cleanup in finalize)

  4. PATCH {perception_url}/api/config
     Body: { "matchAlgorithm": "gte" }
```

### What the Reality Engine stores after step 2

The CES machine JSON encodes the DFA as a flat list of CES vectors, one per
`(DFA state, character)` transition pair.  For pattern `'hello'` the DFA has
5 states (s0…s4) and 26 transitions, producing 26 CES vectors:

```
vec_0_7   isInitial=true   elements[7]=1.0 (char 'h' → slot 7)   nextVectorIds=[vec_1_4]
vec_1_4   isInitial=false  elements[4]=1.0 (char 'e' → slot 4)   nextVectorIds=[vec_2_11]
vec_2_11  isInitial=false  elements[11]=1.0 (char 'l' → slot 11) nextVectorIds=[vec_3_11]
vec_3_11  isInitial=false  elements[11]=1.0 (char 'l' → slot 11) nextVectorIds=[vec_4_14]
vec_4_14  isInitial=false  elements[14]=1.0 (char 'o' → slot 14) outputVectors=[{vector:[1.0]}]
```

`isInitial=true` on start-state vectors means the RE keeps them permanently in
the `pendingActivations` set — they never need to be re-armed, providing
"search anywhere in string" semantics.

### Perceptual-space commitment

```
Perceptual space (256 cells):

  [0:200]   ── unused by this pipeline
  [200:238] ── character input region (38 cells)
               ┌─────────────────────────────────────────┐
               │ slot  0–25 : a–z  (cell 200–225)        │
               │ slot 26–35 : 0–9  (cell 226–235)        │
               │ slot 36    : ' '  (cell 236)            │
               │ slot 37    : EOS  (cell 237)            │
               └─────────────────────────────────────────┘
  [238:246] ── output region (up to 8 pattern slots)
               ┌──────────────────────────────────────────┐
               │ cell 238 : pattern 0 output              │
               │ cell 239 : pattern 1 output              │
               │     …                                    │
               └──────────────────────────────────────────┘
  [246:256] ── unused
```

---

## Node: `process_char`  (loops once per character)

### LangGraph control flow

The conditional edge `should_continue` routes back to `process_char` while
`char_index < len(input_text)`.  The `match_log` field uses `operator.add` as
its LangGraph reducer — every iteration's list is appended without overwriting
prior entries.

### Exact API calls and data transformations

```
char = input_text[char_index]         e.g. 'h' at index 4

Step 1 — encode character
─────────────────────────
char_to_region_vector('h')
  → char_slot = CHAR_TO_IDX['h'] = 7
  → region_vector = [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
                     0,0,0,0,0,0,0,0,0,0,0,0,0,0]
                     (38 floats; 1.0 only at slot 7)

Step 2 — write to PE sensor source
───────────────────────────────────
POST {perception_url}/api/sensors/regex-input-<id>
  Body: { "values": [0,0,0,0,0,0,0,1,0,...,0] }
  PE writes these 38 values into cells [200:238] of its internal vector buffer.

Step 3 — trigger assembled push
────────────────────────────────
POST {perception_url}/api/push
  PE action:
    1. assembleVector():
       walk all registered sources, write each source's current values
       into the corresponding region of the 256-cell vector
    2. POST {reality_url}/api/perceive { vector: [0,…,1(at 207),…,0] }
       RE.processImmediate(vector):
         for each CES vector in pendingActivations:
           evaluate GTE match:
             element.value=1.0 → expect cell[200+slot] >= 0.5 (HIGH check)
             element.value=0.0 → expect cell[200+slot] <  0.5 (LOW check)
           if ALL 38 elements pass:
             dequeue this CES vector
             emit outputVectors (if any)
             enqueue nextVectorIds into pendingActivations
    3. Return PushResult to PE caller

Response:
  {
    "success": true,
    "globalStep": 4,
    "step": {
      "stepNumber": 4,
      "machineResults": {
        "<machine-id-for-hello>": {
          "machineId":    "<uuid>",
          "machineName":  "regex-0-hello",
          "inputVector":  [0,0,0,0,0,0,0,1,0,...],   ← the 38-cell slice PE sent
          "outputVector": null,                        ← null = not yet accepting
          "inputRegion":  { "offset": 200, "length": 38 },
          "outputRegion": { "offset": 238, "length": 1  },
          "transitionResult": { … }
        }
      }
    }
  }
```

### When a match fires (e.g. 'o' at index 8 completes 'hello')

```
CES vector vec_4_14 is in pendingActivations:
  elements[14].value=1.0 → cell[214] must be HIGH
  all other elements[i].value=0.0 → cells[200+i] must be LOW

Input 'o' → region_vector[14]=1.0, all others=0.0  → GTE match ✓

RE fires vec_4_14:
  outputVectors=[{vector:[1.0]}]  → writes 1.0 into output cell 238
  nextVectorIds=[]                → no further DFA state (accepting is terminal here)

PushResult:
  machineResults["<id>"].outputVector = [1.0]   ← MATCH signal

PerceptionClient.extract_matches():
  ov = [1.0], ov[0] >= 0.5  →  matched = True

LangGraph match_log entry appended:
  {
    char_index:      8,          ← position in input_text
    char:            'o',
    pattern:         'hello',
    matched:         True,
    global_step:     8,
    machine_id:      '<uuid>',   ← RE's CES machine UUID
    char_slot:       14,         ← one-hot slot for 'o'
    perceptual_cell: 214,        ← absolute cell that fired (200 + 14)
    output_vector:   [1.0],      ← raw from RE machineResults
    input_region:    { offset: 200, length: 38 },
    output_region:   { offset: 238, length: 1  },
  }
```

### match_log — the LangGraph↔RE bridge in the state

Every iteration of `process_char` returns `{'match_log': [entry, …]}`.
LangGraph's `Annotated[list, operator.add]` reducer appends these lists
across all iterations without the caller needing to manage accumulation.

By the time `finalize` runs, `state['match_log']` contains one entry per
`(char_index × pattern)` combination, each carrying the full PE↔RE context:

```python
for entry in result['match_log']:
    print(
        f"  char={entry['char']!r:3s}  idx={entry['char_index']:3d}  "
        f"cell={entry['perceptual_cell']:3d}  "
        f"pattern={entry['pattern']!r:12s}  "
        f"matched={entry['matched']}  "
        f"outputVector={entry['output_vector']}"
    )
```

---

## Node: `finalize`

### LangGraph → RE/PE cleanup

```python
# Aggregate match positions from the reducer-accumulated match_log
results = {p: [] for p in patterns}
for entry in match_log:
    if entry['matched']:
        results[entry['pattern']].append(entry['char_index'])

# Remove loaded CES machines from Reality Engine
for machine_id in machines.values():
    DELETE {reality_url}/api/machines/{machine_id}

# Remove sensor source from Perception Engine
DELETE {perception_url}/api/sources/{sensor_uuid}
```

### Final state returned to caller

```python
{
  'results':   {'hello': [8, 23], 'ab+c': [35]},
  'summary':   "Input: 'say hello …'\n  Pattern 'hello': 2 match(es)\n  …",
  'match_log': [ … ],   # full per-step PE↔RE trace
  'error':     None,
}
```

---

## CES Vector Matching: GTE Semantics

For a CES vector element `{value, threshold}` and perceptual-space input cell
value `v`:

```
HIGH element (value >= threshold=0.5):  matches when  v >= 0.5
LOW  element (value <  threshold=0.5):  matches when  v <  0.5
```

In the regex pipeline all cells are encoded as one-hot (0.0 or 1.0):

```
Character 'h' (slot 7):
  cell[200+7]  = 1.0 → HIGH → matches any element with value=1.0 ✓
  cell[200+*]  = 0.0 → LOW  → matches any element with value=0.0 ✓

CES vector vec_0_7 for 'DFA state 0 → on char h':
  elements[7].value  = 1.0 (HIGH) → 1.0 >= 0.5  ✓
  elements[*].value  = 0.0 (LOW)  → 0.0 <  0.5  ✓
  → ALL 38 elements pass → CES vector MATCHES → DFA advances
```

A non-matching character (e.g. 'x' after 'hell' when expecting 'o'):
```
  cell[200+23] = 1.0  ('x' is at slot 23)
  CES vec_3_11 expects elements[11]=HIGH (for 'l') and elements[23]=LOW
  elements[23].value=0.0 → expect LOW, but input is 1.0 → MISMATCH
  → vec_3_11 is dequeued (consumed) without firing → DFA resets for that branch
```

---

## Key Constants (src/vector_encoding.py)

| Constant              | Value | Meaning                                   |
|-----------------------|-------|-------------------------------------------|
| CHAR_REGION_OFFSET    | 200   | First cell of the character input region  |
| CHAR_REGION_LENGTH    | 38    | Number of cells: 26 + 10 + 1 + 1         |
| OUTPUT_REGION_OFFSET  | 238   | First output cell (pattern 0 fires here)  |
| OUTPUT_REGION_LENGTH  | 8     | Maximum simultaneous patterns             |
| EOS_IDX               | 37    | Slot index for end-of-string sentinel     |

---

## Running with Verbose Trace

```bash
python examples/run_demo.py --live --trace
```

The `--trace` flag sets `verbose=True` in the LangGraph state.  The
`initialize` node prints the RE machine load summary and PE source creation.
The `process_char` node prints one line per step showing the character, the
perceptual cell that fired, and the RE output vector result.  The final
`_print_match_trace()` function prints a structured table of every
LangGraph ↔ PE ↔ RE match event.

Programmatic access to the same data:

```python
from src.graph import run_regex_search

result = run_regex_search(
    patterns=['cat'],
    input_text='the cat sat',
    verbose=True,          # prints live trace to stdout
)

# Inspect the PE↔RE exchange at every match
for entry in result['match_log']:
    if entry['matched']:
        print(
            f"  '{entry['char']}' at cell {entry['perceptual_cell']} "
            f"fired machine {entry['machine_id'][:8]}… "
            f"outputVector={entry['output_vector']}"
        )
```
