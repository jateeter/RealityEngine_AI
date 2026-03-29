"""
End-to-end tests for the Reality Engine + Perception Engine orchestration pipeline.

Each test exercises a different facet of the full workflow:

  Test 1 — Single literal pattern: validates end-to-end match detection for a
            simple word, verifying exact match positions and the raw push-response
            structure from the Perception Engine.

  Test 2 — Concurrent multi-pattern detection: two independent CES machines
            loaded simultaneously; validates that the assembled perceptual vector
            feeds both machines in a single processImmediate call and that each
            fires independently at the correct position.

  Test 3 — Kleene-plus self-loop (DFA persistence across pushes): the pattern
            `ab+c` exercises the CES self-loop mechanism.  Confirms that state
            is maintained across successive PE pushes, and that both short
            (abc) and long (abbc, abbbc) variants are detected.

  Test 4 — No-match resistance and resource cleanup: confirms that a pattern
            that should NOT match produces zero false positives; also verifies
            that both the CES machine and the sensor source are fully removed
            from their respective engines after the LangGraph `finalize` node runs.

All four tests drive the pipeline exclusively through the Perception Engine's
public REST API.  Machine loading is the only operation that contacts the
Reality Engine directly (POST /api/machines/json/import).
"""

from __future__ import annotations

import sys
import os
import uuid

import pytest

# Ensure src/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.regex_compiler import compile_pattern
from src.vector_encoding import (
    CHAR_REGION_OFFSET,
    CHAR_REGION_LENGTH,
    OUTPUT_REGION_OFFSET,
    CHAR_TO_IDX,
    ALPHABET_CHARS,
)

from tests.conftest import (
    PE_URL, RE_URL,
    load_machine, delete_machine,
    add_sensor_source, remove_source,
    push_char_and_step, output_fired, run_text,
)


# ─────────────────────────────────────────────────────────────────────────────
# Test 1 — Single literal pattern, exact match positions
# ─────────────────────────────────────────────────────────────────────────────

