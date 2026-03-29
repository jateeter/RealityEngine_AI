"""
HTTP clients for the Reality Engine and Perception Engine.

RealityEngineClient  — loads CES machine JSON, queries state
PerceptionClient     — manages sensor sources, pushes character vectors, reads match results
"""

from __future__ import annotations

import json
from typing import Optional

import httpx

from .vector_encoding import char_to_region_vector, CHAR_REGION_LENGTH

# Default service URLs (override via environment or constructor args)
DEFAULT_RE_URL = "http://localhost:3000"
DEFAULT_PE_URL = "http://localhost:3004"

_TIMEOUT = httpx.Timeout(15.0)


# ── Reality Engine client ─────────────────────────────────────────────────────

class RealityEngineClient:
    """
    Thin wrapper around the Reality Engine REST API.

    Responsibilities in this pipeline:
      • Import CES machine JSON documents via POST /api/machines/json/import
      • Health-check the Reality Engine
    """

    def __init__(self, base_url: str = DEFAULT_RE_URL) -> None:
        self.base_url = base_url.rstrip('/')
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=_TIMEOUT,
            verify=False,  # allow self-signed TLS certs in dev
        )

    def health(self) -> dict:
        """GET /api/health — raises on non-2xx."""
        r = self._client.get('/api/health')
        r.raise_for_status()
        return r.json()

    def import_machine(self, machine_json: dict | str) -> dict:
        """
        POST /api/machines/json/import  { json: "<serialised machine JSON>" }

        Loads a CES machine into the Reality Engine (and its PerceptualSpaceSimulator).
        Returns the full response dict including the assigned machine ID.
        """
        if isinstance(machine_json, dict):
            json_str = json.dumps(machine_json)
        else:
            json_str = machine_json

        r = self._client.post('/api/machines/json/import', json={'json': json_str})
        r.raise_for_status()
        resp = r.json()
        if not resp.get('success'):
            raise RuntimeError(f"Machine import failed: {resp}")
        return resp

    def delete_machine(self, machine_id: str) -> None:
        """DELETE /api/machines/:id — remove a previously loaded machine."""
        r = self._client.delete(f'/api/machines/{machine_id}')
        r.raise_for_status()

    def list_machines(self) -> list[dict]:
        """GET /api/machines — list all registered machines."""
        r = self._client.get('/api/machines')
        r.raise_for_status()
        return r.json().get('machines', [])

    def reset_perceptual_simulation(self) -> None:
        """POST /api/perceptual-simulation/reset — reset DFA state."""
        r = self._client.post('/api/perceptual-simulation/reset')
        r.raise_for_status()

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


# ── Perception Engine client ──────────────────────────────────────────────────

class PerceptionClient:
    """
    Wrapper around the Perception Engine REST API.

    Responsibilities:
      • Add / remove a sensor source covering the character input region
      • Push per-character one-hot vectors to that sensor source
      • Trigger an assembled-vector push to the Reality Engine
      • Parse the push response to extract per-machine match results
    """

    def __init__(self, base_url: str = DEFAULT_PE_URL) -> None:
        self.base_url = base_url.rstrip('/')
        self._client = httpx.Client(
            base_url=self.base_url,
            timeout=_TIMEOUT,
            verify=False,
        )

    # ── Health ────────────────────────────────────────────────────────────────

    def health(self) -> dict:
        r = self._client.get('/api/health')
        r.raise_for_status()
        return r.json()

    # ── Sensor source lifecycle ───────────────────────────────────────────────

    def add_sensor_source(
        self,
        sensor_id: str,
        name: str = "regex-char-input",
        region_offset: int = 200,
        region_length: int = CHAR_REGION_LENGTH,
        ttl_ms: int = 5000,
    ) -> dict:
        """
        POST /api/sources  — register a sensor source for character input.

        Returns the created source dict (includes the source UUID assigned by the PE).
        """
        payload = {
            "type": "sensor",
            "name": name,
            "sensorId": sensor_id,
            "region": {
                "offset": region_offset,
                "length": region_length,
            },
            "ttlMs": ttl_ms,
        }
        r = self._client.post('/api/sources', json=payload)
        r.raise_for_status()
        resp = r.json()
        return resp.get('source', resp)

    def remove_source(self, source_uuid: str) -> None:
        """DELETE /api/sources/:id — remove a source."""
        r = self._client.delete(f'/api/sources/{source_uuid}')
        r.raise_for_status()

    # ── Push character encoding ───────────────────────────────────────────────

    def push_char(self, sensor_id: str, ch: str) -> dict:
        """
        POST /api/sensors/:sensor_id  { values: [...] }

        Encodes character `ch` as a one-hot region vector and writes it to the
        sensor source, making it available for the next assembled-vector push.
        Returns the API response dict.
        """
        values = char_to_region_vector(ch)
        r = self._client.post(f'/api/sensors/{sensor_id}', json={'values': values})
        r.raise_for_status()
        return r.json()

    # ── Trigger perceive push ─────────────────────────────────────────────────

    def push(self) -> dict:
        """
        POST /api/push

        Triggers the Perception Engine to:
          1. Assemble the current 256-cell perceptual vector from all sources
          2. POST it to the Reality Engine's /api/perceive endpoint
          3. Return the step result (including per-machine match data)

        Returns the full PushResult dict:
          {
            "success": bool,
            "step": {
              "stepNumber": int,
              "machineResults": {
                "<machine-id>": {
                  "machineId": str,
                  "machineName": str,
                  "inputVector": [...],
                  "outputVector": [1.0] | null,
                  "inputRegion": {...},
                  "outputRegion": {...},
                  "transitionResult": {...}
                }
              },
              ...
            },
            "timestamp": int,
            "globalStep": int
          }
        """
        r = self._client.post('/api/push')
        r.raise_for_status()
        return r.json()

    # ── Match extraction ──────────────────────────────────────────────────────

    @staticmethod
    def extract_matches(
        push_result: dict,
        machine_ids: dict[str, str],   # {pattern: machine_id}
    ) -> dict[str, bool]:
        """
        Given a push_result (from push()) and a mapping of pattern→machine_id,
        return {pattern: did_match_this_step}.

        A match is detected when the machine's outputVector is non-null and
        contains a value ≥ 0.5 (i.e., [1.0]).
        """
        machine_results: dict = push_result.get('step', {}).get('machineResults', {})
        matches: dict[str, bool] = {}

        for pattern, mid in machine_ids.items():
            result = machine_results.get(mid)
            if result is None:
                matches[pattern] = False
                continue
            ov = result.get('outputVector')
            matches[pattern] = (
                ov is not None
                and isinstance(ov, list)
                and len(ov) > 0
                and ov[0] >= 0.5
            )

        return matches

    # ── Config ────────────────────────────────────────────────────────────────

    def set_match_algorithm(self, algorithm: str = "gte") -> dict:
        """PATCH /api/config — set the PE's matchAlgorithm."""
        r = self._client.patch('/api/config', json={'matchAlgorithm': algorithm})
        r.raise_for_status()
        return r.json()

    def close(self) -> None:
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
