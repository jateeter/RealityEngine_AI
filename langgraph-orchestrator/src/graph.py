"""
LangGraph orchestration for regex matching via the Reality Engine (CES) +
Perception Engine pipeline.

┌─────────────────────────────────────────────────────────────────────────────┐
│  LangGraph ↔ Perception Engine ↔ Reality Engine — Data-flow diagram         │
│                                                                              │
│  INITIALIZE                                                                  │
│  ──────────                                                                  │
│  regex pattern ──► compile_pattern() ──► CES machine JSON                   │
│       │                                        │                            │
│       │                     RealityEngineClient.import_machine()             │
│       │                        POST /api/machines/json/import               │
│       │                             RE assigns machine_id                   │
│       │                        machines[pattern] = machine_id  ──► State    │
│       │                                                                      │
│  PerceptionClient.add_sensor_source(offset=200, length=38)                  │
│    POST /api/sources  →  PE creates source at cells [200:238]               │
│    sensor_id, sensor_uuid  ──► State                                        │
│                                                                              │
│  PROCESS_CHAR  (loops once per character in input_text)                     │
│  ──────────────                                                              │
│  input_text[char_index]  ──► char_to_region_vector(ch)                      │
│    'h'  →  [0,0,0,0,0,0,0,1,0,...,0]  (38 cells, one-hot at slot 7)        │
│                │                                                             │
│  PerceptionClient.push_char(sensor_id, ch)                                  │
│    POST /api/sensors/{sensor_id}  { values: [0,...,1,...,0] }               │
│    PE writes to cells [200:238] of its internal vector buffer               │
│                │                                                             │
│  PerceptionClient.push()                                                    │
│    POST /api/push                                                            │
│    PE assembles full 256-cell perceptual vector                             │
│    PE → RE: POST /api/perceive  { vector: [0,...,1,...,0,...,0] }           │
│              RE runs PerceptualSpaceSimulator.processImmediate()            │
│              Each pending CES vector checks: does cell 200+slot == 1.0?    │
│              On match: dequeue vector, fire output, enqueue nextVectorIds   │
│    push_result.step.machineResults[machine_id].outputVector                 │
│              null        → DFA not in accepting state → no match            │
│              [1.0]       → DFA reached accepting state → MATCH              │
│                │                                                             │
│  extract_matches(push_result, machines)  →  {pattern: bool}                 │
│    match_log += [{char_index, char, pattern, matched, …}]  ──► State       │
│    char_index += 1  ──► State                                               │
│                                                                             │
│  FINALIZE                                                                   │
│  ────────                                                                   │
│  match_log  →  results = {pattern: [char_indices where matched==True]}      │
│  Cleanup: delete machines from RE, remove sensor source from PE             │
│  results + summary  ──► State (final output to caller)                     │
└─────────────────────────────────────────────────────────────────────────────┘

Perceptual space mapping:
  cells [200:238]  — character input region (38 cells, one-hot encoded)
    [200:226]      — a-z  (slot 0-25)
    [226:236]      — 0-9  (slot 26-35)
    [236]          — space (slot 36)
    [237]          — EOS sentinel (slot 37)
  cells [238:246]  — match output region (one cell per pattern, up to 8)
    cell 238       — pattern 0 fires here
    cell 239       — pattern 1 fires here
    …

CES machine encoding:
  Each (DFA state q, character c) → DFA state q' transition becomes one
  CES vector with id "vec_{q}_{char_slot}":
    elements[char_slot].value = 1.0  (HIGH — expect the one-hot bit to be set)
    elements[other].value     = 0.0  (LOW  — expect those cells to be 0.0)
    isInitial = (q == dfa_start)     (start-state vectors are always armed)
    nextVectorIds = all outgoing vectors of q'
    outputVectors = [{vector:[1.0]}] if q' in accepting_states else []

LangGraph mechanics used:
  match_log: Annotated[list, operator.add]
    → reducer automatically appends each step's entries without merge conflicts
  should_continue conditional edge
    → loops process_char exactly len(input_text) times then falls through to finalize
  initialize → process_char edge (deterministic — always runs at least one char)
"""

from __future__ import annotations

import uuid
from typing import Annotated, Optional
import operator

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from .regex_compiler import compile_pattern
from .clients import RealityEngineClient, PerceptionClient
from .vector_encoding import CHAR_TO_IDX, CHAR_REGION_OFFSET, CHAR_REGION_LENGTH

# ── State schema ──────────────────────────────────────────────────────────────

