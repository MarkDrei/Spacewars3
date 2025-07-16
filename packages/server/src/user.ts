// ---
// Domain logic for the User and its stats, including persistence callback.
// ---

import { TechTree, ResearchType, getResearchEffectFromTree, createInitialTechTree, updateTechTree } from './techtree';

class User {
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

  getIronPerSecond(): number {
    return getResearchEffectFromTree(this.techTree, ResearchType.IronHarvesting);
  }

  calculateIronIncrement(elapsedSeconds: number): number {
    return this.getIronPerSecond() * elapsedSeconds;
  }

  updateStats(now: number): void {
    const elapsed = now - this.last_updated;
    if (elapsed <= 0) return;

    let iron = this.iron;
    const techTree = this.techTree;
    const active = techTree.activeResearch;
    if (!active || active.type !== ResearchType.IronHarvesting) {
      // No relevant research in progress, just award all time
      iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
      updateTechTree(techTree, elapsed);
    } else {
      const timeToComplete = active.remainingDuration;
      if (elapsed < timeToComplete) {
        // Research does not complete in this interval
        iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * elapsed;
        updateTechTree(techTree, elapsed);
      } else {
        // Research completes during this interval
        // 1. Award up to research completion at old rate
        iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * timeToComplete;
        updateTechTree(techTree, timeToComplete);
        // 2. After research completes, award remaining time at new rate (if any)
        const remaining = elapsed - timeToComplete;
        if (remaining > 0) {
          iron += getResearchEffectFromTree(techTree, ResearchType.IronHarvesting) * remaining;
          updateTechTree(techTree, remaining);
        }
      }
    }
    this.iron = iron;
    this.last_updated = now;
  }

  async save(): Promise<void> {
    await this.saveCallback(this);
  }

  static createNew(username: string, password_hash: string, saveCallback: SaveUserCallback): User {
    const now = Math.floor(Date.now() / 1000);
    return new User(
      0, // id will be set by DB
      username,
      password_hash,
      0.0,
      now,
      createInitialTechTree(),
      saveCallback
    );
  }
}

type SaveUserCallback = (user: User) => Promise<void>;
export { User };
export type { SaveUserCallback };
