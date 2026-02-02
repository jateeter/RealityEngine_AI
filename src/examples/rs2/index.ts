/**
 * RS2 Example
 *
 * A two-step RS flip-flop machine with:
 * - SET sequence: (0,0) → (1,0) outputs [1,0]
 * - RESET sequence: (0,0) → (0,1) outputs [0,1]
 * - Perceptual mapping: reads En[4:6], writes En[8:10]
 *
 * This example demonstrates 2-step sequences where the machine waits
 * for a hold state (0,0) before transitioning to SET or RESET.
 */

export {
  createSetSequence,
  createResetSequence,
  createRS2Sequences,
  createRS2Machine,
  generateRS2TestVectors
} from './rs2-sequences.js';
