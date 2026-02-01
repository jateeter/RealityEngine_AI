import { CriticalEventSequence } from '../../models/CriticalEventSequence.js';
import { RealityVector } from '../../models/RealityVector.js';
import { Machine } from '../../models/Machine.js';
import { ComparatorType } from '../../models/types.js';
import type { OutputVector } from '../../models/types.js';

/**
 * Robotics Assembly System - Specification Example
 *
 * Demonstrates:
 * - 5 critical event sequences
 * - 5-dimensional input space
 * - 3-dimensional output space
 * - Average sequence length: 10 events
 * - Match threshold: 0.60 for all events
 * - 7+ output events across sequences
 * - Sample run generating 10+ outputs
 *
 * Input Space (5D): Robotic assembly system sensors
 * [0] ARM_POSITION    - Robotic arm position (0.0-1.0, normalized 0-360°)
 * [1] GRIPPER_FORCE   - Gripper force sensor (0.0-1.0, normalized 0-100N)
 * [2] CONVEYOR_SPEED  - Conveyor belt speed (0.0-1.0, normalized 0-2 m/s)
 * [3] VISION_CONF     - Vision system confidence (0.0-1.0, 0-100%)
 * [4] TOOL_TEMP       - Tool temperature (0.0-1.0, normalized 20-120°C)
 *
 * Output Space (3D): Assembly actions and status
 * [0] ACTION_CODE     - Action type (1.0=PICK, 2.0=PLACE, 3.0=INSPECT, 4.0=CHANGE_TOOL, 5.0=STOP, 6.0=CALIBRATE)
 * [1] SPEED_MODIFIER  - Speed adjustment (0.0-1.0, percentage of max speed)
 * [2] QUALITY_FLAG    - Quality indicator (0.0=FAIL, 0.5=WARNING, 1.0=PASS)
 */

/**
 * Create output vector for robotic actions
 */
