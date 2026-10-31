/**
 * The plural of a lower-case English noun, for filter labels ("All
 * entities", "All statuses"). Covers the label nouns the app uses; appending
 * "s" had produced "All entitys" and "All statuss" on the People pages.
 */
export function pluralNoun(noun: string): string {
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  return `${noun}s`;
}
