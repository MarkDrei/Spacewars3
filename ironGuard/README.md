# IronGuard Lock System - Reference Implementation

This directory contains the reference implementation of the IronGuard lock system that inspired the project's lock ordering mechanism.

## Purpose

This is the original prototype/reference implementation that demonstrates:
- Numeric lock levels (1, 2, 3, 4, 5)
- Lock skipping patterns
- Compile-time lock ordering validation
- Type-safe lock context passing

## Integration

The concepts from this reference implementation have been integrated into the main codebase at:
- `src/lib/server/ironGuard.ts` - Main production implementation

## Key Concepts

1. **Numeric Lock Levels**: Simpler than the previous multi-level system
2. **Lock Skipping**: You can skip intermediate locks (e.g., 1→3, 1→5)
3. **Compile-Time Safety**: TypeScript type system prevents lock ordering violations
4. **Runtime Validation**: Additional runtime checks for safety

## Files

- `ironGuardSystem.ts` - Core lock context and type definitions
- `ironGuardTypes.ts` - Advanced type aliases for flexible functions
- `examples.ts` - Example usage patterns
- `index.ts` - Demo runner
- `flexibleLock3Test.ts` - Test cases

## Migration Complete

The project has successfully transitioned from `typedLocks.ts` to the ironGuard system with the following mappings:

- CacheLevel (0) → Lock Level 10
- WorldLevel (1) → Lock Level 20
- UserLevel (2) → Lock Level 30
- MessageReadLevel (2.4) → Lock Level 40
- MessageWriteLevel (2.5) → Lock Level 41
- DatabaseLevel (3) → Lock Level 50

**Note**: Lock levels use a spaced numbering scheme to allow room for future enhancements between existing levels.
