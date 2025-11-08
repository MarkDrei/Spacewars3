// Performance Test: Measure compilation time with different union sizes

import { performance } from 'perf_hooks';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// Generate TypeScript code with unions of different sizes
function generateUnionCode(size: number): string {
  const locks = Array.from({ length: Math.ceil(Math.log2(size + 1)) }, (_, i) => i + 1);
  
  let code = `import { type LockContext as IronGuardLockContext } from '@markdrei/ironguard-typescript-locks';\n\n`;
  code += `// Union with ${size} members\n`;
  code += `type Union${size} = \n`;
  
  // Generate all subsets (simplified - just generate singles for speed)
  const members: string[] = [];
  
  // Singles
  for (const lock of locks) {
    members.push(`  | IronGuardLockContext<readonly [${lock}]>`);
    if (members.length >= size) break;
  }
  
  // Pairs
  if (members.length < size) {
    for (let i = 0; i < locks.length; i++) {
      for (let j = i + 1; j < locks.length; j++) {
        members.push(`  | IronGuardLockContext<readonly [${locks[i]}, ${locks[j]}]>`);
        if (members.length >= size) break;
      }
      if (members.length >= size) break;
    }
  }
  
  code += members.slice(0, size).join('\n').replace('  |', '   ') + ';\n\n';
  code += `function test(ctx: Union${size}): void {}\n`;
  code += `export type { Union${size} };\n`;
  
  return code;
}

// Test different sizes
const testSizes = [7, 15, 31, 63, 127, 255, 511];

console.log('=== TypeScript Union Compilation Performance Test ===\n');
console.log('Testing union sizes:', testSizes.join(', '), '\n');

for (const size of testSizes) {
  const filename = `test-union-${size}.ts`;
  const code = generateUnionCode(size);
  
  writeFileSync(filename, code);
  
  const start = performance.now();
  try {
    execSync(`npx tsc --noEmit ${filename}`, { 
      stdio: 'pipe',
      timeout: 30000 // 30 second timeout
    });
    const duration = performance.now() - start;
    
    console.log(`Union${size.toString().padStart(3)}: ${duration.toFixed(0).padStart(5)}ms`);
  } catch (error: any) {
    if (error.killed) {
      console.log(`Union${size.toString().padStart(3)}: TIMEOUT (>30s) 💥`);
    } else {
      const duration = performance.now() - start;
      console.log(`Union${size.toString().padStart(3)}: ${duration.toFixed(0).padStart(5)}ms (with errors)`);
    }
  }
}

console.log('\n=== Memory Usage Estimation ===');
console.log('TypeScript stores type information in memory during compilation.');
console.log('Each union member adds:');
console.log('  - Type node in AST');
console.log('  - Symbol table entry');
console.log('  - Type checker state');
console.log('\nRough estimate: ~1-10 KB per union member');
console.log('So:');
console.log('  - 64 members:    ~64 KB - 640 KB');
console.log('  - 1,023 members: ~1 MB - 10 MB');
console.log('  - 32,767 members: ~32 MB - 320 MB');
console.log('\nNot gigabytes, but can cause slowdowns!');
