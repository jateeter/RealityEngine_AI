"""
Shared pytest fixtures and helpers for e2e tests.

Services needed (set env vars to override defaults):
  PERCEPTION_URL — default http://localhost:3004
  REALITY_URL    — default http://localhost:3000
"""

import os
import uuid
import pytest
import httpx

PE_URL = os.environ.get('PERCEPTION_URL', 'http://localhost:3004')
RE_URL = os.environ.get('REALITY_URL', 'http://localhost:3000')

_TIMEOUT = httpx.Timeout(15.0)
_CLIENT_OPTS = dict(timeout=_TIMEOUT, verify=False)


@pytest.fixture(scope='session')
def services():
    """
    Session-scoped fixture that verifies both services are reachable.
    All e2e tests depend on this; they are auto-skipped when services are down.
    """
    errors = []

    try:
        r = httpx.get(f'{RE_URL}/api/health', **_CLIENT_OPTS)
        r.raise_for_status()
    except Exception as exc:
        errors.append(f'Reality Engine ({RE_URL}): {exc}')

    try:
        r = httpx.get(f'{PE_URL}/api/health', **_CLIENT_OPTS)
        r.raise_for_status()
    except Exception as exc:
        errors.append(f'Perception Engine ({PE_URL}): {exc}')

    if errors:
        pytest.skip(
            'Services not reachable — start the stack first:\n  '
            + '\n  '.join(errors)
        )

    return {'pe_url': PE_URL, 're_url': RE_URL}


# ── Low-level helpers used by multiple tests ──────────────────────────────────

def load_machine(re_url: str, ces_json: dict) -> str:
    """Import a CES machine JSON into the Reality Engine. Returns machine ID."""
    import json
    r = httpx.post(
        f'{re_url}/api/machines/json/import',
        json={'json': json.dumps(ces_json)},
        **_CLIENT_OPTS,
    )
    r.raise_for_status()
    resp = r.json()
    assert resp.get('success'), f'Machine import failed: {resp}'
    return resp['machine']['id']


def delete_machine(re_url: str, machine_id: str) -> None:
    """Delete a machine from the Reality Engine (best-effort)."""
    try:
        httpx.delete(f'{re_url}/api/machines/{machine_id}', **_CLIENT_OPTS).raise_for_status()
    except Exception:
        pass


def add_sensor_source(pe_url: str, sensor_id: str,
                      region_offset: int = 200, region_length: int = 38) -> str:
    """Register a sensor source in the Perception Engine. Returns the source UUID."""
    from src.vector_encoding import CHAR_REGION_OFFSET, CHAR_REGION_LENGTH
    r = httpx.post(f'{pe_url}/api/sources', json={
        'type': 'sensor',
        'name': f'e2e-sensor-{sensor_id}',
        'sensorId': sensor_id,
        'region': {'offset': region_offset, 'length': region_length},
        'ttlMs': 10000,
    }, **_CLIENT_OPTS)
    r.raise_for_status()
    return r.json()['source']['id']


def remove_source(pe_url: str, source_uuid: str) -> None:
    """Remove a sensor source from the Perception Engine (best-effort)."""
    try:
        httpx.delete(f'{pe_url}/api/sources/{source_uuid}', **_CLIENT_OPTS).raise_for_status()
    except Exception:
        pass


def push_char_and_step(pe_url: str, sensor_id: str, ch: str) -> dict:
    """
    Push a character to the sensor source and trigger an assembled-vector push.
    Returns the full PushResult dict (including step.machineResults).
    """
    from src.vector_encoding import char_to_region_vector
    values = char_to_region_vector(ch)

    # Write char encoding to sensor
    r = httpx.post(f'{pe_url}/api/sensors/{sensor_id}',
                   json={'values': values}, **_CLIENT_OPTS)
    r.raise_for_status()

    # Trigger assembled-vector push → Reality Engine processImmediate
    r2 = httpx.post(f'{pe_url}/api/push', **_CLIENT_OPTS)
    r2.raise_for_status()
    return r2.json()


def output_fired(push_result: dict, machine_id: str) -> bool:
    """Return True if the given machine fired an output on this step."""
    mr = push_result.get('step', {}).get('machineResults', {})
    entry = mr.get(machine_id, {})
    ov = entry.get('outputVector')
    return ov is not None and isinstance(ov, list) and len(ov) > 0 and ov[0] >= 0.5


def run_text(pe_url: str, sensor_id: str, text: str,
             machine_ids: dict[str, str]) -> tuple[dict[str, list[int]], list[dict]]:
    """
    Push every character in `text` through the PE→RE pipeline.

    Returns:
        matches:  {pattern: [end-positions where the pattern's machine fired]}
        steps:    list of raw push-result dicts, one per character
    """
    matches: dict[str, list[int]] = {p: [] for p in machine_ids}
    steps: list[dict] = []

    for i, ch in enumerate(text):
        result = push_char_and_step(pe_url, sensor_id, ch)
        steps.append(result)
        for pattern, mid in machine_ids.items():
            if output_fired(result, mid):
                matches[pattern].append(i)

    return matches, steps
