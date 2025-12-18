#!/usr/bin/env node

/**
 * TypeScript Error Fix Script
 * Automatically fixes common strict mode errors
 */

import { readFile, writeFile } from 'node:fs/promises';

async function fixFile(filePath, fixes) {
  console.log(`Fixing ${filePath}...`);
  let content = await readFile(filePath, 'utf-8');
  let modified = false;

  for (const fix of fixes) {
    const newContent = content.replace(fix.pattern, fix.replacement);
    if (newContent !== content) {
      modified = true;
      content = newContent;
    }
  }

  if (modified) {
    await writeFile(filePath, content, 'utf-8');
    console.log(`✓ Fixed ${filePath}`);
  }

  return modified;
}

// Fix patterns
const fixes = {
  'src/api/routes.ts': [
    // Fix unused req parameters
    {
      pattern: /private async healthCheck\(req: Request,/g,
      replacement: 'private async healthCheck(_req: Request,'
    },
    {
      pattern: /private getConfig\(req: Request,/g,
      replacement: 'private getConfig(_req: Request,'
    },
    {
      pattern: /private getAllSequences\(req: Request,/g,
      replacement: 'private getAllSequences(_req: Request,'
    },
    {
      pattern: /private async persistSequences\(req: Request,/g,
      replacement: 'private async persistSequences(_req: Request,'
    },
    {
      pattern: /private resetEngine\(req: Request,/g,
      replacement: 'private resetEngine(_req: Request,'
    },
    {
      pattern: /private getEngineStats\(req: Request,/g,
      replacement: 'private getEngineStats(_req: Request,'
    },
    {
      pattern: /private getActiveVectors\(req: Request,/g,
      replacement: 'private getActiveVectors(_req: Request,'
    },
    {
      pattern: /private stopSampler\(req: Request,/g,
      replacement: 'private stopSampler(_req: Request,'
    },
    {
      pattern: /private getSamplerStats\(req: Request,/g,
      replacement: 'private getSamplerStats(_req: Request,'
    },
    // Fix undefined checks
    {
      pattern: /const sequence = this\.engine\.getSequence\(id\);/g,
      replacement: 'if (!id) { res.status(400).json({ error: "Sequence ID required" }); return; }\n    const sequence = this.engine.getSequence(id);'
    },
    {
      pattern: /const removed = this\.engine\.removeSequence\(id\);/g,
      replacement: 'if (!id) { res.status(400).json({ error: "Sequence ID required" }); return; }\n    const removed = this.engine.removeSequence(id);'
    },
    {
      pattern: /const reset = this\.engine\.resetSequence\(id\);/g,
      replacement: 'if (!id) { res.status(400).json({ error: "Sequence ID required" }); return; }\n    const reset = this.engine.resetSequence(id);'
    }
  ],
  'src/config/config.ts': [
    {
      pattern: /import { RealityEngineConfig } from/g,
      replacement: 'import type { RealityEngineConfig } from'
    }
  ],
  'src/engine/RealityEngine.ts': [
    {
      pattern: /import { OutputVector } from/g,
      replacement: 'import type { OutputVector } from'
    }
  ],
  'src/engine/RealitySampler.ts': [
    {
      pattern: /import { PreceptionOfReality, RawObservation } from/g,
      replacement: 'import { PreceptionOfReality } from \'./PreceptionOfReality.js\';\nimport type { RawObservation } from'
    },
    {
      pattern: /import { RealityEngine, TransitionResult } from/g,
      replacement: 'import { RealityEngine } from \'./RealityEngine.js\';\nimport type { TransitionResult } from'
    },
    {
      pattern: /this\.intervalId = undefined;/g,
      replacement: 'this.intervalId = undefined as any;'
    }
  ],
  'src/models/CriticalEventSequence.ts': [
    {
      pattern: /import { OutputVector, MatchResult } from/g,
      replacement: 'import type { OutputVector, MatchResult } from'
    }
  ],
  'src/models/RealityVector.ts': [
    {
      pattern: /import {\s*VectorElement,\s*ComparatorType,\s*Comparator,\s*MatchResult,\s*OutputVector\s*} from/g,
      replacement: 'import { ComparatorType, Comparator } from \'./types.js\';\nimport type { VectorElement, MatchResult, OutputVector } from'
    }
  ]
};

// Run fixes
for (const [file, fileFixes] of Object.entries(fixes)) {
  try {
    await fixFile(file, fileFixes);
  } catch (error) {
    console.error(`Error fixing ${file}:`, error.message);
  }
}

console.log('\n✅ Automatic fixes complete!');
console.log('Manual fixes still needed - run build to see remaining errors');
