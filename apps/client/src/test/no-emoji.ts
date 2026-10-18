// The no-emoji check every UI test uses (island-ui, references/icons.md, "Characters not allowed in player-facing
// text"). The player sees icons, never emoji, and some phones draw plain symbols (check marks, arrows, stars, play
// triangles) as colored emoji, so those count too. The list lives in this one pattern: do not copy it into a test.
//
//   import { expectNoEmoji } from '../test/no-emoji.ts';
//   const { container } = render(<Screen />);
//   expectNoEmoji(container);

/**
 * Emoji and the symbols some phones draw as emoji: pictographs, variation selector 16, the keycap, arrows,
 * clocks and media symbols, circled letters, shapes, dingbats and the supplemental arrows and symbols. The middle dot,
 * the multiplication sign, dashes, curly quotes and the ellipsis are not in it and stay allowed.
 */
export const EMOJI_OR_SYMBOL =
  /[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{1F000}-\u{1FAFF}]/u;

export interface EmojiFinding {
  character: string;
  /** For example 'U+2713'. */
  codePoint: string;
}

/** The first emoji or emoji-like symbol in the text, or null when it is plain. */
export function findEmoji(text: string): EmojiFinding | null {
  const match = EMOJI_OR_SYMBOL.exec(text);
  if (match === null) return null;
  const character = match[0];
  const code = character.codePointAt(0) ?? 0;
  return { character, codePoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}` };
}

/** Attributes whose value a player reads or a screen reader says. */
const TEXT_ATTRIBUTES = ['alt', 'aria-label', 'aria-description', 'aria-placeholder', 'aria-valuetext', 'title', 'placeholder', 'value'];
/** Elements whose text is code, not something the player sees. */
const HIDDEN_TEXT = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

/** Every string of a rendered element that a player can see or hear: its text and the attributes above. */
export function playerFacingText(root: Element): string[] {
  const found: string[] = [];
  const visit = (element: Element) => {
    if (HIDDEN_TEXT.has(element.tagName)) return;
    for (const name of TEXT_ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value) found.push(value);
    }
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === 3 && node.textContent) found.push(node.textContent);
      else if (node.nodeType === 1) visit(node as Element);
    }
  };
  visit(root);
  return found;
}

/** Throws, naming the character, when the string or anything the element shows has an emoji or an emoji-like symbol. */
export function expectNoEmoji(subject: string | Element): void {
  const texts = typeof subject === 'string' ? [subject] : playerFacingText(subject);
  for (const text of texts) {
    const finding = findEmoji(text);
    if (finding !== null) {
      throw new Error(`Emoji or emoji-like symbol ${finding.codePoint} in player-facing text: ${JSON.stringify(text)}. Draw an icon instead (island-ui, icons.md).`);
    }
  }
}
