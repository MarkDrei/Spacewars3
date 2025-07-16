// @ts-check
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to run a command in a specific directory
function runCommand(command, args, cwd) {
  return spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32'
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

    // Build shared package first since others depend on it
    console.log('Building shared package...');
    const sharedBuild = runCommand('npm', ['run', 'build'], sharedDir);
    await new Promise((resolve, reject) => {
      sharedBuild.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Shared build failed with code ${code}`));
          return;
        }
        resolve();
      });
    });

    // Start the client and server in parallel
    console.log('Starting development servers...');
    const clientProcess = runCommand('npm', ['run', 'dev'], clientDir);
    const serverProcess = runCommand('npm', ['run', 'dev'], serverDir);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down development servers...');
      clientProcess.kill();
      serverProcess.kill();
      process.exit(0);
    });

    // Log any process exit
    clientProcess.on('close', (code) => {
      console.log(`Client process exited with code ${code}`);
      if (code !== 0 && code !== null) {
        process.exit(code);
      }
    });

    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      if (code !== 0 && code !== null) {
        process.exit(code);
      }
    });
    
  } catch (error) {
    console.error('Failed to start development servers:', error);
    process.exit(1);
  }
}

main();
