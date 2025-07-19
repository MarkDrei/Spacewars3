/**
 * Utility functions for angle conversions between radians and degrees
 */

/**
 * Converts a radian value to degrees
 * @param radians The angle in radians
 * @returns The angle in degrees
 */
export function radiansToDegrees(radians: number): number {
    return radians * (180 / Math.PI);
}