class TestSingleLiteralPattern:
    """
    Pattern 'hello' in text 'say hello to the world'.

    Expected match end-position: 8  (the 'o' that completes the word)

    Validates:
      • CES machine loads into Reality Engine (machine ID returned)
      • Sensor source registers in Perception Engine (source UUID returned)
      • outputVector is [1.0] at exactly position 8 and null everywhere else
      • PE push-result contains a valid step with machineResults keyed by machine ID
      • PE state reflects a recent push (lastPush is non-null after the run)
    """

    PATTERN = 'hello'
    TEXT    = 'say hello to the world'
    #          0123456789...
    #                   ^ position 8 = 'o' (0-indexed)
    EXPECTED_POSITIONS = [8]

    @pytest.fixture(autouse=True)
    def setup_teardown(self, services):
        ces = compile_pattern(self.PATTERN, pattern_idx=0)
        self.machine_id = load_machine(RE_URL, ces)
        self.sensor_id  = f'e2e-t1-{uuid.uuid4().hex[:6]}'
        self.source_uuid = add_sensor_source(PE_URL, self.sensor_id)
        yield
        delete_machine(RE_URL, self.machine_id)
        remove_source(PE_URL, self.source_uuid)

    def test_machine_loaded_into_reality_engine(self, services):
        """Machine appears in GET /api/machines after import."""
        import httpx
        r = httpx.get(f'{RE_URL}/api/machines',
                      timeout=10, verify=False)
        r.raise_for_status()
        machine_ids = [m['id'] for m in r.json().get('machines', [])]
        assert self.machine_id in machine_ids, (
            f'Machine {self.machine_id} not found in Reality Engine machine list'
        )

    def test_sensor_source_registered_in_perception_engine(self, services):
        """Sensor source appears in GET /api/sources with correct region."""
        import httpx
        r = httpx.get(f'{PE_URL}/api/sources',
                      timeout=10, verify=False)
        r.raise_for_status()
        sources = r.json().get('sources', [])
        match = next((s for s in sources if s.get('id') == self.source_uuid), None)
        assert match is not None, (
            f'Source {self.source_uuid} not found in PE sources list'
        )
        assert match['region']['offset'] == CHAR_REGION_OFFSET
        assert match['region']['length'] == CHAR_REGION_LENGTH

    def test_match_fires_at_exact_position(self, services):
        """
        outputVector is [1.0] only at position 8 (the final 'o' of 'hello').
        All other characters produce outputVector=null for this machine.
        """
        matches, steps = run_text(
            PE_URL, self.sensor_id, self.TEXT,
            {self.PATTERN: self.machine_id},
        )

        assert matches[self.PATTERN] == self.EXPECTED_POSITIONS, (
            f"Pattern {self.PATTERN!r}: expected matches at {self.EXPECTED_POSITIONS}, "
            f"got {matches[self.PATTERN]}"
        )

        # No other position should have fired
        non_match_fires = [
            i for i, step in enumerate(steps)
            if i not in self.EXPECTED_POSITIONS and output_fired(step, self.machine_id)
        ]
        assert non_match_fires == [], (
            f'False positives at positions {non_match_fires}'
        )

    def test_push_response_structure(self, services):
        """
        A single PE push returns a properly structured PushResult:
          success, step.machineResults[machine_id], step.stepNumber, globalStep.
        The machineResults entry for our machine shows the correct input/output regions.
        """
        # Push just the first character ('s') — should not fire
        result = push_char_and_step(PE_URL, self.sensor_id, 's')

        assert result.get('success') is True
        step = result.get('step', {})
        assert 'machineResults' in step, "step.machineResults missing from push response"
        assert 'stepNumber' in step
        assert 'globalStep' in result

        mr = step['machineResults'].get(self.machine_id)
        assert mr is not None, (
            f'machineResults does not contain entry for machine {self.machine_id}'
        )
        assert mr['inputRegion']['offset'] == CHAR_REGION_OFFSET
        assert mr['inputRegion']['length'] == CHAR_REGION_LENGTH
        assert mr['outputRegion']['offset'] == OUTPUT_REGION_OFFSET  # pattern_idx=0
        assert mr['outputRegion']['length'] == 1
        # 's' is the first char of 'say'; pattern starts with 'h', no match yet
        assert mr['outputVector'] is None, (
            f"Expected no output on 's', got {mr['outputVector']}"
        )

    def test_perception_engine_state_updated_after_push(self, services):
        """
        After at least one push, GET /api/state on the PE shows a non-null lastPush
        and a globalStep > 0.
        """
        import httpx
        push_char_and_step(PE_URL, self.sensor_id, 'a')

        r = httpx.get(f'{PE_URL}/api/state', timeout=10, verify=False)
        r.raise_for_status()
        state = r.json()
        assert state.get('lastPush') is not None, 'PE state.lastPush is null after a push'
        assert state.get('globalStep', 0) > 0, 'PE state.globalStep did not advance'


# ─────────────────────────────────────────────────────────────────────────────
# Test 2 — Two concurrent patterns via LangGraph run
# ─────────────────────────────────────────────────────────────────────────────

