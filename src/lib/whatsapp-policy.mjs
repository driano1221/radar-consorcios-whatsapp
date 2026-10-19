// Channel preference approved on 19/10/2026. Never change the base decision:
// oversight findings remain searchable, but do not go to WhatsApp.
export function isWhatsAppCategoryAllowed(item) {
  const category = String(item.classification?.category || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  return !['CONTROLE', 'FISCALIZACAO', 'CONTROLE / FISCALIZACAO'].includes(category);
}
