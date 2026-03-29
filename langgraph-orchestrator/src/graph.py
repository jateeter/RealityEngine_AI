"""
LangGraph orchestration for regex matching via the Reality Engine (CES) +
Perception Engine pipeline.

Graph topology:
  initialize → process_char → [loop back | finalize → END]

State:
  patterns      : list of regex patterns to match simultaneously
  input_text    : text to search for pattern occurrences
  perception_url: Perception Engine base URL
  reality_url   : Reality Engine base URL
  machines      : {pattern → machine_id} — populated after initialize
  sensor_id     : sensor source UUID in Perception Engine (set in initialize)
  char_index    : current position in input_text
  match_log     : accumulated list of {char_index, char, pattern, matched}
  results       : final {pattern → [list of char positions where match fired]}
  error         : set if a node encounters an unrecoverable error

Data flow per character:
  1. Push the character's one-hot encoding to the sensor source (PE)
  2. Trigger a PE→RE vector push (assembled vector → Reality Engine)
  3. Reality Engine processes all CES machines in one step
  4. Read per-machine outputVector from the push response
     outputVector=[1.0] → the DFA accepted at this position
  5. Record match positions; advance char_index

All interactions with the Reality Engine go exclusively through the
Perception Engine's REST API (sensor push + push trigger).
Machine loading uses the Reality Engine REST API directly (POST /api/machines/json/import)
which the Perception Engine's MCP tool `machines_load_json` also targets.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Optional
import operator

from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict

from .regex_compiler import compile_pattern
from .clients import RealityEngineClient, PerceptionClient

# ── State schema ──────────────────────────────────────────────────────────────

class RegexOrchestratorState(TypedDict, total=False):
    # ── Inputs (set once before graph invocation) ──────────────────────────
    patterns: list[str]          # regex patterns to search for
    input_text: str              # text to search
    perception_url: str          # Perception Engine base URL
    reality_url: str             # Reality Engine base URL

    # ── Internal state ─────────────────────────────────────────────────────
    machines: dict[str, str]     # {pattern: machine_id} — set in initialize
    sensor_id: Optional[str]     # sensor source UUID in PE — set in initialize
    sensor_uuid: Optional[str]   # PE source list UUID (for cleanup)
    char_index: int              # current character position

    # ── Accumulator (LangGraph reducer: list items are appended across steps)
    match_log: Annotated[list[dict], operator.add]

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

    try:
        # -- Verify connectivity -----------------------------------------
        re_client.health()
        pe_client.health()

        # -- Compile + load machines into Reality Engine -----------------
        for idx, pattern in enumerate(patterns):
            ces_json = compile_pattern(pattern, idx)
            resp = re_client.import_machine(ces_json)
            machine_id: str = resp['machine']['id']
            machines[pattern] = machine_id

        # -- Register sensor source in Perception Engine -----------------
        sensor_id = f"regex-input-{uuid.uuid4().hex[:8]}"
        source = pe_client.add_sensor_source(sensor_id=sensor_id)
        source_uuid: str = source.get('id', sensor_id)

        # -- Set matchAlgorithm = "gte" on PE ----------------------------
        pe_client.set_match_algorithm('gte')

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
    Process one character from input_text:
      1. Push the char's one-hot encoding to the PE sensor source
      2. Trigger PE→RE push (assembles 256-cell vector, calls processImmediate)
      3. Inspect step result for per-pattern matches
      4. Append match events to match_log; advance char_index
    """
    idx = state.get('char_index', 0)
    text = state.get('input_text', '')
    ch = text[idx]

    sensor_id: str = state['sensor_id']
    machines: dict[str, str] = state.get('machines', {})

    pe_url = state.get('perception_url', 'http://localhost:3004')
    pe_client = PerceptionClient(base_url=pe_url)

    new_entries: list[dict] = []

    try:
        # Push char encoding to sensor
        pe_client.push_char(sensor_id, ch)

        # Trigger assembled-vector push → Reality Engine processImmediate
        push_result = pe_client.push()

        # Detect matches
        matches = PerceptionClient.extract_matches(push_result, machines)

        for pattern, matched in matches.items():
            new_entries.append({
                'char_index': idx,
                'char': ch,
                'pattern': pattern,
                'matched': matched,
                'global_step': push_result.get('globalStep'),
            })

    except Exception as exc:
        return {
            'error': f'Error at char_index={idx} (char={ch!r}): {exc}',
            'char_index': idx + 1,
        }
    finally:
        pe_client.close()

    return {
        'match_log': new_entries,  # appended via reducer
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
) -> dict:
    """
    Run the compiled LangGraph and return the final state dict.

    Example:
        result = run_regex_search(
            patterns=['hello', 'world'],
            input_text='say hello to the world today',
        )
        print(result['summary'])
        print(result['results'])   # {'hello': [12], 'world': [22]}
    """
    app = build_graph()
    final_state = app.invoke({
        'patterns': patterns,
        'input_text': input_text,
        'perception_url': perception_url,
        'reality_url': reality_url,
    })
    return final_state
