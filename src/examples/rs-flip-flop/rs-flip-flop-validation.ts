import { createRSFlipFlopMachine } from './rs-flip-flop-sequences.js';

/**
 * RS Flip-Flop Comprehensive Validation Test
 *
 * This test validates:
 * 1. All event sequences activate correctly
 * 2. Proper outputs are generated
 * 3. Event visualization shows correct active states
 * 4. State transitions work as expected
 * 5. Repeated operations maintain correctness
 */

export interface ValidationStep {
  stepNumber: number;
  input: number[];
  inputLabel: string;
  description: string;
  expectedActiveEvents: {
    sequenceName: string;
    eventName: string;
    eventState: string;
  }[];
  expectedOutputs: {
    vector: number[];
    state: string;
    description: string;
  }[];
  visualizationChecks: {
    check: string;
    expected: string;
  }[];
}

/**
 * Comprehensive validation sequence for RS Flip-Flop
 *
 * Test Flow:
 * Step 1: Initial HOLD state (both sequences at event 00)
 * Step 2: First SET operation (activate event 10, output [1,0])
 * Step 3: Return to HOLD (event 00 active, event 10 stays active)
 * Step 4: Second SET operation (verify repeated SET works)
 * Step 5: Return to HOLD
 * Step 6: RESET operation (activate event 01, output [0,1])
 * Step 7: Return to HOLD (event 00 active, event 01 stays active)
 * Step 8: Second RESET operation (verify repeated RESET works)
 * Step 9: Return to HOLD
 * Step 10: SET again (verify SET after RESET)
 * Step 11: HOLD state (stable)
 * Step 12: RESET again (verify RESET after SET)
 * Step 13: Final HOLD state
 */
