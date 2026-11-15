import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatBoldText, parseMessage } from '@/lib/client/messages/messageFormat';

describe('parseMessage', () => {
  it('parseMessage_positivePrefix_isPositiveWithoutPrefix', () => {
    expect(parseMessage('P: Mission accepted')).toEqual({ type: 'positive', content: 'Mission accepted' });
  });

  it('parseMessage_negativePrefix_isNegativeWithoutPrefix', () => {
    expect(parseMessage('N: Mission abandoned')).toEqual({ type: 'negative', content: 'Mission abandoned' });
  });

  it('parseMessage_attackPrefix_isAttackWithoutPrefix', () => {
    expect(parseMessage('A: Ambush!')).toEqual({ type: 'attack', content: 'Ambush!' });
  });

  it('parseMessage_noPrefix_isNeutralAndUnchanged', () => {
    expect(parseMessage('Welcome, pilot')).toEqual({ type: 'neutral', content: 'Welcome, pilot' });
  });

  it('parseMessage_prefixWithoutSpaceOrInsideTheText_isNeutral', () => {
    expect(parseMessage('P:no space').type).toBe('neutral');
    expect(parseMessage('Report: P: done').type).toBe('neutral');
  });
});

describe('formatBoldText', () => {
  const html = (text: string): string => renderToStaticMarkup(<>{formatBoldText(text)}</>);

  it('formatBoldText_plainText_staysPlain', () => {
    expect(html('Safe flight, pilot.')).toBe('Safe flight, pilot.');
  });

  it('formatBoldText_doubleAsterisks_becomeStrong', () => {
    expect(html('Mission accepted: **First Haul**')).toBe('Mission accepted: <strong>First Haul</strong>');
  });

  it('formatBoldText_severalBoldParts_areAllFormatted', () => {
    expect(html('**A** and **B**')).toBe('<strong>A</strong> and <strong>B</strong>');
  });

  it('formatBoldText_newlines_becomeLineBreaks', () => {
    expect(html('one\n**two**')).toBe('one<br/><strong>two</strong>');
  });

  it('formatBoldText_markup_isEscapedNotInterpreted', () => {
    expect(html('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});