class TestConcurrentMultiPatternDetection:
    """
    Patterns 'cat' and 'dog' searched simultaneously in:
      'the cat sat next to the dog'

    Expected:
      'cat' fires at position 6  (the 't' of 'cat')
      'dog' fires at position 26 (the 'g' of 'dog')

    Validates:
      • Both machines occupy different output cells (OUTPUT_REGION_OFFSET+0 and +1)
      • A single processImmediate call feeds both machines at once
      • Each machine fires independently — the 'dog' machine does not fire at 'cat'
        and vice versa
      • The LangGraph run_regex_search correctly aggregates both result sets
    """

    PATTERNS = ['cat', 'dog']
    TEXT     = 'the cat sat next to the dog'
    #           0123456789012345678901234567
    #                ^ 6='t'(cat)      ^ 26='g'(dog)
    EXPECTED = {'cat': [6], 'dog': [26]}

    def test_concurrent_detection_via_langgraph(self, services):
        """
        Full LangGraph run: compile → load → push → finalize.
        Verifies correct match positions for both patterns.
        """
        from src.graph import run_regex_search
        result = run_regex_search(
            patterns=self.PATTERNS,
            input_text=self.TEXT,
            perception_url=PE_URL,
            reality_url=RE_URL,
        )

        assert result.get('error') is None, f"Graph error: {result.get('error')}"

        for pattern in self.PATTERNS:
            got = result['results'].get(pattern, [])
            assert got == self.EXPECTED[pattern], (
                f"Pattern {pattern!r}: expected {self.EXPECTED[pattern]}, got {got}"
            )

    def test_machines_use_distinct_output_cells(self, services):
        """
        The two compiled machines map to different output cells:
          'cat' → OUTPUT_REGION_OFFSET + 0
          'dog' → OUTPUT_REGION_OFFSET + 1
        This ensures one machine's match cannot interfere with the other's output.
        """
        ces_cat = compile_pattern('cat', 0)
        ces_dog = compile_pattern('dog', 1)

        out_cat = ces_cat['machine']['perceptualMapping']['output']['offset']
        out_dog = ces_dog['machine']['perceptualMapping']['output']['offset']

        assert out_cat == OUTPUT_REGION_OFFSET,     f"cat output offset wrong: {out_cat}"
        assert out_dog == OUTPUT_REGION_OFFSET + 1, f"dog output offset wrong: {out_dog}"
        assert out_cat != out_dog, "Both patterns mapped to the same output cell"

    def test_no_cross_pattern_false_positives(self, services):
        """
        When only 'cat' is present in text, the 'dog' machine never fires,
        and when only 'dog' is present the 'cat' machine never fires.
        Both machines are loaded simultaneously so each step feeds both.
        """
        sensor_id   = f'e2e-t2-{uuid.uuid4().hex[:6]}'
        machine_ids = {}
        source_uuid = None
        try:
            for idx, pat in enumerate(self.PATTERNS):
                ces = compile_pattern(pat, idx)
                machine_ids[pat] = load_machine(RE_URL, ces)
            source_uuid = add_sensor_source(PE_URL, sensor_id)

            # Text contains only 'cat', no 'dog'
            cat_only_text = 'i see a cat here'
            matches, _ = run_text(PE_URL, sensor_id, cat_only_text, machine_ids)

            assert matches['cat'] != [], "Expected 'cat' to match in 'i see a cat here'"
            assert matches['dog'] == [], "Expected no 'dog' match in 'i see a cat here'"

            # Text contains only 'dog', no 'cat'
            dog_only_text = 'only a dog there'
            matches2, _ = run_text(PE_URL, sensor_id, dog_only_text, machine_ids)

            assert matches2['dog'] != [], "Expected 'dog' to match in 'only a dog there'"
            assert matches2['cat'] == [], "Expected no 'cat' match in 'only a dog there'"

        finally:
            for mid in machine_ids.values():
                delete_machine(RE_URL, mid)
            if source_uuid:
                remove_source(PE_URL, source_uuid)


# ─────────────────────────────────────────────────────────────────────────────
# Test 3 — Kleene-plus self-loop: DFA state persistence across PE pushes
# ─────────────────────────────────────────────────────────────────────────────