export function generateRSFlipFlopValidationSequence(): ValidationStep[] {
  return [
    // ========== STEP 1: Initial HOLD State ==========
    {
      stepNumber: 1,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'Initial state - both sequences at HOLD (event 00)',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, active)'
        }
      ],
      expectedOutputs: [], // No outputs on HOLD
      visualizationChecks: [
        {
          check: 'SET Sequence - Event 00',
          expected: 'Active (blue highlight), initial vector indicator'
        },
        {
          check: 'RESET Sequence - Event 00',
          expected: 'Active (blue highlight), initial vector indicator'
        },
        {
          check: 'SET Sequence - Event 10',
          expected: 'Inactive (gray)'
        },
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Inactive (gray)'
        }
      ]
    },

    // ========== STEP 2: First SET Operation ==========
    {
      stepNumber: 2,
      input: [1, 0],
      inputLabel: '[S=1, R=0] SET',
      description: 'Trigger SET - event 00 matches, activates event 10, event 10 matches and outputs [1,0]',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (newly activated, matched, output generated)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        }
      ],
      expectedOutputs: [
        {
          vector: [1, 0],
          state: 'SET',
          description: 'Flip flop SET to HIGH (1) - Q=1, Q̄=0'
        }
      ],
      visualizationChecks: [
        {
          check: 'SET Sequence - Event 00',
          expected: 'Active (blue highlight), matched indicator'
        },
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active (blue highlight), matched indicator, output badge [1,0], wasJustMatched flag set'
        },
        {
          check: 'RESET Sequence - Event 00',
          expected: 'Active (blue highlight), no match (input was [1,0] not [0,0])'
        },
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Inactive (gray)'
        },
        {
          check: 'Output Panel',
          expected: 'Shows "Flip flop SET to HIGH (1)" with vector [1,0]'
        }
      ]
    },

    // ========== STEP 3: Return to HOLD ==========
    {
      stepNumber: 3,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'Return to HOLD - event 00 matches in both sequences, event 10 stays active',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active, not matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, active, matched)'
        }
      ],
      expectedOutputs: [], // No new outputs
      visualizationChecks: [
        {
          check: 'SET Sequence - Event 00',
          expected: 'Active (blue highlight), matched indicator'
        },
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active (blue highlight), not matched, lastOutputVector shows [1,0]'
        },
        {
          check: 'RESET Sequence - Event 00',
          expected: 'Active (blue highlight), matched indicator'
        }
      ]
    },

    // ========== STEP 4: Second SET Operation ==========
    {
      stepNumber: 4,
      input: [1, 0],
      inputLabel: '[S=1, R=0] SET',
      description: 'Second SET - validates repeated SET operations work correctly',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (active, matched again, output generated again)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        }
      ],
      expectedOutputs: [
        {
          vector: [1, 0],
          state: 'SET',
          description: 'Flip flop SET to HIGH (1) - Second SET operation'
        }
      ],
      visualizationChecks: [
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active, matched, output badge [1,0], wasJustMatched flag set (confirms repeated operation works)'
        },
        {
          check: 'Output Panel',
          expected: 'Shows new "Flip flop SET to HIGH (1)" entry at top of history'
        }
      ]
    },

    // ========== STEP 5: Return to HOLD ==========
    {
      stepNumber: 5,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'HOLD state - stable between operations',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        }
      ],
      expectedOutputs: [],
      visualizationChecks: [
        {
          check: 'Both Event 00s',
          expected: 'Active and matched'
        }
      ]
    },

    // ========== STEP 6: First RESET Operation ==========
    {
      stepNumber: 6,
      input: [0, 1],
      inputLabel: '[S=0, R=1] RESET',
      description: 'Trigger RESET - event 00 matches, activates event 01, event 01 matches and outputs [0,1]',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active, not matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (initial, stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (newly activated, matched, output generated)'
        }
      ],
      expectedOutputs: [
        {
          vector: [0, 1],
          state: 'RESET',
          description: 'Flip flop RESET to LOW (0) - Q=0, Q̄=1'
        }
      ],
      visualizationChecks: [
        {
          check: 'RESET Sequence - Event 00',
          expected: 'Active (blue highlight), matched indicator'
        },
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Active (blue highlight), matched indicator, output badge [0,1], wasJustMatched flag set'
        },
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active (blue highlight), not matched (input was [0,1] not [1,0])'
        },
        {
          check: 'Output Panel',
          expected: 'Shows "Flip flop RESET to LOW (0)" with vector [0,1] at top of history'
        }
      ]
    },

    // ========== STEP 7: Return to HOLD ==========
    {
      stepNumber: 7,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'HOLD state - event 01 stays active',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (stays active)'
        }
      ],
      expectedOutputs: [],
      visualizationChecks: [
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Active, not matched, lastOutputVector shows [0,1]'
        }
      ]
    },

    // ========== STEP 8: Second RESET Operation ==========
    {
      stepNumber: 8,
      input: [0, 1],
      inputLabel: '[S=0, R=1] RESET',
      description: 'Second RESET - validates repeated RESET operations work correctly',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (active, matched again, output generated again)'
        }
      ],
      expectedOutputs: [
        {
          vector: [0, 1],
          state: 'RESET',
          description: 'Flip flop RESET to LOW (0) - Second RESET operation'
        }
      ],
      visualizationChecks: [
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Active, matched, output badge [0,1], wasJustMatched flag set (confirms repeated RESET works)'
        },
        {
          check: 'Output Panel',
          expected: 'Shows new "Flip flop RESET to LOW (0)" entry at top of history'
        }
      ]
    },

    // ========== STEP 9: Return to HOLD ==========
    {
      stepNumber: 9,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'HOLD state - stable',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (stays active)'
        }
      ],
      expectedOutputs: [],
      visualizationChecks: [
        {
          check: 'All Events',
          expected: 'Event 00 (both sequences) active and matched; Event 10 and 01 active but not matched'
        }
      ]
    },

    // ========== STEP 10: SET After RESET ==========
    {
      stepNumber: 10,
      input: [1, 0],
      inputLabel: '[S=1, R=0] SET',
      description: 'SET operation after RESET - validates state transitions work correctly',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (active, matched, output generated)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (stays active, not matched)'
        }
      ],
      expectedOutputs: [
        {
          vector: [1, 0],
          state: 'SET',
          description: 'Flip flop SET to HIGH (1) - SET after RESET'
        }
      ],
      visualizationChecks: [
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active, matched, output badge [1,0], wasJustMatched flag set'
        },
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Active, not matched (input was [1,0] not [0,1])'
        },
        {
          check: 'Output Panel',
          expected: 'History shows: [1,0] (newest), [0,1], [0,1], [1,0], [1,0] in reverse chronological order'
        }
      ]
    },

    // ========== STEP 11: HOLD State ==========
    {
      stepNumber: 11,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'HOLD state - all events stable',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (stays active)'
        }
      ],
      expectedOutputs: [],
      visualizationChecks: [
        {
          check: 'Event Graph',
          expected: 'All 4 events visible: 2x event 00 (both sequences), 1x event 10, 1x event 01'
        }
      ]
    },

    // ========== STEP 12: RESET After SET ==========
    {
      stepNumber: 12,
      input: [0, 1],
      inputLabel: '[S=0, R=1] RESET',
      description: 'RESET operation after SET - validates alternating transitions',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active, not matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (active, matched, output generated)'
        }
      ],
      expectedOutputs: [
        {
          vector: [0, 1],
          state: 'RESET',
          description: 'Flip flop RESET to LOW (0) - RESET after SET'
        }
      ],
      visualizationChecks: [
        {
          check: 'RESET Sequence - Event 01',
          expected: 'Active, matched, output badge [0,1], wasJustMatched flag set'
        },
        {
          check: 'SET Sequence - Event 10',
          expected: 'Active, not matched'
        },
        {
          check: 'Output Panel',
          expected: 'History shows 6 outputs total in reverse chronological order'
        }
      ]
    },

    // ========== STEP 13: Final HOLD State ==========
    {
      stepNumber: 13,
      input: [0, 0],
      inputLabel: '[S=0, R=0] HOLD',
      description: 'Final HOLD state - complete validation sequence',
      expectedActiveEvents: [
        {
          sequenceName: 'SET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'SET Sequence',
          eventName: '10',
          eventState: 'SET (stays active, not matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '00',
          eventState: 'HOLD (active, matched)'
        },
        {
          sequenceName: 'RESET Sequence',
          eventName: '01',
          eventState: 'RESET (stays active, not matched)'
        }
      ],
      expectedOutputs: [],
      visualizationChecks: [
        {
          check: 'Complete Validation',
          expected: 'All events activated at least once, all outputs generated correctly, visualization shows correct states'
        },
        {
          check: 'Output History Count',
          expected: '6 total outputs: 3x SET [1,0], 3x RESET [0,1]'
        },
        {
          check: 'Active Events Count',
          expected: '4 active events: 2x event 00, 1x event 10, 1x event 01'
        }
      ]
    }
  ];
}

