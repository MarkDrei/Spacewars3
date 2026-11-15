#!/usr/bin/env tsx

// Writes doc/quests.md (npm run quest-doc). See questDoc.ts for the content.

import fs from 'fs/promises';
import path from 'path';
import { getServerT } from '../src/lib/server/i18n/serverTranslations.js';
import { renderQuestDoc } from './questDoc.js';

const target = path.resolve(process.cwd(), 'doc/quests.md');
await fs.writeFile(target, renderQuestDoc(await getServerT('en', 'quests')), 'utf8');
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
