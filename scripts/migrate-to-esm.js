#!/usr/bin/env node

/**
 * ESM Migration Script
 * Automatically updates TypeScript files to use ESM imports with .js extensions
 */

import { readFile, writeFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

console.log('🔄 ESM Migration Script');
console.log('======================\n');

if (DRY_RUN) {
  console.log('ℹ️  Running in DRY RUN mode - no files will be modified\n');
}

let filesProcessed = 0;
let filesModified = 0;

async function* getFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip certain directories
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
        continue;
      }
      yield* getFiles(path);
    } else if (extname(entry.name) === '.ts') {
      yield path;
    }
  }
}

function updateImports(content) {
  let modified = false;

  // Pattern 1: from './path' or "../path" (relative imports)
  content = content.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)(?<!\.js)\1/g,
    (match, quote, path) => {
      // Don't add .js if it's already there or if it's a .json import
      if (path.endsWith('.js') || path.endsWith('.json')) {
        return match;
      }
      modified = true;
      return `from ${quote}${path}.js${quote}`;
    }
  );

  // Pattern 2: import('./path') or import("../path") (dynamic imports)
  content = content.replace(
    /import\s*\(\s*(['"])(\.\.?\/[^'"]+)(?<!\.js)\1\s*\)/g,
    (match, quote, path) => {
      if (path.endsWith('.js') || path.endsWith('.json')) {
        return match;
      }
      modified = true;
      return `import(${quote}${path}.js${quote})`;
    }
  );

  // Pattern 3: Remove polyfills import
  content = content.replace(/import\s+['"]\.\/polyfills['"];?\s*\n?/g, () => {
    modified = true;
    return '';
  });

  // Pattern 4: Update node-fetch usage
  content = content.replace(/import\s+.*?\s+from\s+['"]node-fetch['"];?\s*\n?/g, () => {
    modified = true;
    return '// Native fetch API - no import needed\n';
  });

  // Pattern 5: Convert require to import (if any remain)
  content = content.replace(
    /const\s+(\{[^}]+\}|\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\);?/g,
    (match, name, path) => {
      modified = true;
      return `import ${name} from '${path}.js';`;
    }
  );

  return { content, modified };
}

async function processFile(filePath) {
  filesProcessed++;

  try {
    const content = await readFile(filePath, 'utf-8');
    const { content: newContent, modified } = updateImports(content);

    if (modified) {
      filesModified++;

      if (VERBOSE || DRY_RUN) {
        console.log(`✏️  ${filePath}`);
      }

      if (!DRY_RUN) {
        await writeFile(filePath, newContent, 'utf-8');
      }
    } else if (VERBOSE) {
      console.log(`✓  ${filePath} (no changes needed)`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// Main execution
try {
  console.log('📁 Scanning TypeScript files...\n');

  for await (const file of getFiles('src')) {
    await processFile(file);
  }

  console.log('\n📊 Migration Summary');
  console.log('===================');
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Files modified:  ${filesModified}`);
  console.log(`Files unchanged: ${filesProcessed - filesModified}`);

  if (DRY_RUN) {
    console.log('\n💡 Run without --dry-run to apply changes');
  } else {
    console.log('\n✅ Migration complete!');
    console.log('\nNext steps:');
    console.log('  1. Review changes: git diff');
    console.log('  2. Build project: npm run build');
    console.log('  3. Run tests: npm test');
  }

} catch (error) {
  console.error('\n💥 Migration failed:', error);
  process.exit(1);
}
