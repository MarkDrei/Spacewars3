/**
 * Pure calculation functions for iron display
 * These are easy to test as they have no side effects
 */

export interface IronData {
  serverAmount: number;
  ironPerSecond: number;
  lastUpdateTime: number;
  maxCapacity: number;
}

/**
 * Calculate the predicted iron amount based on time elapsed and production rate
 * @param data - Current iron data from server
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @param timeMultiplier - Time acceleration multiplier (defaults to 1)
 * @returns Predicted iron amount (floored to integer), capped at maxCapacity
 */
export function calculatePredictedIron(
  data: IronData,
  currentTime: number = Date.now(),
  timeMultiplier: number = 1
): number {
  if (data.ironPerSecond <= 0) {
    return Math.floor(data.serverAmount);
  }

  const secondsElapsed = (currentTime - data.lastUpdateTime) / 1000;
  const predictedIron = data.serverAmount + (secondsElapsed * data.ironPerSecond * timeMultiplier);
  const cappedIron = Math.min(predictedIron, data.maxCapacity);
  
  return Math.floor(cappedIron);
}

/**
 * Check if the iron display needs updating
 * @param currentDisplay - Currently displayed iron amount
 * @param predicted - Newly calculated predicted amount
 * @returns True if display should update
 */
export function shouldUpdateDisplay(currentDisplay: number, predicted: number): boolean {
  return predicted !== currentDisplay;
}
