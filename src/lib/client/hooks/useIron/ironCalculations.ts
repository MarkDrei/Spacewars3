/**
 * Pure calculation functions for iron display
 * These are easy to test as they have no side effects
 */

export interface IronData {
  serverAmount: number;
  ironPerSecond: number;
  lastUpdateTime: number;
}

/**
 * Calculate the predicted iron amount based on time elapsed and production rate
 * @param data - Current iron data from server
 * @param currentTime - Current timestamp (defaults to Date.now())
 * @returns Predicted iron amount (floored to integer)
 */
export function calculatePredictedIron(
  data: IronData,
  currentTime: number = Date.now()
): number {
  if (data.ironPerSecond <= 0) {
    return Math.floor(data.serverAmount);
  }

  const secondsElapsed = (currentTime - data.lastUpdateTime) / 1000;
  const predictedIron = data.serverAmount + (secondsElapsed * data.ironPerSecond);
  
  return Math.floor(predictedIron);
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
