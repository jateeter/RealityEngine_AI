# Kleene Star (*) Operator Test - Reality Engine

This example demonstrates that the Reality Engine can implement **regular expression patterns** with the Kleene star operator (zero-or-more repetition) using critical event sequences with self-loops.

## What is the Kleene Star?

The **Kleene star** (`*`) is a fundamental operator in formal language theory and regular expressions:

- **E\*** = Zero or more occurrences of event E
- Examples:
  - `a*` matches: "", "a", "aa", "aaa", ...
  - `(ab)*` matches: "", "ab", "abab", "ababab", ...

## Pattern Definitions

This machine implements two patterns demonstrating Kleene star behavior:

### Pattern 1: `001+000*+010 -> [01]`

**Description:** Match 001, followed by zero or more 000, followed by 010, then output [0,1]

**Valid Sequences:**
- `001, 010` → [0,1] (zero occurrences of 000)
- `001, 000, 010` → [0,1] (one occurrence)
- `001, 000, 000, 010` → [0,1] (two occurrences)
- `001, 000, 000, 000, ..., 010` → [0,1] (n occurrences)

### Pattern 2: `010+(000+001)*+001 -> [10]`

**Description:** Match 010, followed by zero or more (000 OR 001), followed by 001, then output [1,0]

**Valid Sequences:**
- `010, 001` → [1,0] (zero occurrences)
- `010, 000, 001` → [1,0] (one 000)
- `010, 001, 001` → [1,0] (one 001)
- `010, 000, 001, 000, 001` → [1,0] (mixed)
- `010, 001, 000, 001, ..., 001` → [1,0] (n occurrences)

## Implementation

### Vector Format

- **Event Space**: 3D binary vectors (000, 001, 010, 011, 100, 101, 110, 111)
- **Output Space**: 2D binary vectors ([0,1], [1,0])

### Critical Event Sequence Structure

The Kleene star is implemented using **self-loops** and **exit paths**:

```
Sequence 1: 001+000*+010
┌─────────────────────────────────────────┐
│                                         │
│  [001]──┬──→[000]──┬──→[010]            │
│  init   │     ↑    │    final           │
│         │     └────┘    (output [0,1])  │
│         └───────────────→                │
│                                         │
│  • init activates loop AND final        │
│  • loop has self-edge (repetition)      │
│  • loop activates final (exit)          │
└─────────────────────────────────────────┘
```

```
Sequence 2: 010+(000+001)*+001
┌─────────────────────────────────────────┐
│                                         │
│  [010]──┬──→[000]──┬──→[001-final]      │
│  init   │     ↑  ↓ │    (output [1,0])  │
│         │     └──┼─┘                    │
│         ├──→[001]  │                    │
│         │   loop-b │                    │
│         │     ↑  ↓ │                    │
│         │     └──┼─┘                    │
│         └────────┴─→                    │
│                                         │
│  • init activates both loops AND final  │
│  • loops have cross-edges (alternation) │
│  • loops activate final (exit)          │
└─────────────────────────────────────────┘
```

### Key Implementation Details

1. **Zero-or-More**: Initial event activates BOTH loop events AND final event
   - Allows skipping the loop entirely (zero occurrences)
   - Allows entering the loop (one or more occurrences)

2. **Repetition**: Loop events have self-loops via `nextVectorIds`
   - Enables repeated matching of the same event

3. **Exit Path**: Loop events also activate the final event
   - Allows exiting the loop at any point

4. **Alternation**: In pattern 2, both loop events activate each other
   - Enables switching between alternatives (000 or 001)

## Running the Demo

```bash
# Compile TypeScript
npm run build

# Run the demonstration
node dist/examples/kleene-star-operator/run-kleene-star-demo.js
```

## Expected Output

The demo will:
1. Initialize the Reality Engine
2. Load 2 Kleene star sequences
3. Test zero, one, two, and multiple repetitions
4. Test alternation patterns
5. Run extended repetition tests (5+ loops)
6. Display results and verify correctness

## Test Cases

The demonstration includes comprehensive test cases:

- **Zero repetitions**: Skip directly to final event
- **One repetition**: Single loop iteration
- **Two repetitions**: Double loop iteration
- **Mixed alternation**: Switching between 000 and 001
- **Extended repetition**: 5+ loop iterations

## Significance

This demonstration proves:
- ✅ Reality Engine can implement regular expression patterns
- ✅ Kleene star operator works with zero-or-more semantics
- ✅ Self-loops enable repetition in event sequences
- ✅ Alternation can be combined with repetition
- ✅ Complex pattern matching is possible through state machine design

## Comparison to Traditional Regex Engines

| Feature | Traditional Regex | Reality Engine |
|---------|------------------|----------------|
| Kleene Star | Built-in operator `*` | Self-loops + exit paths |
| Repetition | Backtracking | State activation |
| Alternation | `\|` operator | Multiple next events |
| Pattern Matching | String scanning | Vector comparison |
| Output | Match/no-match | Custom output vectors |

## Files

- `kleene-star-sequences.ts` - Kleene star sequence definitions
- `run-kleene-star-demo.ts` - Demonstration runner
- `README.md` - This file

## Future Extensions

This pattern can be extended to implement other regex operators:
- **Plus operator** (+): One or more repetitions
- **Optional operator** (?): Zero or one occurrence
- **Bounded repetition** ({n,m}): Between n and m occurrences
- **Negation** (^): Match anything except pattern
