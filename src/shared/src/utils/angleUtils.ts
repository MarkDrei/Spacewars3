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

/**
 * Converts a degree value to radians
 * @param degrees The angle in degrees
 * @returns The angle in radians
 */
export function degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}