import { describe, expect, it } from 'vitest';
import { expectNoEmoji, findEmoji } from './no-emoji.ts';

// Every forbidden character is written as a code point escape: this file must stay emoji-free itself.
describe('findEmoji', () => {
  it.each([
    ['an emoji', 'Ready \u{1F600}'],
    ['a pictograph from the plain symbols block', 'Sunny \u{2600}'],
    ['a check mark', 'Done \u{2713}'],
    ['a heavy check mark', 'Done \u{2714}'],
    ['a cross', 'Failed \u{2717}'],
    ['a warning sign', 'Careful \u{26A0}'],
    ['an arrow', 'Next \u{2192}'],
    ['a play triangle', '\u{25B6} Play'],
    ['a star', '\u{2605}\u{2605}'],
    ['a hourglass', 'Wait \u{23F3}'],
    ['a copyright sign', '\u{00A9} Island'],
    ['a trade mark sign', 'Island\u{2122}'],
    ['a variation selector 16', 'Done\u{FE0F}'],
    ['a keycap', '3\u{FE0F}\u{20E3}'],
    ['a circled letter', '\u{24C2}'],
  ])('finds %s', (_name, text) => {
    expect(findEmoji(text)).not.toBeNull();
  });

  it.each([
    ['plain words', 'Getting your island ready'],
    ['digits and punctuation', "It's 12:30 (about 5%), 3/4 - done; really? yes! a + b & c"],
    ['curly quotes and apostrophes', '\u{201C}Lena\u{201D} said it\u{2019}s fine'],
    ['en and em dashes and the ellipsis', 'a\u{2013}b \u{2014} c\u{2026}'],
    ['the middle dot between name and role', 'Lena \u{00B7} Port master'],
    ['the multiplication sign in a size', 'Takes 2 \u{00D7} 2 tiles'],
    ['an empty string', ''],
  ])('allows %s', (_name, text) => {
    expect(findEmoji(text)).toBeNull();
  });

  it('reports the character it found', () => {
    expect(findEmoji('Done \u{2713}')).toEqual({ character: '\u{2713}', codePoint: 'U+2713' });
  });
});

describe('expectNoEmoji', () => {
  it('passes for a plain string and for an element with plain text and names', () => {
    document.body.innerHTML = '<main><h1>Island</h1><img alt="A cottage" src="/icons/building_cottage_a.png"><button aria-label="Close">x</button></main>';
    expectNoEmoji('Plain text');
    expectNoEmoji(document.body);
  });

  it('fails for a string with an emoji, naming the character', () => {
    expect(() => expectNoEmoji('Done \u{2713}')).toThrow(/U\+2713/);
  });

  it('fails for an emoji in visible text', () => {
    document.body.innerHTML = '<p>Welcome \u{1F334}</p>';
    expect(() => expectNoEmoji(document.body)).toThrow(/U\+1F334/);
  });

  it.each(['alt', 'aria-label', 'title', 'placeholder', 'aria-description', 'value'])('fails for an emoji in the %s attribute', (attribute) => {
    document.body.innerHTML = `<div><input ${attribute}="Ready \u{2705}"></div>`;
    expect(() => expectNoEmoji(document.body)).toThrow(/U\+2705/);
  });

  it('does not count text that is not shown to the player', () => {
    document.body.innerHTML = '<script>var s = "\u{2713}"</script><style>.a::before{content:"\u{2713}"}</style><p>Fine</p>';
    expectNoEmoji(document.body);
  });
});
