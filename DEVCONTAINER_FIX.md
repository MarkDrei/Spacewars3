# Dev Container Error Fix (Exit Code 137)

## Problem Summary

Your "Reopen in Container" operation failed with **Exit Code 137**, which indicates an **Out of Memory (OOM) kill**. The container ran out of memory while installing VS Code Server.

## Root Causes Identified

1. **Insufficient Docker Memory:** VS Code Server installation requires significant memory
2. **Image Mismatch:** The devcontainer was using an older Node 20 / Debian Bullseye image

## What Was Fixed

### 1. Updated Dev Container Base Image
- **Old:** `mcr.microsoft.com/devcontainers/typescript-node:1-20-bullseye`
- **New:** `mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm`

Benefits:
- Latest stable Node.js 22
- Modern Debian Bookworm (more efficient)
- Better compatibility with VS Code Server

### 2. Added Memory Requirements
Added explicit host requirements to `.devcontainer/devcontainer.json`:
```json
"hostRequirements": {
  "cpus": 4,
  "memory": "8gb",
  "storage": "32gb"
}
```

This tells VS Code what your system needs to run the dev container successfully.

## How to Fix on Your System

### Step 1: Check WSL 2 Memory Limits (Windows Users)

**For WSL 2 (which you're using):**

1. Open **PowerShell** and check your WSL 2 memory:
   ```powershell
   wsl docker run --rm alpine free -h
   ```

2. If you see **8GB+ total memory**, you're good! Skip to Step 2.

3. If you see **less than 8GB**, create/edit `%UserProfile%\.wslconfig`:
   ```powershell
   cd ~
   notepad .wslconfig
   ```

4. Add these lines:
   ```ini
   [wsl2]
   memory=8GB
   processors=4
   ```

5. Restart WSL:
   ```powershell
   wsl --shutdown
   ```

6. Restart Docker Desktop (it will restart the WSL 2 VM)

### Step 2: Clean Up Old Dev Containers (REQUIRED)

The devcontainer configuration was updated, so you need to remove the old container:

```bash
# Remove the specific old dev container
docker rm -f 0215378fe381 34be6894bf36

# Or remove all stopped containers
docker container prune -f

# Clean up unused images (optional)
docker image prune -a -f
```

**Why this is needed:** The old container was built with the old configuration. VS Code needs to rebuild it with the new settings.

### Step 3: Reopen in Container

1. In VS Code, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type: `Dev Containers: Reopen in Container`
3. Wait 3-5 minutes for the container to build and VS Code Server to install
4. Watch the progress in the terminal output

### Expected Behavior

You should see:
1. Container starting successfully
2. VS Code Server downloading and installing
3. Extensions being installed
4. Terminal becoming available
5. No "Exit code 137" errors

## If It Still Fails

### Option A: Check Docker Desktop Settings
```bash
# Verify Docker has enough resources
docker info | grep -i memory
docker info | grep -i cpus
```

### Option B: Try with More Memory
If you have 16GB+ system RAM, allocate 12GB to Docker.

### Option C: Close Other Applications
- Close browsers, IDEs, or other memory-intensive apps
- Restart your computer to free up memory
- Try again

### Option D: Use GitHub Codespaces Instead
If local dev containers continue to fail:
1. Go to: https://github.com/MarkDrei/Spacewars3
2. Click: **Code** → **Codespaces** → **Create codespace**
3. Wait 2-3 minutes
4. Run: `npm run dev`

Codespaces runs in the cloud with guaranteed resources.

## Understanding Exit Code 137

- **Exit Code 137 = 128 + 9**
- Signal 9 = SIGKILL (immediate termination)
- Reason: Linux OOM (Out of Memory) killer

This happens when:
- Process uses too much memory
- Docker container hits memory limit
- System runs out of memory
- Kernel kills the process to protect system stability

## Verification

After reopening the container, verify it's working:
```bash
# Should show container details
docker ps

# Should enter the container shell
docker exec -it <container-name> bash

# Should show Node.js version
node --version

# Should show npm version
npm --version
```

## Documentation Updated

The following files now include memory requirements:
- `.devcontainer/devcontainer.json` - Added hostRequirements
- `DOCKER.md` - Added Prerequisites section with memory requirements
- `GETTING_STARTED.md` - Added memory warning

## Additional Resources

- [Dev Containers Requirements](https://code.visualstudio.com/docs/devcontainers/containers#_system-requirements)
- [Docker Desktop Resource Allocation](https://docs.docker.com/desktop/settings/windows/#resources)
- [VS Code Dev Containers Troubleshooting](https://code.visualstudio.com/docs/devcontainers/troubleshooting)

---

**Summary:** The issue is fixed by:
1. Allocating 8GB+ RAM to Docker Desktop
2. Using the updated devcontainer configuration
3. Cleaning up old containers

Try the fix steps above and the dev container should work! 🚀
