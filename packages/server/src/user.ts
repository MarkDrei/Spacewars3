// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, createInitialTechTree, startResearch, checkResearchProgress } from './techtree';

export type SaveUserCallback = (user: User) => Promise<void>;

export class User {
  id: number;
  username: string;
  password_hash: string;
  iron: number;
  last_updated: number;
  techTree: TechTree;
  private saveCallback: SaveUserCallback;

  constructor(
    id: number,
    username: string,
    password_hash: string,
    iron: number,
    last_updated: number,
    techTree: TechTree,
    saveCallback: SaveUserCallback
  ) {
    this.id = id;
    this.username = username;
    this.password_hash = password_hash;
    this.iron = iron;
    this.last_updated = last_updated;
    this.techTree = techTree;
    this.saveCallback = saveCallback;
  }

  async addIron(iron: number): Promise<void> {
    this.iron += iron;
    this.last_updated = Math.floor(Date.now() / 1000);
    await this.saveCallback(this);
  }

  getIronRate(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.IronHarvesting);
  }

  async triggerResearch(type: ResearchType): Promise<void> {
    const { updatedTechTree, cost, remainingIron } = startResearch(this.techTree, type, this.iron);
    this.techTree = updatedTechTree;
    this.iron = remainingIron;
    this.last_updated = Math.floor(Date.now() / 1000);
    await this.saveCallback(this);
  }

  async checkResearchCompletion(): Promise<boolean> {
    const { updatedTechTree, completed } = checkResearchProgress(this.techTree);
    if (completed) {
      this.techTree = updatedTechTree;
      this.last_updated = Math.floor(Date.now() / 1000);
      await this.saveCallback(this);
      return true;
    }
    return false;
  }

  // For testing, using a fixed timestamp
  async updateIronWithoutTimePassing(timestamp: number): Promise<void> {
    // Calculate seconds passed
    const secondsPassed = timestamp - this.last_updated;

    if (secondsPassed <= 0) {
      return;
    }

    // Award iron based on rate per second
    const rate = this.getIronRate();
    const ironToAdd = secondsPassed * rate;

    this.iron += ironToAdd;
    this.last_updated = timestamp;
    await this.saveCallback(this);
  }

  // Update user stats based on time passed, handling research progress and iron accumulation
  updateStats(now: number): void {
    let elapsed = now - this.last_updated;
    if (elapsed <= 0) return;

    let iron = this.iron;
    let techTree = this.techTree;
    const active = techTree.researchInProgress;

    // If no IronHarvesting research is in progress, just award all time at current rate
    if (!active || active.type !== ResearchType.IronHarvesting) {
      iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
      if (active) {
        // Update research progress
        const { updatedTechTree } = checkResearchProgress(techTree);
        techTree = updatedTechTree;
      }
    } else {
      // IronHarvesting research is in progress
      const timeToComplete = active.duration;
      if (elapsed < timeToComplete) {
        // Research does not complete in this interval
        iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
        // Update research progress but don't complete it yet
        const { updatedTechTree } = checkResearchProgress(techTree);
        techTree = updatedTechTree;
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * timeToComplete;
        
        // 2. Complete research by checking progress
        const { updatedTechTree } = checkResearchProgress(techTree);
        techTree = updatedTechTree;

        // 3. After research completes, award remaining time at new rate (if any)
        const remaining = elapsed - timeToComplete;
        if (remaining > 0) {
          iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * remaining;
        }
      }
    }

    this.iron = iron;
    this.last_updated = now;
    this.techTree = techTree;
  }

  static fromDbRow(
    row: any,
    saveCallback: SaveUserCallback
  ): User {
    return new User(
      row.id,
      row.username,
      row.password_hash,
      row.iron,
      row.last_updated,
      row.tech_tree ? JSON.parse(row.tech_tree) : createInitialTechTree(),
      saveCallback
    );
  }
}
