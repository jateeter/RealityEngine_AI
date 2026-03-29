"""
Perceptual vector encoding for the regex LangGraph orchestrator.

Perceptual space layout (256 cells):
  [200:238] — character input region (38 cells)
    [200:226] — one-hot for lowercase a-z  (26 cells, index 0-25)
    [226:236] — one-hot for digits 0-9     (10 cells, index 26-35)
    [236]     — space character            (1 cell,   index 36)
    [237]     — end-of-string sentinel     (1 cell,   index 37)
  [238:246] — match output region         (8 cells, one per pattern)
"""

CHAR_REGION_OFFSET = 200
CHAR_REGION_LENGTH = 38    # 26 + 10 + 1 (space) + 1 (EOS)

OUTPUT_REGION_OFFSET = 238
OUTPUT_REGION_LENGTH = 8   # supports up to 8 simultaneous patterns

# Ordered alphabet: a-z (0-25), 0-9 (26-35), space (36), EOS (37)
LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
DIGITS = '0123456789'
ALPHABET_CHARS = LOWERCASE + DIGITS + ' '  # 37 printable chars

CHAR_TO_IDX: dict[str, int] = {c: i for i, c in enumerate(ALPHABET_CHARS)}
EOS_IDX = 37  # end-of-string sentinel index within region

MAX_PATTERNS = OUTPUT_REGION_LENGTH


def char_to_region_vector(ch: str) -> list[float]:
    """
    Encode a single character as a one-hot vector within the 38-cell region.

    Returns a list of 38 floats: exactly one cell is 1.0, the rest are 0.0.
    Unsupported characters produce an all-zero vector.
    """
    vec = [0.0] * CHAR_REGION_LENGTH
    if ch == '\x00':          # explicit EOS sentinel
        vec[EOS_IDX] = 1.0
    elif ch in CHAR_TO_IDX:
        vec[CHAR_TO_IDX[ch]] = 1.0
    # Else: unsupported char → all-zero (no cell fires, no CES vector matches)
    return vec


def build_perceptual_vector(region_vec: list[float]) -> list[float]:
    """
    Embed a 38-cell region vector into a full 256-cell perceptual vector.

    All cells outside the character input region are 0.0.
    """
    if len(region_vec) != CHAR_REGION_LENGTH:
        raise ValueError(
            f"region_vec must have {CHAR_REGION_LENGTH} elements, got {len(region_vec)}"
        )
    vec = [0.0] * 256
    for i, v in enumerate(region_vec):
        vec[CHAR_REGION_OFFSET + i] = v
    return vec


def encode_char(ch: str) -> list[float]:
    """Encode a character as a full 256-cell perceptual vector."""
    return build_perceptual_vector(char_to_region_vector(ch))


def encode_eos() -> list[float]:
    """Encode the end-of-string sentinel as a full 256-cell perceptual vector."""
    return encode_char('\x00')
