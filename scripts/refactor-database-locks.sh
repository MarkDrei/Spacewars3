#!/bin/bash

# Script to refactor acquireDatabaseRead/Write calls to direct lock acquisition
# This eliminates the type assertion hack in userWorldCache

set -e

echo "🔧 Refactoring database lock acquisition..."

# Files to process (excluding userWorldCache.ts itself since we'll handle that separately)
FILES=(
  "src/lib/server/battle/BattleCache.ts"
  "src/lib/server/battle/battleService.ts"
  "src/lib/server/world/userRepo.ts"
  "src/app/api/harvest/route.ts"
  "src/app/api/navigate/route.ts"
  "src/app/api/navigate-typed/route.ts"
  "src/app/api/user-stats/route.ts"
  "src/app/api/trigger-research/route.ts"
  "src/app/api/techtree/route.ts"
  "src/app/api/ship-stats/route.ts"
  "src/__tests__/integration/battle-defense-persistence.test.ts"
)

# Step 1: Replace acquireDatabaseRead calls
echo "📝 Step 1: Replacing acquireDatabaseRead calls..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Replace: await cacheManager.acquireDatabaseRead(ctx) -> await ctx.acquireRead(DATABASE_LOCK)
    sed -i 's/await cacheManager\.acquireDatabaseRead(\([^)]*\))/await \1.acquireRead(DATABASE_LOCK)/g' "$file"
    
    # Replace: await this.acquireDatabaseRead(userCtx) -> await userCtx.acquireRead(DATABASE_LOCK)
    sed -i 's/await this\.acquireDatabaseRead(\([^)]*\))/await \1.acquireRead(DATABASE_LOCK)/g' "$file"
    
    echo "  ✓ $file"
  fi
done

# Step 2: Replace acquireDatabaseWrite calls
echo "📝 Step 2: Replacing acquireDatabaseWrite calls..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    # Replace: await cacheManager.acquireDatabaseWrite(ctx) -> await ctx.acquireWrite(DATABASE_LOCK)
    sed -i 's/await cacheManager\.acquireDatabaseWrite(\([^)]*\))/await \1.acquireWrite(DATABASE_LOCK)/g' "$file"
    
    # Replace: await this.acquireDatabaseWrite(userCtx) -> await userCtx.acquireWrite(DATABASE_LOCK)
    sed -i 's/await this\.acquireDatabaseWrite(\([^)]*\))/await \1.acquireWrite(DATABASE_LOCK)/g' "$file"
    
    echo "  ✓ $file"
  fi
done

# Step 3: Add DATABASE_LOCK import (manually for each file pattern)
echo "📝 Step 3: Adding DATABASE_LOCK imports..."

# For files importing from ../typedLocks
for file in src/lib/server/battle/BattleCache.ts src/lib/server/battle/battleService.ts src/lib/server/world/userRepo.ts; do
  if [ -f "$file" ] && grep -q "DATABASE_LOCK" "$file"; then
    # Check if DATABASE_LOCK is already imported
    if ! grep -q "import.*DATABASE_LOCK.*from.*typedLocks" "$file"; then
      # Add DATABASE_LOCK to the import from typedLocks
      sed -i "s/\(import.*{\)\(.*\)\(}.*from.*typedLocks\)/\1 DATABASE_LOCK, \2\3/" "$file"
      echo "  ✓ Added DATABASE_LOCK import to $file"
    fi
  fi
done

# For API route files importing from @/lib/server/typedLocks
for file in src/app/api/*/route.ts; do
  if [ -f "$file" ] && grep -q "DATABASE_LOCK" "$file"; then
    if ! grep -q "import.*DATABASE_LOCK.*from.*typedLocks" "$file"; then
      sed -i "s/\(import.*{\)\(.*\)\(}.*from '@\/lib\/server\/typedLocks\)/\1 DATABASE_LOCK, \2\3/" "$file"
      echo "  ✓ Added DATABASE_LOCK import to $file"
    fi
  fi
done

# For test files
for file in src/__tests__/**/*.test.ts; do
  if [ -f "$file" ] && grep -q "DATABASE_LOCK" "$file"; then
    if ! grep -q "import.*DATABASE_LOCK.*from.*typedLocks" "$file"; then
      sed -i "s/\(import.*{\)\(.*\)\(}.*from '@\/lib\/server\/typedLocks\)/\1 DATABASE_LOCK, \2\3/" "$file"
      echo "  ✓ Added DATABASE_LOCK import to $file"
    fi
  fi
done

echo ""
echo "✅ Automatic refactoring complete!"
echo ""
echo "⚠️  Manual steps required:"
echo "  1. Review all changes: git diff"
echo "  2. Fix any import formatting issues"
echo "  3. Update src/lib/server/world/userWorldCache.ts:"
echo "     - Refactor internal calls (4 places)"
echo "     - Remove acquireDatabaseRead() method"
echo "     - Remove acquireDatabaseWrite() method"
echo "     - Remove DatabaseReadContext/DatabaseWriteContext exports"
echo "  4. Run: npm run build"
echo "  5. Fix any compilation errors"
echo "  6. Run: npm test"
echo ""
