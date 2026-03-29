"""
Regex → CES (Critical Event Sequence) machine compiler.

Pipeline:
  1. Parse the regex pattern using a recursive-descent parser (restricted syntax)
  2. Compile the AST into a Thompson ε-NFA
  3. Convert the ε-NFA to a DFA via subset construction
  4. Emit a CES machine JSON document that matches the Reality Engine's MachineLoader schema

Supported syntax (over the alphabet a-z, 0-9, space):
  Literal    : a single character from the supported alphabet
  .          : any character in the supported alphabet
  [abc]      : character class (ranges like [a-z] supported)
  [^abc]     : negated character class
  \\d        : digit class  [0-9]
  \\w        : word class   [a-z0-9]
  \\s        : whitespace   [ ]
  (expr)     : grouping
  a|b        : alternation
  a*         : Kleene star (zero or more)
  a+         : Kleene plus (one or more)
  a?         : optional (zero or one)

CES semantics used:
  - matchAlgorithm: "gte"  (binary GTE: value 1.0 → expect HIGH, value 0.0 → expect LOW)
  - One CES vector per (DFA state, input character) transition pair
  - isInitial: true  for all outgoing vectors of the DFA start state
    (always armed → "search anywhere in string" semantics)
  - outputVectors: [{vector: [1.0]}]  on transitions that land in accepting states

Perceptual mapping:
  input  region: offset=CHAR_REGION_OFFSET, length=CHAR_REGION_LENGTH  (38 cells)
  output region: offset=OUTPUT_REGION_OFFSET + pattern_idx, length=1  (1 cell per pattern)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Union
import json

from .vector_encoding import (
    CHAR_REGION_OFFSET,
    CHAR_REGION_LENGTH,
    OUTPUT_REGION_OFFSET,
    ALPHABET_CHARS,
    CHAR_TO_IDX,
    EOS_IDX,
)

# ── Alphabet ──────────────────────────────────────────────────────────────────

# The printable chars the regex engine can match against.
# EOS is handled separately (not part of the matching alphabet).
ALPHABET: list[str] = list(ALPHABET_CHARS)  # 37 chars


# ── AST ───────────────────────────────────────────────────────────────────────

@dataclass
class Literal:
    char: str

@dataclass
class AnyChar:
    """Wildcard: matches any character in ALPHABET."""

@dataclass
class CharClass:
    chars: list[str]

@dataclass
class Concat:
    left: ASTNode
    right: ASTNode

@dataclass
class Alternate:
    left: ASTNode
    right: ASTNode

@dataclass
class Repeat:
    inner: ASTNode
    min_count: int          # 0 or 1
    max_count: Optional[int]  # None = unlimited

ASTNode = Union[Literal, AnyChar, CharClass, Concat, Alternate, Repeat]


# ── Recursive-descent parser ──────────────────────────────────────────────────

class RegexParser:
    """Parse a restricted regex string into an ASTNode."""

    def __init__(self, pattern: str) -> None:
        self.pattern = pattern
        self.pos = 0

    def parse(self) -> ASTNode:
        node = self._expr()
        if self.pos != len(self.pattern):
            raise ValueError(
                f"Unexpected character '{self.pattern[self.pos]}' "
                f"at position {self.pos} in pattern: {self.pattern!r}"
            )
        return node

    # expr := term ('|' term)*
    def _expr(self) -> ASTNode:
        left = self._term()
        while self.pos < len(self.pattern) and self.pattern[self.pos] == '|':
            self.pos += 1
            right = self._term()
            left = Alternate(left, right)
        return left

    # term := factor+
    def _term(self) -> ASTNode:
        result = self._factor()
        while self.pos < len(self.pattern) and self.pattern[self.pos] not in '|)':
            right = self._factor()
            result = Concat(result, right)
        return result

    # factor := base quantifier?
    def _factor(self) -> ASTNode:
        base = self._base()
        if self.pos < len(self.pattern):
            q = self.pattern[self.pos]
            if q == '*':
                self.pos += 1
                return Repeat(base, 0, None)
            elif q == '+':
                self.pos += 1
                return Repeat(base, 1, None)
            elif q == '?':
                self.pos += 1
                return Repeat(base, 0, 1)
        return base

    # base := literal | '.' | '[' charclass ']' | '\' escape | '(' expr ')'
    def _base(self) -> ASTNode:
        if self.pos >= len(self.pattern):
            raise ValueError(f"Unexpected end of pattern: {self.pattern!r}")
        c = self.pattern[self.pos]

        if c == '(':
            self.pos += 1
            inner = self._expr()
            if self.pos >= len(self.pattern) or self.pattern[self.pos] != ')':
                raise ValueError(f"Missing ')' in pattern: {self.pattern!r}")
            self.pos += 1
            return inner

        if c == '.':
            self.pos += 1
            return AnyChar()

        if c == '[':
            return self._char_class()

        if c == '\\':
            self.pos += 1
            if self.pos >= len(self.pattern):
                raise ValueError(r"Unexpected end after '\' in pattern")
            esc = self.pattern[self.pos]
            self.pos += 1
            if esc == 'd':
                return CharClass(list('0123456789'))
            elif esc == 'w':
                return CharClass(list('abcdefghijklmnopqrstuvwxyz0123456789'))
            elif esc == 's':
                return CharClass([' '])
            else:
                raise ValueError(f"Unsupported escape '\\{esc}' in pattern: {self.pattern!r}")

        if c in CHAR_TO_IDX:
            self.pos += 1
            return Literal(c)

        raise ValueError(
            f"Unsupported character '{c}' at position {self.pos} in pattern: {self.pattern!r}. "
            f"Supported: a-z, 0-9, space, ., \\d, \\w, \\s, [class], (group), |, *, +, ?"
        )

    def _char_class(self) -> ASTNode:
        self.pos += 1  # consume '['
        negated = False
        if self.pos < len(self.pattern) and self.pattern[self.pos] == '^':
            negated = True
            self.pos += 1

        chars: set[str] = set()
        while self.pos < len(self.pattern) and self.pattern[self.pos] != ']':
            c = self.pattern[self.pos]
            if (self.pos + 2 < len(self.pattern)
                    and self.pattern[self.pos + 1] == '-'
                    and self.pattern[self.pos + 2] != ']'):
                end = self.pattern[self.pos + 2]
                self.pos += 3
                for code in range(ord(c), ord(end) + 1):
                    ch = chr(code)
                    if ch in CHAR_TO_IDX:
                        chars.add(ch)
            else:
                if c in CHAR_TO_IDX:
                    chars.add(c)
                self.pos += 1

        if self.pos >= len(self.pattern) or self.pattern[self.pos] != ']':
            raise ValueError(f"Missing ']' in character class in pattern: {self.pattern!r}")
        self.pos += 1

        result_chars = sorted(set(ALPHABET) - chars) if negated else sorted(chars)
        return CharClass(result_chars)


# ── Thompson ε-NFA ────────────────────────────────────────────────────────────
#
# Each _build_* call returns (nfa_data, start_id, accept_id, next_free_id).
# nfa_data = {'trans': {state: {char: {states}}}, 'eps': {state: {states}}}
# States are plain integers; they don't overlap because we thread next_free_id.

_NfaData = dict   # {'trans': ..., 'eps': ...}


def _empty_nfa() -> _NfaData:
    return {'trans': {}, 'eps': {}}


def _merge(*nfas: _NfaData) -> _NfaData:
    merged: _NfaData = {'trans': {}, 'eps': {}}
    for nfa in nfas:
        for s, trans in nfa['trans'].items():
            merged['trans'].setdefault(s, {})
            for ch, tgts in trans.items():
                merged['trans'][s].setdefault(ch, set()).update(tgts)
        for s, tgts in nfa['eps'].items():
            merged['eps'].setdefault(s, set()).update(tgts)
    return merged


def _build(node: ASTNode, offset: int) -> tuple[_NfaData, int, int, int]:
    """Compile an ASTNode into an NFA fragment starting at state `offset`."""

    if isinstance(node, Literal):
        s, e = offset, offset + 1
        return {'trans': {s: {node.char: {e}}}, 'eps': {}}, s, e, offset + 2

    if isinstance(node, AnyChar):
        s, e = offset, offset + 1
        return {'trans': {s: {c: {e} for c in ALPHABET}}, 'eps': {}}, s, e, offset + 2

    if isinstance(node, CharClass):
        s, e = offset, offset + 1
        valid = [c for c in node.chars if c in CHAR_TO_IDX]
        return {'trans': {s: {c: {e} for c in valid}}, 'eps': {}}, s, e, offset + 2

    if isinstance(node, Concat):
        left, ls, le, n1 = _build(node.left, offset)
        right, rs, re, n2 = _build(node.right, n1)
        nfa = _merge(left, right)
        nfa['eps'].setdefault(le, set()).add(rs)
        return nfa, ls, re, n2

    if isinstance(node, Alternate):
        ns, na = offset, offset + 1         # new start, new accept
        left, ls, le, n1 = _build(node.left, offset + 2)
        right, rs, re, n2 = _build(node.right, n1)
        nfa = _merge({'trans': {ns: {}, na: {}}, 'eps': {}}, left, right)
        nfa['eps'].setdefault(ns, set()).update({ls, rs})
        nfa['eps'].setdefault(le, set()).add(na)
        nfa['eps'].setdefault(re, set()).add(na)
        return nfa, ns, na, n2

    if isinstance(node, Repeat):
        min_c, max_c = node.min_count, node.max_count

        if min_c == 0 and max_c is None:   # *
            ns, na = offset, offset + 1
            inner, is_, ie, n1 = _build(node.inner, offset + 2)
            nfa = _merge({'trans': {ns: {}, na: {}}, 'eps': {}}, inner)
            nfa['eps'].setdefault(ns, set()).update({is_, na})
            nfa['eps'].setdefault(ie, set()).update({is_, na})
            return nfa, ns, na, n1

        if min_c == 1 and max_c is None:   # +  →  inner · inner*
            inner1, is1, ie1, n1 = _build(node.inner, offset)
            star, ss, se, n2 = _build(Repeat(node.inner, 0, None), n1)
            nfa = _merge(inner1, star)
            nfa['eps'].setdefault(ie1, set()).add(ss)
            return nfa, is1, se, n2

        if min_c == 0 and max_c == 1:      # ?  →  inner | ε
            ns, na = offset, offset + 1
            inner, is_, ie, n1 = _build(node.inner, offset + 2)
            nfa = _merge({'trans': {ns: {}, na: {}}, 'eps': {}}, inner)
            nfa['eps'].setdefault(ns, set()).update({is_, na})
            nfa['eps'].setdefault(ie, set()).add(na)
            return nfa, ns, na, n1

        raise ValueError(f"Unsupported Repeat(min={min_c}, max={max_c})")

    raise ValueError(f"Unknown AST node type: {type(node)}")


# ── Subset construction: ε-NFA → DFA ─────────────────────────────────────────

def _epsilon_closure(nfa: _NfaData, states: frozenset[int]) -> frozenset[int]:
    closure = set(states)
    stack = list(states)
    while stack:
        s = stack.pop()
        for t in nfa['eps'].get(s, set()):
            if t not in closure:
                closure.add(t)
                stack.append(t)
    return frozenset(closure)


def _move(nfa: _NfaData, states: frozenset[int], char: str) -> frozenset[int]:
    result: set[int] = set()
    for s in states:
        result.update(nfa['trans'].get(s, {}).get(char, set()))
    return frozenset(result)


def _nfa_to_dfa(nfa: _NfaData, nfa_start: int, nfa_accept: int) -> dict:
    """
    Subset construction producing a DFA dict:
      {
        'start': int,
        'accepting': set[int],
        'transitions': {dfa_state: {char: dfa_state}}
      }
    """
    start_set = _epsilon_closure(nfa, frozenset({nfa_start}))

    dfa_id: dict[frozenset[int], int] = {start_set: 0}
    dfa_trans: dict[int, dict[str, int]] = {0: {}}
    dfa_accepting: set[int] = set()

    if nfa_accept in start_set:
        dfa_accepting.add(0)

    queue: list[frozenset[int]] = [start_set]
    next_id = 1

    while queue:
        current = queue.pop(0)
        cur_id = dfa_id[current]

        for char in ALPHABET:
            moved = _move(nfa, current, char)
            if not moved:
                continue
            closure = _epsilon_closure(nfa, moved)
            if not closure:
                continue

            if closure not in dfa_id:
                dfa_id[closure] = next_id
                dfa_trans[next_id] = {}
                if nfa_accept in closure:
                    dfa_accepting.add(next_id)
                queue.append(closure)
                next_id += 1

            dfa_trans[cur_id][char] = dfa_id[closure]

    return {
        'start': 0,
        'accepting': dfa_accepting,
        'transitions': dfa_trans,
    }


# ── DFA → CES machine JSON ────────────────────────────────────────────────────

def _dfa_to_ces(dfa: dict, pattern: str, pattern_idx: int) -> dict:
    """
    Emit a CES machine JSON dict from a compiled DFA.

    One CES vector is created for every (DFA state, char) → next_state transition.
    The vector uses a one-hot GTE encoding over CHAR_REGION_LENGTH cells:
      • cell i == char's index → value 1.0 (expect HIGH)
      • all other cells         → value 0.0 (expect LOW)

    isInitial=true  → DFA start-state transitions (armed on every step; "search" mode)
    outputVectors   → non-empty when the transition lands in a DFA accepting state
    """
    transitions: dict[int, dict[str, int]] = dfa['transitions']
    accepting: set[int] = dfa['accepting']
    dfa_start: int = dfa['start']
    n = CHAR_REGION_LENGTH  # 38

    # Pre-compute: DFA state → list of outgoing vector IDs
    state_to_vec_ids: dict[int, list[str]] = {
        q: [f"vec_{q}_{CHAR_TO_IDX[c]}" for c in sorted(trans.keys())]
        for q, trans in transitions.items()
    }

    vectors: list[dict] = []

    for q, trans in transitions.items():
        for c, q_next in sorted(trans.items()):
            c_idx = CHAR_TO_IDX[c]
            vec_id = f"vec_{q}_{c_idx}"

            elements = [
                {"value": (1.0 if i == c_idx else 0.0), "threshold": 0.5}
                for i in range(n)
            ]

            next_vec_ids = state_to_vec_ids.get(q_next, [])

            output_vectors: list[dict] = []
            if q_next in accepting:
                output_vectors = [{
                    "id": f"out_{vec_id}",
                    "vector": [1.0],
                    "metadata": {
                        "description": f"Pattern match: {pattern}",
                        "pattern": pattern,
                    },
                }]

            vectors.append({
                "id": vec_id,
                "elements": elements,
                "isInitial": q == dfa_start,
                "nextVectorIds": next_vec_ids,
                "outputVectors": output_vectors,
                "metadata": {
                    "name": f"q{q}-on-{c}",
                    "description": (
                        f"DFA state {q} → state {q_next} on input '{c}'"
                        + (" [ACCEPT]" if q_next in accepting else "")
                    ),
                    "dfa_from": q,
                    "input_char": c,
                    "dfa_to": q_next,
                    "is_accept_transition": q_next in accepting,
                },
            })

    safe_pat = ''.join(c if c.isalnum() else '-' for c in pattern[:24]).strip('-')
    machine_name = f"regex-{pattern_idx}-{safe_pat}"

    return {
        "version": "1.0.0",
        "machine": {
            "name": machine_name,
            "description": f"CES DFA machine for regex: {pattern}",
            "metadata": {
                "pattern": pattern,
                "pattern_idx": pattern_idx,
                "dfa_states": len(transitions),
                "dfa_accepting_states": sorted(accepting),
                "category": "regex",
                "author": "LangGraph Orchestrator",
                "encoding": "one-hot GTE over a-z, 0-9, space (38 cells)",
            },
            "arbiterRule": "PASSTHROUGH",
            "matchAlgorithm": "gte",
            "perceptualMapping": {
                "input": {
                    "offset": CHAR_REGION_OFFSET,
                    "length": n,
                },
                "output": {
                    "offset": OUTPUT_REGION_OFFSET + pattern_idx,
                    "length": 1,
                },
            },
            "sequences": [{
                "id": f"regex-seq-{pattern_idx}",
                "name": f"Pattern '{pattern}'",
                "metadata": {
                    "description": f"CES vectors implementing DFA for regex: {pattern}",
                    "pattern": pattern,
                    "vector_count": len(vectors),
                },
                "vectors": vectors,
            }],
            "inputSequences": [],
        },
    }


# ── Public API ────────────────────────────────────────────────────────────────

def compile_pattern(pattern: str, pattern_idx: int) -> dict:
    """
    Compile a regex pattern string to a CES machine JSON dict.

    Args:
        pattern:     Regex pattern (restricted syntax, see module docstring)
        pattern_idx: Pattern slot 0–7; determines the output perceptual cell
                     (OUTPUT_REGION_OFFSET + pattern_idx)

    Returns:
        A dict matching the Reality Engine's MachineLoader JSON schema,
        ready for json.dumps() and import via POST /api/machines/json/import.

    Raises:
        ValueError: If the pattern is syntactically invalid or uses unsupported features.
        IndexError: If pattern_idx is outside [0, MAX_PATTERNS).
    """
    from .vector_encoding import MAX_PATTERNS
    if not (0 <= pattern_idx < MAX_PATTERNS):
        raise IndexError(
            f"pattern_idx must be 0–{MAX_PATTERNS - 1}, got {pattern_idx}"
        )

    ast = RegexParser(pattern).parse()
    nfa, nfa_start, nfa_accept, _ = _build(ast, 0)
    dfa = _nfa_to_dfa(nfa, nfa_start, nfa_accept)
    return _dfa_to_ces(dfa, pattern, pattern_idx)


def compile_pattern_json(pattern: str, pattern_idx: int) -> str:
    """Like compile_pattern() but returns a JSON string."""
    return json.dumps(compile_pattern(pattern, pattern_idx))