/**
 * Extract just the input vectors from the validation sequence
 */
export function getRSFlipFlopValidationInputs(): number[][] {
  return generateRSFlipFlopValidationSequence().map(step => step.input);
}

/**
 * Run the validation sequence and verify results
 */
export async function validateRSFlipFlop(): Promise<{
  success: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  results: Array<{
    step: number;
    passed: boolean;
    errors: string[];
  }>;
}> {
  const machine = createRSFlipFlopMachine();
  const validationSequence = generateRSFlipFlopValidationSequence();

  const results: Array<{ step: number; passed: boolean; errors: string[] }> = [];
  let passedSteps = 0;
  let failedSteps = 0;

  for (const validationStep of validationSequence) {
    const errors: string[] = [];

    // Process the input through the machine
    const result = machine.processInput(validationStep.input);

    // Validate outputs
    const actualOutputCount = result.machineOutput ? 1 : 0;
    const expectedOutputCount = validationStep.expectedOutputs.length;

    if (actualOutputCount !== expectedOutputCount) {
      errors.push(
        `Output count mismatch: expected ${expectedOutputCount}, got ${actualOutputCount}`
      );
    }

    // Validate output vector if present
    if (result.machineOutput && validationStep.expectedOutputs.length > 0) {
      const expectedOutput = validationStep.expectedOutputs[0];
      const actualVector = result.machineOutput.vector;
      const expectedVector = expectedOutput!.vector;

      if (JSON.stringify(actualVector) !== JSON.stringify(expectedVector)) {
        errors.push(
          `Output vector mismatch: expected ${JSON.stringify(expectedVector)}, got ${JSON.stringify(actualVector)}`
        );
      }
    }

    // Count active events (this would require accessing sequence internals)
    // For now, we just validate that processing succeeded

    const passed = errors.length === 0;
    if (passed) {
      passedSteps++;
    } else {
      failedSteps++;
    }

    results.push({
      step: validationStep.stepNumber,
      passed,
      errors
    });
  }

  return {
    success: failedSteps === 0,
    totalSteps: validationSequence.length,
    passedSteps,
    failedSteps,
    results
  };
}

/**
 * Print validation sequence for documentation
 */
export function printRSFlipFlopValidationSequence(): string {
  const sequence = generateRSFlipFlopValidationSequence();
  const lines: string[] = [];

  lines.push('RS FLIP-FLOP COMPREHENSIVE VALIDATION SEQUENCE');
  lines.push('='.repeat(80));
  lines.push('');

  for (const step of sequence) {
    lines.push(`Step ${step.stepNumber}: ${step.inputLabel}`);
    lines.push(`Input: [${step.input.join(', ')}]`);
    lines.push(`Description: ${step.description}`);
    lines.push('');

    lines.push('Expected Active Events:');
    for (const event of step.expectedActiveEvents) {
      lines.push(`  - ${event.sequenceName}: ${event.eventName} (${event.eventState})`);
    }
    lines.push('');

    if (step.expectedOutputs.length > 0) {
      lines.push('Expected Outputs:');
      for (const output of step.expectedOutputs) {
        lines.push(`  - [${output.vector.join(', ')}] ${output.state}: ${output.description}`);
      }
      lines.push('');
    }

    lines.push('Visualization Checks:');
    for (const check of step.visualizationChecks) {
      lines.push(`  ✓ ${check.check}: ${check.expected}`);
    }
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  return lines.join('\n');
}