function createOutput(
  actionCode: number,
  speedModifier: number,
  qualityFlag: number,
  description: string
): OutputVector {
  return {
    id: `output-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    vector: [actionCode, speedModifier, qualityFlag],
    timestamp: Date.now(),
    metadata: {
      description,
      actionType: getActionName(actionCode),
      speed: `${(speedModifier * 100).toFixed(0)}%`,
      quality: getQualityName(qualityFlag)
    }
  };
}

function getActionName(code: number): string {
  const actions: Record<number, string> = {
    1.0: 'PICK',
    2.0: 'PLACE',
    3.0: 'INSPECT',
    4.0: 'CHANGE_TOOL',
    5.0: 'EMERGENCY_STOP',
    6.0: 'CALIBRATE'
  };
  return actions[code] || 'UNKNOWN';
}

function getQualityName(flag: number): string {
  if (flag === 0.0) return 'FAIL';
  if (flag === 0.5) return 'WARNING';
  if (flag === 1.0) return 'PASS';
  return 'UNKNOWN';
}

/**
 * Sequence 1: Pick and Place Sequence (10 events, 2 outputs)
 *
 * This sequence represents a complete pick-and-place operation:
 * 1. Home position
 * 2. Move to pick position
 * 3. Approach workpiece
 * 4. Align with workpiece
 * 5. Lower gripper -> OUTPUT: PICK action
 * 6. Close gripper
 * 7. Lift workpiece
 * 8. Move to place position
 * 9. Lower to place
 * 10. Release gripper -> OUTPUT: PLACE action
 */
export function createPickAndPlaceSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Pick and Place Operation');
  const threshold = 0.60; // Match threshold for all events

  // Event 1: Home position (initial)
  const home = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: home (0°)
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: no force
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: medium
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }, // VISION_CONF: any
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }  // TOOL_TEMP: any
    ],
    true
  );
  home.metadata = { step: 1, name: 'Home Position', description: 'Arm at home position (0°)' };
  seq.addVector(home);

  // Event 2: Move to pick position
  const moveToPick = new RealityVector(
    [
      { value: 0.25, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 90°
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  moveToPick.metadata = { step: 2, name: 'Move to Pick', description: 'Moving to pick position (90°)' };
  home.addNextVector(moveToPick.id);
  seq.addVector(moveToPick);

  // Event 3: Approach workpiece
  const approach = new RealityVector(
    [
      { value: 0.30, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 108°
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: slow
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold }, // VISION_CONF: high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  approach.metadata = { step: 3, name: 'Approach', description: 'Approaching workpiece with vision' };
  moveToPick.addNextVector(approach.id);
  seq.addVector(approach);

  // Event 4: Align with workpiece
  const align = new RealityVector(
    [
      { value: 0.33, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 119°
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.1, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: very slow
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold }, // VISION_CONF: very high
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  align.metadata = { step: 4, name: 'Align', description: 'Fine alignment with workpiece' };
  approach.addNextVector(align.id);
  seq.addVector(align);

  // Event 5: Lower gripper -> OUTPUT: PICK
  const lowerGripper = new RealityVector(
    [
      { value: 0.35, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 126°
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: stopped
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  lowerGripper.metadata = { step: 5, name: 'Lower Gripper', description: 'Lowering gripper to workpiece' };
  lowerGripper.addOutputVector(createOutput(1.0, 0.5, 1.0, 'PICK: Gripper lowered, ready to grasp'));
  align.addNextVector(lowerGripper.id);
  seq.addVector(lowerGripper);

  // Event 6: Close gripper
  const closeGripper = new RealityVector(
    [
      { value: 0.35, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: 50N
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  closeGripper.metadata = { step: 6, name: 'Close Gripper', description: 'Gripper closed, holding workpiece' };
  lowerGripper.addNextVector(closeGripper.id);
  seq.addVector(closeGripper);

  // Event 7: Lift workpiece
  const lift = new RealityVector(
    [
      { value: 0.40, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 144°
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: 60N
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  lift.metadata = { step: 7, name: 'Lift', description: 'Lifting workpiece' };
  closeGripper.addNextVector(lift.id);
  seq.addVector(lift);

  // Event 8: Move to place position
  const moveToPlace = new RealityVector(
    [
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 270°
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: medium
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  moveToPlace.metadata = { step: 8, name: 'Move to Place', description: 'Moving to placement position (270°)' };
  lift.addNextVector(moveToPlace.id);
  seq.addVector(moveToPlace);

  // Event 9: Lower to place
  const lowerToPlace = new RealityVector(
    [
      { value: 0.78, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 281°
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold }, // CONVEYOR_SPEED: stopped
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  lowerToPlace.metadata = { step: 9, name: 'Lower to Place', description: 'Lowering workpiece to placement' };
  moveToPlace.addNextVector(lowerToPlace.id);
  seq.addVector(lowerToPlace);

  // Event 10: Release gripper -> OUTPUT: PLACE
  const release = new RealityVector(
    [
      { value: 0.80, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 288°
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: 0N (released)
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  release.metadata = { step: 10, name: 'Release', description: 'Gripper released, workpiece placed' };
  release.addOutputVector(createOutput(2.0, 0.5, 1.0, 'PLACE: Workpiece placed successfully'));
  lowerToPlace.addNextVector(release.id);
  seq.addVector(release);

  return seq;
}

/**
 * Sequence 2: Quality Inspection Sequence (10 events, 2 outputs)
 *
 * Visual inspection of workpiece quality using vision system
 */
export function createQualityInspectionSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Quality Inspection Operation');
  const threshold = 0.60;

  // Event 1: Inspection start position (initial)
  const inspectStart = new RealityVector(
    [
      { value: 0.50, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 180° (inspection station)
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    true
  );
  inspectStart.metadata = { step: 1, name: 'Inspection Start', description: 'Move to inspection station' };
  seq.addVector(inspectStart);

  // Events 2-5: Move through inspection positions
  const inspectPos2 = new RealityVector(
    [
      { value: 0.52, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.6, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inspectPos2.metadata = { step: 2, name: 'Scan Position 1', description: 'First scan position' };
  inspectStart.addNextVector(inspectPos2.id);
  seq.addVector(inspectPos2);

  const inspectPos3 = new RealityVector(
    [
      { value: 0.54, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.1, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.7, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inspectPos3.metadata = { step: 3, name: 'Scan Position 2', description: 'Second scan position' };
  inspectPos2.addNextVector(inspectPos3.id);
  seq.addVector(inspectPos3);

  const inspectPos4 = new RealityVector(
    [
      { value: 0.56, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.75, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inspectPos4.metadata = { step: 4, name: 'Scan Position 3', description: 'Third scan position' };
  inspectPos3.addNextVector(inspectPos4.id);
  seq.addVector(inspectPos4);

  const inspectPos5 = new RealityVector(
    [
      { value: 0.58, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inspectPos5.metadata = { step: 5, name: 'Scan Position 4', description: 'Fourth scan position' };
  inspectPos4.addNextVector(inspectPos5.id);
  seq.addVector(inspectPos5);

  // Event 6: Analysis position -> OUTPUT: INSPECT (preliminary)
  const analyze = new RealityVector(
    [
      { value: 0.60, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.85, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  analyze.metadata = { step: 6, name: 'Analyze', description: 'Analyzing scan data' };
  analyze.addOutputVector(createOutput(3.0, 0.3, 0.5, 'INSPECT: Preliminary analysis - checking details'));
  inspectPos5.addNextVector(analyze.id);
  seq.addVector(analyze);

  // Events 7-9: Detailed inspection
  const detail1 = new RealityVector(
    [
      { value: 0.62, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.88, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  detail1.metadata = { step: 7, name: 'Detail Check 1', description: 'Detailed inspection - surface' };
  analyze.addNextVector(detail1.id);
  seq.addVector(detail1);

  const detail2 = new RealityVector(
    [
      { value: 0.64, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.90, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  detail2.metadata = { step: 8, name: 'Detail Check 2', description: 'Detailed inspection - edges' };
  detail1.addNextVector(detail2.id);
  seq.addVector(detail2);

  const detail3 = new RealityVector(
    [
      { value: 0.66, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.92, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  detail3.metadata = { step: 9, name: 'Detail Check 3', description: 'Detailed inspection - dimensions' };
  detail2.addNextVector(detail3.id);
  seq.addVector(detail3);

  // Event 10: Final inspection result -> OUTPUT: INSPECT (final)
  const inspectFinal = new RealityVector(
    [
      { value: 0.68, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 }
    ],
    false
  );
  inspectFinal.metadata = { step: 10, name: 'Inspection Complete', description: 'Quality inspection complete' };
  inspectFinal.addOutputVector(createOutput(3.0, 0.5, 1.0, 'INSPECT: Quality check PASSED - workpiece approved'));
  detail3.addNextVector(inspectFinal.id);
  seq.addVector(inspectFinal);

  return seq;
}

/**
 * Sequence 3: Tool Change Sequence (10 events, 1 output)
 *
 * Automated tool changing procedure
 */
export function createToolChangeSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Tool Change Operation');
  const threshold = 0.60;

  // Event 1: Tool change start (initial)
  const changeStart = new RealityVector(
    [
      { value: 0.90, comparatorType: ComparatorType.THRESHOLD, threshold }, // ARM_POSITION: 324° (tool rack)
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.3, comparatorType: ComparatorType.THRESHOLD, threshold } // TOOL_TEMP: warm
    ],
    true
  );
  changeStart.metadata = { step: 1, name: 'Tool Change Start', description: 'Move to tool rack' };
  seq.addVector(changeStart);

  // Events 2-9: Tool change procedure
  const positions = [0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98];
  const temps = [0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.1, 0.1];
  let prevEvent = changeStart;

  for (let i = 0; i < 8; i++) {
    const event = new RealityVector(
      [
        { value: positions[i]!, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
        { value: temps[i]!, comparatorType: ComparatorType.THRESHOLD, threshold }
      ],
      false
    );
    event.metadata = {
      step: i + 2,
      name: `Tool Change Step ${i + 2}`,
      description: `Tool change procedure step ${i + 2}`
    };
    prevEvent.addNextVector(event.id);
    seq.addVector(event);
    prevEvent = event;
  }

  // Event 10: Tool change complete -> OUTPUT: CHANGE_TOOL
  const changeComplete = new RealityVector(
    [
      { value: 0.99, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.1, comparatorType: ComparatorType.THRESHOLD, threshold } // TOOL_TEMP: cool (new tool)
    ],
    false
  );
  changeComplete.metadata = { step: 10, name: 'Tool Change Complete', description: 'New tool installed and ready' };
  changeComplete.addOutputVector(createOutput(4.0, 0.8, 1.0, 'CHANGE_TOOL: Tool change completed successfully'));
  prevEvent.addNextVector(changeComplete.id);
  seq.addVector(changeComplete);

  return seq;
}

/**
 * Sequence 4: Emergency Stop Sequence (10 events, 1 output)
 *
 * Safety shutdown procedure
 */
export function createEmergencyStopSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Emergency Stop Operation');
  const threshold = 0.60;

  // Event 1: Anomaly detected (initial)
  const anomaly = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.9, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: excessive
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.8, comparatorType: ComparatorType.THRESHOLD, threshold } // TOOL_TEMP: high
    ],
    true
  );
  anomaly.metadata = { step: 1, name: 'Anomaly Detected', description: 'High force and temperature detected' };
  seq.addVector(anomaly);

  // Events 2-9: Emergency stop progression
  const forces = [0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98];
  const temps = [0.82, 0.84, 0.86, 0.88, 0.90, 0.92, 0.94, 0.96];
  let prevEvent = anomaly;

  for (let i = 0; i < 8; i++) {
    const event = new RealityVector(
      [
        { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
        { value: forces[i]!, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
        { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
        { value: temps[i]!, comparatorType: ComparatorType.THRESHOLD, threshold }
      ],
      false
    );
    event.metadata = {
      step: i + 2,
      name: `Emergency Step ${i + 2}`,
      description: `Emergency escalation step ${i + 2}`
    };
    prevEvent.addNextVector(event.id);
    seq.addVector(event);
    prevEvent = event;
  }

  // Event 10: Emergency stop activated -> OUTPUT: EMERGENCY_STOP
  const stopActivated = new RealityVector(
    [
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.99, comparatorType: ComparatorType.THRESHOLD, threshold }, // GRIPPER_FORCE: critical
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.0, comparatorType: ComparatorType.PATTERN, threshold: 0.0 },
      { value: 0.98, comparatorType: ComparatorType.THRESHOLD, threshold } // TOOL_TEMP: critical
    ],
    false
  );
  stopActivated.metadata = { step: 10, name: 'EMERGENCY STOP', description: 'Emergency stop activated' };
  stopActivated.addOutputVector(createOutput(5.0, 0.0, 0.0, 'EMERGENCY_STOP: System halted - safety engaged'));
  prevEvent.addNextVector(stopActivated.id);
  seq.addVector(stopActivated);

  return seq;
}

/**
 * Sequence 5: Calibration Sequence (10 events, 1 output)
 *
 * System calibration and homing procedure
 */
export function createCalibrationSequence(): CriticalEventSequence {
  const seq = new CriticalEventSequence('Calibration Operation');
  const threshold = 0.60;

  // Event 1: Calibration start (initial)
  const calStart = new RealityVector(
    [
      { value: 0.05, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.5, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold }
    ],
    true
  );
  calStart.metadata = { step: 1, name: 'Calibration Start', description: 'Begin calibration procedure' };
  seq.addVector(calStart);

  // Events 2-9: Calibration positions
  const positions = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80];
  const visions = [0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90];
  let prevEvent = calStart;

  for (let i = 0; i < 8; i++) {
    const event = new RealityVector(
      [
        { value: positions[i]!, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: visions[i]!, comparatorType: ComparatorType.THRESHOLD, threshold },
        { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold }
      ],
      false
    );
    event.metadata = {
      step: i + 2,
      name: `Calibration Point ${i + 2}`,
      description: `Calibrating at position ${positions[i]!.toFixed(2)}`
    };
    prevEvent.addNextVector(event.id);
    seq.addVector(event);
    prevEvent = event;
  }

  // Event 10: Calibration complete -> OUTPUT: CALIBRATE
  const calComplete = new RealityVector(
    [
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.0, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.95, comparatorType: ComparatorType.THRESHOLD, threshold },
      { value: 0.2, comparatorType: ComparatorType.THRESHOLD, threshold }
    ],
    false
  );
  calComplete.metadata = { step: 10, name: 'Calibration Complete', description: 'System calibration successful' };
  calComplete.addOutputVector(createOutput(6.0, 1.0, 1.0, 'CALIBRATE: System calibrated and ready'));
  prevEvent.addNextVector(calComplete.id);
  seq.addVector(calComplete);

  return seq;
}

/**
 * Generate comprehensive test input vectors
 *
 * This sample run will trigger outputs 10+ times by:
 * - Completing Pick and Place sequence twice (4 outputs)
 * - Completing Quality Inspection sequence twice (4 outputs)
 * - Completing Tool Change sequence once (1 output)
 * - Completing Emergency Stop sequence once (1 output)
 * - Completing Calibration sequence once (1 output)
 * Total: 11 outputs
 */
export function generateRoboticsTestVectors(): Array<{
  vector: number[];
  description: string;
  timestamp?: string;
  expectedOutput?: string;
}> {
  return [
    // ===== First Pick and Place Cycle =====
    { vector: [0.0, 0.0, 0.5, 0.0, 0.0], description: 'Step 1: Home position', timestamp: '00:00' },
    { vector: [0.25, 0.0, 0.5, 0.0, 0.0], description: 'Step 2: Move to pick', timestamp: '00:01' },
    { vector: [0.30, 0.0, 0.3, 0.8, 0.0], description: 'Step 3: Approach workpiece', timestamp: '00:02' },
    { vector: [0.33, 0.0, 0.1, 0.9, 0.0], description: 'Step 4: Align', timestamp: '00:03' },
    { vector: [0.35, 0.0, 0.0, 0.9, 0.0], description: 'Step 5: Lower gripper → OUTPUT 1', timestamp: '00:04', expectedOutput: 'PICK' },
    { vector: [0.35, 0.5, 0.0, 0.9, 0.0], description: 'Step 6: Close gripper', timestamp: '00:05' },
    { vector: [0.40, 0.6, 0.0, 0.7, 0.0], description: 'Step 7: Lift workpiece', timestamp: '00:06' },
    { vector: [0.75, 0.6, 0.5, 0.0, 0.0], description: 'Step 8: Move to place', timestamp: '00:07' },
    { vector: [0.78, 0.6, 0.0, 0.8, 0.0], description: 'Step 9: Lower to place', timestamp: '00:08' },
    { vector: [0.80, 0.0, 0.0, 0.8, 0.0], description: 'Step 10: Release → OUTPUT 2', timestamp: '00:09', expectedOutput: 'PLACE' },

    // ===== First Quality Inspection =====
    { vector: [0.50, 0.0, 0.5, 0.5, 0.0], description: 'Step 11: Inspection start', timestamp: '00:10' },
    { vector: [0.52, 0.0, 0.3, 0.6, 0.0], description: 'Step 12: Scan position 1', timestamp: '00:11' },
    { vector: [0.54, 0.0, 0.1, 0.7, 0.0], description: 'Step 13: Scan position 2', timestamp: '00:12' },
    { vector: [0.56, 0.0, 0.0, 0.75, 0.0], description: 'Step 14: Scan position 3', timestamp: '00:13' },
    { vector: [0.58, 0.0, 0.0, 0.8, 0.0], description: 'Step 15: Scan position 4', timestamp: '00:14' },
    { vector: [0.60, 0.0, 0.0, 0.85, 0.0], description: 'Step 16: Analyze → OUTPUT 3', timestamp: '00:15', expectedOutput: 'INSPECT (preliminary)' },
    { vector: [0.62, 0.0, 0.0, 0.88, 0.0], description: 'Step 17: Detail check 1', timestamp: '00:16' },
    { vector: [0.64, 0.0, 0.0, 0.90, 0.0], description: 'Step 18: Detail check 2', timestamp: '00:17' },
    { vector: [0.66, 0.0, 0.0, 0.92, 0.0], description: 'Step 19: Detail check 3', timestamp: '00:18' },
    { vector: [0.68, 0.0, 0.2, 0.95, 0.0], description: 'Step 20: Inspection complete → OUTPUT 4', timestamp: '00:19', expectedOutput: 'INSPECT (final)' },

    // ===== Second Pick and Place Cycle =====
    { vector: [0.0, 0.0, 0.5, 0.0, 0.0], description: 'Step 21: Home position', timestamp: '00:20' },
    { vector: [0.25, 0.0, 0.5, 0.0, 0.0], description: 'Step 22: Move to pick', timestamp: '00:21' },
    { vector: [0.30, 0.0, 0.3, 0.8, 0.0], description: 'Step 23: Approach workpiece', timestamp: '00:22' },
    { vector: [0.33, 0.0, 0.1, 0.9, 0.0], description: 'Step 24: Align', timestamp: '00:23' },
    { vector: [0.35, 0.0, 0.0, 0.9, 0.0], description: 'Step 25: Lower gripper → OUTPUT 5', timestamp: '00:24', expectedOutput: 'PICK' },
    { vector: [0.35, 0.5, 0.0, 0.9, 0.0], description: 'Step 26: Close gripper', timestamp: '00:25' },
    { vector: [0.40, 0.6, 0.0, 0.7, 0.0], description: 'Step 27: Lift workpiece', timestamp: '00:26' },
    { vector: [0.75, 0.6, 0.5, 0.0, 0.0], description: 'Step 28: Move to place', timestamp: '00:27' },
    { vector: [0.78, 0.6, 0.0, 0.8, 0.0], description: 'Step 29: Lower to place', timestamp: '00:28' },
    { vector: [0.80, 0.0, 0.0, 0.8, 0.0], description: 'Step 30: Release → OUTPUT 6', timestamp: '00:29', expectedOutput: 'PLACE' },

    // ===== Second Quality Inspection =====
    { vector: [0.50, 0.0, 0.5, 0.5, 0.0], description: 'Step 31: Inspection start', timestamp: '00:30' },
    { vector: [0.52, 0.0, 0.3, 0.6, 0.0], description: 'Step 32: Scan position 1', timestamp: '00:31' },
    { vector: [0.54, 0.0, 0.1, 0.7, 0.0], description: 'Step 33: Scan position 2', timestamp: '00:32' },
    { vector: [0.56, 0.0, 0.0, 0.75, 0.0], description: 'Step 34: Scan position 3', timestamp: '00:33' },
    { vector: [0.58, 0.0, 0.0, 0.8, 0.0], description: 'Step 35: Scan position 4', timestamp: '00:34' },
    { vector: [0.60, 0.0, 0.0, 0.85, 0.0], description: 'Step 36: Analyze → OUTPUT 7', timestamp: '00:35', expectedOutput: 'INSPECT (preliminary)' },
    { vector: [0.62, 0.0, 0.0, 0.88, 0.0], description: 'Step 37: Detail check 1', timestamp: '00:36' },
    { vector: [0.64, 0.0, 0.0, 0.90, 0.0], description: 'Step 38: Detail check 2', timestamp: '00:37' },
    { vector: [0.66, 0.0, 0.0, 0.92, 0.0], description: 'Step 39: Detail check 3', timestamp: '00:38' },
    { vector: [0.68, 0.0, 0.2, 0.95, 0.0], description: 'Step 40: Inspection complete → OUTPUT 8', timestamp: '00:39', expectedOutput: 'INSPECT (final)' },

    // ===== Tool Change =====
    { vector: [0.90, 0.0, 0.0, 0.0, 0.3], description: 'Step 41: Tool change start', timestamp: '00:40' },
    { vector: [0.91, 0.0, 0.0, 0.0, 0.3], description: 'Step 42: Tool change step 2', timestamp: '00:41' },
    { vector: [0.92, 0.0, 0.0, 0.0, 0.3], description: 'Step 43: Tool change step 3', timestamp: '00:42' },
    { vector: [0.93, 0.0, 0.0, 0.0, 0.2], description: 'Step 44: Tool change step 4', timestamp: '00:43' },
    { vector: [0.94, 0.0, 0.0, 0.0, 0.2], description: 'Step 45: Tool change step 5', timestamp: '00:44' },
    { vector: [0.95, 0.0, 0.0, 0.0, 0.2], description: 'Step 46: Tool change step 6', timestamp: '00:45' },
    { vector: [0.96, 0.0, 0.0, 0.0, 0.1], description: 'Step 47: Tool change step 7', timestamp: '00:46' },
    { vector: [0.97, 0.0, 0.0, 0.0, 0.1], description: 'Step 48: Tool change step 8', timestamp: '00:47' },
    { vector: [0.98, 0.0, 0.0, 0.0, 0.1], description: 'Step 49: Tool change step 9', timestamp: '00:48' },
    { vector: [0.99, 0.0, 0.0, 0.0, 0.1], description: 'Step 50: Tool change complete → OUTPUT 9', timestamp: '00:49', expectedOutput: 'CHANGE_TOOL' },

    // ===== Emergency Stop =====
    { vector: [0.0, 0.9, 0.0, 0.0, 0.8], description: 'Step 51: Anomaly detected', timestamp: '00:50' },
    { vector: [0.0, 0.91, 0.0, 0.0, 0.82], description: 'Step 52: Emergency step 2', timestamp: '00:51' },
    { vector: [0.0, 0.92, 0.0, 0.0, 0.84], description: 'Step 53: Emergency step 3', timestamp: '00:52' },
    { vector: [0.0, 0.93, 0.0, 0.0, 0.86], description: 'Step 54: Emergency step 4', timestamp: '00:53' },
    { vector: [0.0, 0.94, 0.0, 0.0, 0.88], description: 'Step 55: Emergency step 5', timestamp: '00:54' },
    { vector: [0.0, 0.95, 0.0, 0.0, 0.90], description: 'Step 56: Emergency step 6', timestamp: '00:55' },
    { vector: [0.0, 0.96, 0.0, 0.0, 0.92], description: 'Step 57: Emergency step 7', timestamp: '00:56' },
    { vector: [0.0, 0.97, 0.0, 0.0, 0.94], description: 'Step 58: Emergency step 8', timestamp: '00:57' },
    { vector: [0.0, 0.98, 0.0, 0.0, 0.96], description: 'Step 59: Emergency step 9', timestamp: '00:58' },
    { vector: [0.0, 0.99, 0.0, 0.0, 0.98], description: 'Step 60: EMERGENCY STOP → OUTPUT 10', timestamp: '00:59', expectedOutput: 'EMERGENCY_STOP' },

    // ===== Calibration =====
    { vector: [0.05, 0.0, 0.0, 0.5, 0.2], description: 'Step 61: Calibration start', timestamp: '01:00' },
    { vector: [0.10, 0.0, 0.0, 0.55, 0.2], description: 'Step 62: Calibration point 2', timestamp: '01:01' },
    { vector: [0.20, 0.0, 0.0, 0.60, 0.2], description: 'Step 63: Calibration point 3', timestamp: '01:02' },
    { vector: [0.30, 0.0, 0.0, 0.65, 0.2], description: 'Step 64: Calibration point 4', timestamp: '01:03' },
    { vector: [0.40, 0.0, 0.0, 0.70, 0.2], description: 'Step 65: Calibration point 5', timestamp: '01:04' },
    { vector: [0.50, 0.0, 0.0, 0.75, 0.2], description: 'Step 66: Calibration point 6', timestamp: '01:05' },
    { vector: [0.60, 0.0, 0.0, 0.80, 0.2], description: 'Step 67: Calibration point 7', timestamp: '01:06' },
    { vector: [0.70, 0.0, 0.0, 0.85, 0.2], description: 'Step 68: Calibration point 8', timestamp: '01:07' },
    { vector: [0.80, 0.0, 0.0, 0.90, 0.2], description: 'Step 69: Calibration point 9', timestamp: '01:08' },
    { vector: [0.95, 0.0, 0.0, 0.95, 0.2], description: 'Step 70: Calibration complete → OUTPUT 11', timestamp: '01:09', expectedOutput: 'CALIBRATE' }
  ];
}

/**
 * Create all robotics assembly sequences
 */
export function createRoboticsAssemblySequences(): CriticalEventSequence[] {
  return [
    createPickAndPlaceSequence(),
    createQualityInspectionSequence(),
    createToolChangeSequence(),
    createEmergencyStopSequence(),
    createCalibrationSequence()
  ];
}

/**
 * Create Robotics Assembly Machine with comprehensive metadata
 */
export function createRoboticsAssemblyMachine(): Machine {
  const testVectors = generateRoboticsTestVectors();

  const machine = new Machine(
    'Robotics Assembly System',
    'Automated assembly system with 5 critical event sequences demonstrating pick-place, inspection, tool change, emergency stop, and calibration operations',
    {
      eventSpace: '5D continuous vectors: [ARM_POSITION, GRIPPER_FORCE, CONVEYOR_SPEED, VISION_CONF, TOOL_TEMP]',
      outputSpace: '3D vectors: [ACTION_CODE, SPEED_MODIFIER, QUALITY_FLAG]',
      sequenceCount: 5,
      totalEvents: 50,
      outputEvents: 7,
      matchThreshold: 0.60,
      inputVectorCount: testVectors.length,
      description: 'Complete robotics assembly workflow with 5 sequences of 10 events each, threshold matching at 0.60',
      sequences: [
        {
          name: 'Pick and Place Operation',
          path: '10 events: Home→Pick→Place',
          output: '2 outputs: [PICK, PLACE]',
          description: 'Complete pick-and-place cycle with vision guidance'
        },
        {
          name: 'Quality Inspection Operation',
          path: '10 events: Scan positions→Analysis→Result',
          output: '2 outputs: [INSPECT (preliminary), INSPECT (final)]',
          description: 'Multi-point vision-based quality inspection'
        },
        {
          name: 'Tool Change Operation',
          path: '10 events: Tool rack→Change procedure→Complete',
          output: '1 output: [CHANGE_TOOL]',
          description: 'Automated tool changing sequence'
        },
        {
          name: 'Emergency Stop Operation',
          path: '10 events: Anomaly→Escalation→Stop',
          output: '1 output: [EMERGENCY_STOP]',
          description: 'Safety shutdown on force/temperature anomaly'
        },
        {
          name: 'Calibration Operation',
          path: '10 events: Calibration points→Complete',
          output: '1 output: [CALIBRATE]',
          description: 'System calibration and homing procedure'
        }
      ],
      sampleVectors: testVectors.map(tv => ({
        vector: tv.vector,
        label: tv.description,
        timestamp: tv.timestamp,
        expectedOutput: tv.expectedOutput
      })),
      inputSequences: [
        {
          name: 'Complete Assembly Workflow',
          pattern: '70-step comprehensive test sequence',
          description: 'Executes all 5 sequences: 2× Pick&Place, 2× Inspection, 1× Tool Change, 1× Emergency Stop, 1× Calibration - Generates 11 outputs total',
          vectors: testVectors.map(tv => tv.vector)
        }
      ],
      specifications: {
        inputDimensions: 5,
        outputDimensions: 3,
        averageSequenceLength: 10,
        totalSequences: 5,
        totalEvents: 50,
        outputEventsInSequences: 7,
        matchThreshold: 0.60,
        expectedOutputsInSampleRun: 11
      }
    }
  );

  // Add all sequences to the machine
  const sequences = createRoboticsAssemblySequences();
  sequences.forEach(seq => machine.addSequence(seq));

  return machine;
}