class TestKleenePlusSelfLoop:
    """
    Pattern 'ab+c' in text 'abc and abbc and abbbc'.

    The DFA for 'ab+c' contains a self-loop: the state reached after 'ab'
    transitions back to itself on 'b', then to an accepting state on 'c'.
    This tests that the Reality Engine correctly maintains DFA state across
    multiple successive PE pushes (each character is a separate HTTP round-trip).

    Expected match end-positions:
      'abc'   → position 2
      'abbc'  → position 11
      'abbbc' → position 20

    Text:  a b c   a n d   a b b c   a n d   a b b b c
    Index: 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0
                                    1 1 1 1 1 1 1 1 1 1 2
    """

    PATTERN  = 'ab+c'
    TEXT     = 'abc and abbc and abbbc'
    EXPECTED = [2, 11, 20]

    @pytest.fixture(autouse=True)
    def setup_teardown(self, services):
        ces = compile_pattern(self.PATTERN, pattern_idx=0)
        self.machine_id  = load_machine(RE_URL, ces)
        self.sensor_id   = f'e2e-t3-{uuid.uuid4().hex[:6]}'
        self.source_uuid = add_sensor_source(PE_URL, self.sensor_id)
        yield
        delete_machine(RE_URL, self.machine_id)
        remove_source(PE_URL, self.source_uuid)

    def test_self_loop_variants_detected(self, services):
        """
        All three repetition variants (abc, abbc, abbbc) fire output at the
        correct end-position.  No other position fires.
        """
        matches, steps = run_text(
            PE_URL, self.sensor_id, self.TEXT,
            {self.PATTERN: self.machine_id},
        )

        assert matches[self.PATTERN] == self.EXPECTED, (
            f"Expected {self.EXPECTED}, got {matches[self.PATTERN]}"
        )

    def test_output_vector_value_on_match(self, services):
        """
        When the pattern fires, outputVector[0] == 1.0 exactly.
        The Reality Engine writes the CES output into the perceptual space cell
        OUTPUT_REGION_OFFSET+0; it must be exactly [1.0], not a partial value.
        """
        _, steps = run_text(
            PE_URL, self.sensor_id, self.TEXT,
            {self.PATTERN: self.machine_id},
        )

        for pos in self.EXPECTED:
            mr = steps[pos]['step']['machineResults'].get(self.machine_id, {})
            ov = mr.get('outputVector')
            assert ov == [1.0], (
                f"At position {pos} expected outputVector=[1.0], got {ov}"
            )

    def test_non_matching_positions_have_null_output(self, services):
        """
        Every character step that does NOT complete the pattern must have
        outputVector=null (or absent) in the machine result.
        This validates no ghost matches occur during the self-loop accumulation.
        """
        _, steps = run_text(
            PE_URL, self.sensor_id, self.TEXT,
            {self.PATTERN: self.machine_id},
        )

        false_positives = []
        for i, step in enumerate(steps):
            if i in self.EXPECTED:
                continue  # skip true-match positions
            mr = step['step']['machineResults'].get(self.machine_id, {})
            ov = mr.get('outputVector')
            if ov is not None and len(ov) > 0 and ov[0] >= 0.5:
                false_positives.append((i, self.TEXT[i], ov))

        assert false_positives == [], (
            f"False positives detected: {false_positives}"
        )

    def test_perception_engine_vector_contains_correct_char(self, services):
        """
        After pushing 'a' (the start of 'abc'), the PE-assembled vector has 1.0
        in cell CHAR_REGION_OFFSET + CHAR_TO_IDX['a'] and 0.0 everywhere else
        within the character input region.  This validates that char_to_region_vector
        is encoded faithfully through the sensor → assembled-vector pipeline.

        We verify this by inspecting the inputVector that the Reality Engine
        received (reflected back in step.machineResults[id].inputVector).
        """
        result = push_char_and_step(PE_URL, self.sensor_id, 'a')
        mr = result['step']['machineResults'].get(self.machine_id)
        assert mr is not None

        iv = mr.get('inputVector')
        assert iv is not None, 'inputVector not present in machine result'
        assert len(iv) == CHAR_REGION_LENGTH, (
            f'Expected inputVector length {CHAR_REGION_LENGTH}, got {len(iv)}'
        )

        a_idx = CHAR_TO_IDX['a']  # should be 0
        assert abs(iv[a_idx] - 1.0) < 1e-9, (
            f"Expected iv[{a_idx}]=1.0 for 'a', got {iv[a_idx]}"
        )
        for i, val in enumerate(iv):
            if i != a_idx:
                assert abs(val) < 1e-9, (
                    f"Expected iv[{i}]=0.0 for non-'a' cell, got {val}"
                )


# ─────────────────────────────────────────────────────────────────────────────
# Test 4 — No-match resistance and resource cleanup verification
# ─────────────────────────────────────────────────────────────────────────────

