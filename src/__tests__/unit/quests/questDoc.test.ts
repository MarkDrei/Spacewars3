import fs from 'fs/promises';
import path from 'path';
import { beforeAll, describe, it, expect } from 'vitest';
import { getServerT } from '@/lib/server/i18n/serverTranslations';
import { ACHIEVEMENTS, CARGO, QUESTS } from '@/shared/quests/questDefinitions';
import { renderQuestDoc } from '../../../../scripts/questDoc';

// doc/quests.md is generated from the mission definitions (npm run quest-doc).
describe('quest document', () => {
  let rendered: string;

  beforeAll(async () => {
    rendered = renderQuestDoc(await getServerT('en', 'quests'));
  });

  it('questDoc_committedFile_matchesTheDefinitions', async () => {
    const committed = await fs.readFile(path.resolve(process.cwd(), 'doc/quests.md'), 'utf8');

    // A difference means: run `npm run quest-doc` and commit doc/quests.md
    expect(committed).toBe(rendered);
  });

  it('questDoc_everyMission_hasASectionWithAManualTest', () => {
    for (const quest of QUESTS) {
      expect(rendered, quest.id).toContain(`<a id="${quest.id}"></a>`);
    }
    expect(rendered.match(/\*\*Manual test\*\*/g)).toHaveLength(QUESTS.length);
  });

  it('questDoc_everyCargoAndAchievement_isListed', () => {
    for (const entry of [...CARGO, ...ACHIEVEMENTS]) {
      expect(rendered, entry.id).toContain(`\`${entry.id}\``);
    }
  });

  it('questDoc_allTexts_areResolvedFromTheCatalogue', () => {
    // An unknown key comes back as the key itself ("notifications.foo"), an unfilled placeholder keeps its braces
    const namespaces = 'ui|objectives|cargoSource|notifications|errors|chapters|contacts|locations|hostiles|cargo|achievements|quest';
    expect(rendered).not.toMatch(new RegExp(`(?<![\\w/.\`])(${namespaces})\\.[a-zA-Z_]+`));
    expect(rendered).not.toMatch(/\{[a-zA-Z]+\}/);
  });
});