class RegexOrchestratorState(TypedDict, total=False):
    # ── Inputs (set once before graph invocation) ──────────────────────────
    patterns: list[str]          # regex patterns to search for
    input_text: str              # text to search
    perception_url: str          # Perception Engine base URL
    reality_url: str             # Reality Engine base URL
    verbose: bool                # print step-by-step PE↔RE trace to stdout

    # ── Internal state ─────────────────────────────────────────────────────
    machines: dict[str, str]     # {pattern: machine_id} — set in initialize
    sensor_id: Optional[str]     # sensor sensorId written to PE — set in initialize
    sensor_uuid: Optional[str]   # PE source list UUID (for cleanup)
    char_index: int              # current character position

    # ── Accumulators (LangGraph reducer: appended per step, never overwritten)
    match_log: Annotated[list[dict], operator.add]
    # Each match_log entry captures both the LangGraph-side result AND the raw
    # PE→RE exchange so callers can inspect exactly what the engines received
    # and returned:
    #   {
    #     char_index   : int    — position in input_text
    #     char         : str    — the character processed this step
    #     pattern      : str    — the regex pattern being tracked
    #     matched      : bool   — True if RE fired outputVector=[1.0] this step
    #     global_step  : int    — PE's global step counter
    #     machine_id   : str    — RE's UUID for this pattern's CES machine
    #     char_slot    : int    — one-hot slot within [200:238] (0–37)
    #     perceptual_cell : int — absolute perceptual-space cell that fired (200+slot)
    #     output_vector: list   — raw outputVector from RE machineResults (null → [])
    #     input_region : dict   — {offset, length} of the machine's input region in PE vector
    #     output_region: dict   — {offset, length} of the machine's output region in PE vector
    #   }

    # ── Outputs (set in finalize) ───────────────────────────────────────────
    results: dict[str, list[int]]  # {pattern: [match end-positions]}
    summary: str                   # human-readable summary

    # ── Error ──────────────────────────────────────────────────────────────
    error: Optional[str]


# ── Node: initialize ──────────────────────────────────────────────────────────

def initialize(state: RegexOrchestratorState) -> dict:
    """
    1. Compile each pattern to a CES machine JSON
    2. Import machines into the Reality Engine
    3. Register a sensor source in the Perception Engine
    4. Ensure PE matchAlgorithm = "gte"
    """
    patterns = state.get('patterns', [])
    if not patterns:
        return {'error': 'No patterns provided'}

    input_text = state.get('input_text', '')
    if not input_text:
        return {'error': 'No input_text provided'}

    re_url = state.get('reality_url', 'http://localhost:3000')
    pe_url = state.get('perception_url', 'http://localhost:3004')

    re_client = RealityEngineClient(base_url=re_url)
    pe_client = PerceptionClient(base_url=pe_url)

    machines: dict[str, str] = {}

    verbose = state.get('verbose', False)

    try:
        # -- Verify connectivity -----------------------------------------
        re_client.health()
        pe_client.health()

        # -- Compile + load machines into Reality Engine -----------------
        #    Each pattern becomes a CES machine (DFA encoded as GTE vectors)
        #    RE assigns a UUID (machine_id) used in every subsequent machineResults lookup
        for idx, pattern in enumerate(patterns):
            ces_json = compile_pattern(pattern, idx)
            n_states = ces_json['machine']['metadata']['dfa_states']
            n_vectors = len(ces_json['machine']['sequences'][0]['vectors'])
            resp = re_client.import_machine(ces_json)
            machine_id: str = resp['machine']['id']
            machines[pattern] = machine_id
            if verbose:
                out_cell = 238 + idx
                print(f"  [RE] loaded '{pattern}' → machine_id={machine_id[:8]}…"
                      f"  DFA states={n_states}  CES vectors={n_vectors}"
                      f"  input=[200:238]  output=[{out_cell}:{out_cell+1}]")

        # -- Register sensor source in Perception Engine -----------------
        #    Source covers cells [200:238] — the 38-cell one-hot character region
        sensor_id = f"regex-input-{uuid.uuid4().hex[:8]}"
        source = pe_client.add_sensor_source(sensor_id=sensor_id)
        source_uuid: str = source.get('id', sensor_id)
        if verbose:
            print(f"  [PE] sensor source '{sensor_id}' → uuid={source_uuid[:8]}…"
                  f"  region=[200:238]  (38-cell one-hot char encoding)")

        # -- Set matchAlgorithm = "gte" on PE ----------------------------
        pe_client.set_match_algorithm('gte')
        if verbose:
            print(f"  [PE] matchAlgorithm = gte  "
                  f"(value 1.0 → expect HIGH ≥ 0.5; value 0.0 → expect LOW < 0.5)")

    except Exception as exc:
        return {'error': f'Initialization failed: {exc}'}
    finally:
        re_client.close()
        pe_client.close()

    return {
        'machines': machines,
        'sensor_id': sensor_id,
        'sensor_uuid': source_uuid,
        'char_index': 0,
        'match_log': [],
    }