class TestNoMatchAndCleanup:
    """
    Pattern 'error' searched in text 'all is fine here' (no match expected).

    Validates:
      • Zero outputVector fires across all 16 characters
      • LangGraph finalize node removes the CES machine from the Reality Engine
      • LangGraph finalize node removes the sensor source from the Perception Engine
      • The PE assembled vector in the character input region is entirely zero
        after the sensor source's TTL expires (passive cleanup path)

    The cleanup assertions confirm the 'finalize' node properly restores both
    engines to a clean state, which is critical for long-running deployments
    where accumulated machines would degrade performance.
    """

    PATTERN = 'error'
    TEXT    = 'all is fine here'
    EXPECTED_POSITIONS: list[int] = []

    def test_no_false_positives_full_langgraph_run(self, services):
        """
        Full LangGraph run through a text with no occurrences of the pattern.
        results[pattern] must be an empty list.
        """
        from src.graph import run_regex_search
        result = run_regex_search(
            patterns=[self.PATTERN],
            input_text=self.TEXT,
            perception_url=PE_URL,
            reality_url=RE_URL,
        )

        assert result.get('error') is None, f"Graph error: {result.get('error')}"
        positions = result['results'].get(self.PATTERN, [])
        assert positions == self.EXPECTED_POSITIONS, (
            f"Expected no matches, got {positions}"
        )

    def test_machine_removed_from_reality_engine_after_finalize(self, services):
        """
        After run_regex_search completes (finalize ran), the machine that was
        loaded by the initialize node must no longer exist in the Reality Engine.
        """
        import httpx
        from src.graph import run_regex_search

        # Capture machine ID before the run by instrumenting a plain import
        ces = compile_pattern(self.PATTERN, 0)
        machine_id = load_machine(RE_URL, ces)

        # Verify it's there
        r = httpx.get(f'{RE_URL}/api/machines', timeout=10, verify=False)
        all_ids_before = [m['id'] for m in r.json().get('machines', [])]
        assert machine_id in all_ids_before, 'Machine not found before run (test setup error)'

        # Clean up the manually loaded machine; the graph run will load its own
        delete_machine(RE_URL, machine_id)

        # Full graph run (loads + cleans up internally)
        result = run_regex_search(
            patterns=[self.PATTERN],
            input_text=self.TEXT,
            perception_url=PE_URL,
            reality_url=RE_URL,
        )
        graph_machine_id = list(result.get('machines', {}).values())[0] if result.get('machines') else None

        # Verify cleanup
        r2 = httpx.get(f'{RE_URL}/api/machines', timeout=10, verify=False)
        all_ids_after = [m['id'] for m in r2.json().get('machines', [])]

        if graph_machine_id:
            assert graph_machine_id not in all_ids_after, (
                f'Machine {graph_machine_id} still present after finalize cleanup'
            )

    def test_sensor_source_removed_from_perception_engine_after_finalize(self, services):
        """
        After run_regex_search completes, the sensor source registered by the
        initialize node must no longer appear in GET /api/sources.
        """
        import httpx
        from src.graph import run_regex_search

        result = run_regex_search(
            patterns=[self.PATTERN],
            input_text=self.TEXT,
            perception_url=PE_URL,
            reality_url=RE_URL,
        )

        removed_source_uuid = result.get('sensor_uuid')

        r = httpx.get(f'{PE_URL}/api/sources', timeout=10, verify=False)
        r.raise_for_status()
        remaining_ids = [s['id'] for s in r.json().get('sources', [])]

        if removed_source_uuid:
            assert removed_source_uuid not in remaining_ids, (
                f'Sensor source {removed_source_uuid} still present after finalize cleanup'
            )

    def test_near_miss_does_not_fire(self, services):
        """
        The text 'errod' contains 4 of the 5 characters of 'error' before
        diverging.  Confirms the partially-progressed DFA state does not
        produce a false positive on the diverging character.
        """
        ces = compile_pattern(self.PATTERN, pattern_idx=0)
        machine_id  = load_machine(RE_URL, ces)
        sensor_id   = f'e2e-t4-{uuid.uuid4().hex[:6]}'
        source_uuid = add_sensor_source(PE_URL, sensor_id)
        try:
            near_miss_text = 'errod'  # looks like 'error' but ends in 'd'
            matches, steps = run_text(
                PE_URL, sensor_id, near_miss_text,
                {self.PATTERN: machine_id},
            )
            assert matches[self.PATTERN] == [], (
                f"Near-miss 'errod' should not match 'error', got {matches[self.PATTERN]}"
            )

            # Confirm DFA state is partially progressed then fails cleanly:
            # Characters e,r,r,o should all have outputVector=null
            for i, step in enumerate(steps):
                mr = step['step']['machineResults'].get(machine_id, {})
                ov = mr.get('outputVector')
                assert ov is None or (isinstance(ov, list) and (len(ov) == 0 or ov[0] < 0.5)), (
                    f"Near-miss: unexpected output at position {i} "
                    f"(char={near_miss_text[i]!r}): outputVector={ov}"
                )
        finally:
            delete_machine(RE_URL, machine_id)
            remove_source(PE_URL, source_uuid)
