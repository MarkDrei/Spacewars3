// ---
// Display format of player messages: a prefix marks the kind of message ("P: " positive,
// "N: " negative, "A: " attack) and **text** is shown bold.
// ---

import React from 'react';

// Message type based on prefix
export type MessageType = 'neutral' | 'attack' | 'positive' | 'negative';

export interface ParsedMessage {
  type: MessageType;
  content: string;
}

/**
 * Parse message to determine type and extract content
 * A: prefix = attack (red background)
 * N: prefix = negative (red background)
 * P: prefix = positive (green background)
 * No prefix = neutral (no special background)
 */
export function parseMessage(message: string): ParsedMessage {
  if (message.startsWith('A: ')) {
    return { type: 'attack', content: message.substring(3) };
  }
  if (message.startsWith('N: ')) {
    return { type: 'negative', content: message.substring(3) };
  }
  if (message.startsWith('P: ')) {
    return { type: 'positive', content: message.substring(3) };
  }
  return { type: 'neutral', content: message };
}

export function formatBoldText(text: string): React.ReactNode {
  // First split by newlines and map to fragments with <br />
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    // Then process bold text for each line
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const formattedLine = parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    });

    return (
      <React.Fragment key={lineIndex}>
        {formattedLine}
        {lineIndex < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}