# ── Node: process_char ────────────────────────────────────────────────────────

def process_char(state: RegexOrchestratorState) -> dict:
    """
    Process one character from input_text.

    PE↔RE exchange per step:
      1. char_to_region_vector(ch)
            → 38-cell one-hot list, e.g. 'h' → slot 7 → cell 207 fires
      2. PerceptionClient.push_char(sensor_id, ch)
            → POST /api/sensors/{sensor_id}  { values: [0,…,1,…,0] }
            → PE writes the 38 values into cells [200:238] of its vector buffer
      3. PerceptionClient.push()
            → POST /api/push
            → PE assembles full 256-cell vector, POST /api/perceive to RE
            → RE.processImmediate(): for every pending CES vector, checks GTE match
                  if cell[200+slot] == 1.0 AND all other cells == 0.0 → match
                  on match: dequeue vector, fire outputVectors, enqueue nextVectorIds
            → returns PushResult with step.machineResults[machine_id]
      4. extract_matches(push_result, machines)
            → reads outputVector per machine: [1.0] = match, null/[] = no match
      5. Append to match_log (LangGraph reducer accumulates across all steps)
    """
    idx = state.get('char_index', 0)
    text = state.get('input_text', '')
    ch = text[idx]
    verbose = state.get('verbose', False)

    sensor_id: str = state['sensor_id']
    machines: dict[str, str] = state.get('machines', {})

    pe_url = state.get('perception_url', 'http://localhost:3004')
    pe_client = PerceptionClient(base_url=pe_url)

    # Compute one-hot encoding metadata for trace/log
    char_slot = CHAR_TO_IDX.get(ch, -1)
    perceptual_cell = CHAR_REGION_OFFSET + char_slot if char_slot >= 0 else -1

    new_entries: list[dict] = []

    try:
        # ── Step 1+2: encode char and write to PE sensor ───────────────────
        pe_client.push_char(sensor_id, ch)

        # ── Step 3: trigger assembled-vector push → RE processImmediate ────
        push_result = pe_client.push()

        # ── Step 4: read per-machine match results from RE response ─────────
        matches = PerceptionClient.extract_matches(push_result, machines)
        machine_results_raw = push_result.get('step', {}).get('machineResults', {})
        global_step = push_result.get('globalStep')

        # ── Step 5: build match_log entries with full PE↔RE context ─────────
        for pattern, matched in matches.items():
            mid = machines[pattern]
            raw = machine_results_raw.get(mid, {})
            entry = {
                # LangGraph-side fields
                'char_index':   idx,
                'char':         ch,
                'pattern':      pattern,
                'matched':      matched,
                'global_step':  global_step,
                # PE↔RE bridge fields — makes the association explicit
                'machine_id':      mid,
                'char_slot':       char_slot,
                'perceptual_cell': perceptual_cell,
                'output_vector':   raw.get('outputVector') or [],
                'input_region':    raw.get('inputRegion', {'offset': CHAR_REGION_OFFSET,
                                                            'length': CHAR_REGION_LENGTH}),
                'output_region':   raw.get('outputRegion', {}),
            }
            new_entries.append(entry)

        # ── Verbose trace output ─────────────────────────────────────────────
        if verbose:
            slot_str = f"slot {char_slot}/38 → cell {perceptual_cell}" if char_slot >= 0 else "unsupported char"
            print(f"  step {idx:3d} | '{ch}'  {slot_str}")
            for entry in new_entries:
                fired = "✓ MATCH" if entry['matched'] else "·"
                ov = entry['output_vector']
                print(f"           [{entry['pattern']!r:20s}]  "
                      f"machine={entry['machine_id'][:8]}…  "
                      f"outputVector={ov}  {fired}")

    except Exception as exc:
        return {
            'error': f'Error at char_index={idx} (char={ch!r}): {exc}',
            'char_index': idx + 1,
        }
    finally:
        pe_client.close()

    return {
        'match_log': new_entries,   # appended by LangGraph's operator.add reducer
        'char_index': idx + 1,
    }


# ── Conditional edge: should_continue ─────────────────────────────────────────

def should_continue(state: RegexOrchestratorState) -> str:
    """Route: loop back to process_char if more characters remain; else finalize."""
    if state.get('error'):
        return 'finalize'
    idx = state.get('char_index', 0)
    text = state.get('input_text', '')
    if idx < len(text):
        return 'process_char'
    return 'finalize'


# ── Node: finalize ────────────────────────────────────────────────────────────

