const { spawn } = require('child_process');
const { join } = require('path');
const { existsSync } = require('fs');

// Function to run a command in a specific directory
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')} in ${cwd}`);
    
    const proc = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  try {
    // Validate that directories exist
    const clientDir = join(__dirname, '../packages/client');
    const serverDir = join(__dirname, '../packages/server');
    const sharedDir = join(__dirname, '../packages/shared');
    
    if (!existsSync(clientDir)) {
      throw new Error(`Client directory not found: ${clientDir}`);
    }
    if (!existsSync(serverDir)) {
      throw new Error(`Server directory not found: ${serverDir}`);
    }
    if (!existsSync(sharedDir)) {
      throw new Error(`Shared directory not found: ${sharedDir}`);
    }

    // Build shared package first
    console.log('Building shared package...');
    await runCommand('npm', ['run', 'build'], sharedDir);
    
    // Build server and client in parallel
    console.log('Building server and client packages...');
    await Promise.all([
      runCommand('npm', ['run', 'build'], serverDir),
      runCommand('npm', ['run', 'build'], clientDir)
    ]);
    
    console.log('Build completed successfully! 🚀');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main();
