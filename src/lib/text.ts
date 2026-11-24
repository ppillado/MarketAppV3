/** Pasa a minúsculas y quita tildes, así "azucar" coincide con "Azúcar". */
export function normalizeText(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