def finalize(state: RegexOrchestratorState) -> dict:
    """
    Aggregate the match_log into a {pattern: [positions]} dict and
    produce a human-readable summary.

    Also removes the sensor source and loaded machines from the engines
    so the system is back to a clean state.
    """
    match_log: list[dict] = state.get('match_log', [])
    patterns: list[str] = state.get('patterns', [])
    machines: dict[str, str] = state.get('machines', {})
    sensor_uuid: Optional[str] = state.get('sensor_uuid')

    # Aggregate: collect character positions where each pattern fired
    results: dict[str, list[int]] = {p: [] for p in patterns}
    for entry in match_log:
        if entry.get('matched'):
            results[entry['pattern']].append(entry['char_index'])

    # Cleanup: remove sensor source and loaded machines
    pe_url = state.get('perception_url', 'http://localhost:3004')
    re_url = state.get('reality_url', 'http://localhost:3000')
    pe_client = PerceptionClient(base_url=pe_url)
    re_client = RealityEngineClient(base_url=re_url)
    try:
        if sensor_uuid:
            pe_client.remove_source(sensor_uuid)
        for machine_id in machines.values():
            try:
                re_client.delete_machine(machine_id)
            except Exception:
                pass  # best-effort cleanup
    except Exception:
        pass
    finally:
        pe_client.close()
        re_client.close()

    # Build summary
    input_text = state.get('input_text', '')
    lines = [
        f"Input: {input_text!r}  ({len(input_text)} chars)",
        "",
    ]
    for pattern in patterns:
        positions = results[pattern]
        if positions:
            # Show matches with surrounding context
            snippets = []
            for pos in positions:
                start = max(0, pos - 8)
                snippet = input_text[start:pos + 1]
                snippets.append(f"…{snippet!r} @{pos}")
            lines.append(f"  Pattern {pattern!r}: {len(positions)} match(es)")
            for s in snippets[:5]:
                lines.append(f"    {s}")
            if len(snippets) > 5:
                lines.append(f"    … ({len(snippets) - 5} more)")
        else:
            lines.append(f"  Pattern {pattern!r}: no matches")

    summary = "\n".join(lines)

    return {
        'results': results,
        'summary': summary,
    }


# ── Graph construction ────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """
    Construct and compile the LangGraph StateGraph for regex orchestration.

    Topology:
      initialize ──► process_char ──►(conditional)──► process_char  (loop)
                                                 └──► finalize ──► END
    """
    graph = StateGraph(RegexOrchestratorState)

    graph.add_node('initialize', initialize)
    graph.add_node('process_char', process_char)
    graph.add_node('finalize', finalize)

    graph.set_entry_point('initialize')

    graph.add_edge('initialize', 'process_char')

    graph.add_conditional_edges(
        'process_char',
        should_continue,
        {
            'process_char': 'process_char',
            'finalize': 'finalize',
        },
    )

    graph.add_edge('finalize', END)

    return graph.compile()


# ── Convenience runner ────────────────────────────────────────────────────────

def run_regex_search(
    patterns: list[str],
    input_text: str,
    perception_url: str = 'http://localhost:3004',
    reality_url: str = 'http://localhost:3000',
    verbose: bool = False,
) -> dict:
    """
    Run the compiled LangGraph and return the final state dict.

    Args:
        patterns:        Regex patterns to search for simultaneously.
        input_text:      Text to search (a-z, 0-9, space; case-insensitive).
        perception_url:  Perception Engine base URL.
        reality_url:     Reality Engine base URL.
        verbose:         Print the step-by-step PE↔RE trace to stdout.

    Returns:
        Final state dict.  Key fields:

        ``results``
            ``{pattern: [char_indices]}``  — positions where each pattern matched.

        ``summary``
            Human-readable match report.

        ``match_log``
            Full trace: one entry per (character × pattern) step, each carrying
            the char, pattern, matched flag, RE machine_id, perceptual cell that
            fired, and the raw outputVector from the Reality Engine.

        ``error``
            Set on failure; ``None`` on success.

    Example::

        result = run_regex_search(
            patterns=['hello', 'world'],
            input_text='say hello to the world today',
            verbose=True,
        )
        print(result['summary'])
        # {'hello': [12], 'world': [22]}
        print(result['results'])

        # Inspect the PE↔RE exchange at each step:
        for entry in result['match_log']:
            if entry['matched']:
                print(f"  '{entry['char']}' at cell {entry['perceptual_cell']} "
                      f"fired machine {entry['machine_id'][:8]}… "
                      f"outputVector={entry['output_vector']}")
    """
    app = build_graph()
    final_state = app.invoke({
        'patterns': patterns,
        'input_text': input_text,
        'perception_url': perception_url,
        'reality_url': reality_url,
        'verbose': verbose,
    })
    return final_state
