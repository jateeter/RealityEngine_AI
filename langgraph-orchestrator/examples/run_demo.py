#!/usr/bin/env python3
"""
LangGraph Regex Orchestration — Demo

Demonstrates searching for multiple regex patterns simultaneously in a text
string using the Reality Engine (CES machines as DFAs) and the Perception
Engine (character-by-character perceptual vector delivery).

Architecture:
  ┌─────────────────────────────────────────────────┐
  │  LangGraph StateGraph                           │
  │                                                 │
  │  initialize ─► process_char ──►(loop)           │
  │                     │                           │
  │                     └──►(done)──► finalize      │
  └─────────────────────────────────────────────────┘
         │                │                  │
         ▼                ▼                  ▼
  Reality Engine    Perception Engine   Reality Engine
  (import CES       (push one-hot       (processImmediate
   machine JSON)     char vector)        via PE push)

Each regex pattern is compiled to a CES (Critical Event Sequence) machine:
  Regex AST ──► Thompson ε-NFA ──► DFA (subset construction) ──► CES JSON

The CES machine is a DFA where:
  • Each (state, char) transition = one CES vector (one-hot GTE encoding)
  • isInitial=true on start-state transitions → "search anywhere" semantics
  • outputVector=[1.0] when entering an accepting state → match detected

Usage:
  # With services running locally (no Docker):
  python examples/run_demo.py

  # Custom URLs:
  PERCEPTION_URL=https://localhost:3004 REALITY_URL=https://localhost:3000 \\
      python examples/run_demo.py
"""

import os
import sys

# Allow running from the langgraph-orchestrator/ directory
_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sys.path.insert(0, _ROOT)

from src.regex_compiler import compile_pattern

PERCEPTION_URL = os.environ.get('PERCEPTION_URL', 'http://localhost:3004')
REALITY_URL = os.environ.get('REALITY_URL', 'http://localhost:3000')

_LANGGRAPH_MISSING_MSG = """
langgraph is not installed in the current Python environment.

Install dependencies first:
  cd {root}
  python -m venv .venv
  source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
  pip install -r requirements.txt

Then re-run with the venv active:
  python examples/run_demo.py --live
""".format(root=_ROOT).strip()


def demo_compiler():
    """Show a compiled CES machine for a simple pattern (no services required)."""
    print("=" * 60)
    print("CES COMPILER DEMO  (no running services required)")
    print("=" * 60)

    examples = [
        ("hello", 0),
        ("ab+c", 1),
        ("cat|dog", 2),
    ]

    for pattern, idx in examples:
        print(f"\nPattern: {pattern!r}  (slot {idx})")
        ces = compile_pattern(pattern, idx)
        m = ces['machine']
        seq = m['sequences'][0]
        print(f"  Machine name  : {m['name']}")
        print(f"  DFA states    : {m['metadata']['dfa_states']}")
        print(f"  CES vectors   : {len(seq['vectors'])}")
        print(f"  Input region  : offset={m['perceptualMapping']['input']['offset']}, "
              f"length={m['perceptualMapping']['input']['length']}")
        print(f"  Output cell   : {m['perceptualMapping']['output']['offset']}")

        # Show first two vectors as examples
        for vec in seq['vectors'][:2]:
            # Find which char this vector matches
            char_idx = next(
                (i for i, e in enumerate(vec['elements']) if e['value'] >= 0.5),
                None
            )
            from src.vector_encoding import ALPHABET_CHARS
            matched_char = ALPHABET_CHARS[char_idx] if char_idx is not None else '?'
            print(f"    vec {vec['id']!r}: matches '{matched_char}', "
                  f"isInitial={vec['isInitial']}, "
                  f"nextVectorIds={vec['nextVectorIds'][:3]!r}"
                  f"{'...' if len(vec['nextVectorIds']) > 3 else ''}, "
                  f"fires_output={'yes' if vec['outputVectors'] else 'no'}")


def demo_full_pipeline():
    """Run the full LangGraph pipeline against live services."""
    try:
        from src.graph import run_regex_search
    except ModuleNotFoundError as exc:
        if 'langgraph' in str(exc) or 'langchain' in str(exc):
            print("\n" + _LANGGRAPH_MISSING_MSG)
            return
        raise

    print("\n" + "=" * 60)
    print("FULL PIPELINE DEMO  (requires running services)")
    print(f"  Perception Engine : {PERCEPTION_URL}")
    print(f"  Reality Engine    : {REALITY_URL}")
    print("=" * 60)

    # ── Demo 1: simple word search ────────────────────────────────────────────
    print("\n── Demo 1: Word search ──")
    patterns1 = ['hello', 'world']
    text1 = 'hello world say hello again to the world'
    print(f"  Patterns : {patterns1}")
    print(f"  Text     : {text1!r}")

    try:
        result1 = run_regex_search(
            patterns=patterns1,
            input_text=text1,
            perception_url=PERCEPTION_URL,
            reality_url=REALITY_URL,
        )
        _print_result(result1)
    except Exception as exc:
        print(f"  ERROR: {exc}")
        print("  (Is the Reality Engine running? Check REALITY_URL / PERCEPTION_URL)")
        return

    # ── Demo 2: alternation ───────────────────────────────────────────────────
    print("\n── Demo 2: Alternation ──")
    patterns2 = ['cat|dog', 'fish']
    text2 = 'i have a cat and a dog but no fish'
    print(f"  Patterns : {patterns2}")
    print(f"  Text     : {text2!r}")

    result2 = run_regex_search(
        patterns=patterns2,
        input_text=text2,
        perception_url=PERCEPTION_URL,
        reality_url=REALITY_URL,
    )
    _print_result(result2)

    # ── Demo 3: repetition ────────────────────────────────────────────────────
    print("\n── Demo 3: Repetition (ab+c) ──")
    patterns3 = ['ab+c']
    text3 = 'start abc then abbc then abbbc end'
    print(f"  Patterns : {patterns3}")
    print(f"  Text     : {text3!r}")

    result3 = run_regex_search(
        patterns=patterns3,
        input_text=text3,
        perception_url=PERCEPTION_URL,
        reality_url=REALITY_URL,
    )
    _print_result(result3)

    # ── Demo 4: digit class ───────────────────────────────────────────────────
    print("\n── Demo 4: Digit class (\\d+) ──")
    patterns4 = [r'\d+']
    text4 = 'code 42 version 3 release 100'
    print(f"  Patterns : {patterns4}")
    print(f"  Text     : {text4!r}")

    result4 = run_regex_search(
        patterns=patterns4,
        input_text=text4,
        perception_url=PERCEPTION_URL,
        reality_url=REALITY_URL,
    )
    _print_result(result4)


def _print_result(result: dict) -> None:
    if result.get('error'):
        print(f"  Error: {result['error']}")
        return
    print()
    for line in result.get('summary', '').split('\n'):
        print(f"  {line}")


if __name__ == '__main__':
    # Always show the compiler demo (no services needed)
    demo_compiler()

    # Run live demo if --live flag is passed or LIVE=1 env var is set
    run_live = '--live' in sys.argv or os.environ.get('LIVE', '').lower() in ('1', 'true', 'yes')
    if run_live:
        demo_full_pipeline()
    else:
        print(
            "\n\nTo run the full pipeline demo (requires running services):\n"
            "  python examples/run_demo.py --live\n"
            "  LIVE=1 python examples/run_demo.py\n"
        )
