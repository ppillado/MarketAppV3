/** Lowercase and strip accents, so "azucar" matches "Azúcar". */
export function normalizeText(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
