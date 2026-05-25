/**
 * Phone formatting helpers — padrão único do sistema.
 * Visual: "(11) 943769788"  |  Storage: dígitos puros "11943769788"
 */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D+/g, "");
}

/**
 * Formata para exibição: "(DD) NÚMERO"
 * - 10 dígitos: (11) 12345678
 * - 11 dígitos: (11) 943769788  (sem hífen, conforme spec)
 * - outros tamanhos: retorna como veio (digitos)
 */
export function formatPhone(value: string | null | undefined): string {
  const d = onlyDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2, 11); // limita a 11 no total
  if (!rest) return `(${ddd})`;
  return `(${ddd}) ${rest}`;
}

/** Para salvar no banco — apenas dígitos. */
export function normalizePhoneForStorage(value: string | null | undefined): string | null {
  const d = onlyDigits(value);
  if (!d) return null;
  return d.slice(0, 11);
}

/** Mascara enquanto digita, mantendo o comportamento de input controlado. */
export function maskPhoneInput(value: string): string {
  return formatPhone(value);
}

/** Gera URL padrão do WhatsApp usando exclusivamente wa.me. */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message: string,
): string | null {
  const digits = onlyDigits(phone);
  if (!digits) return null;

  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/** Abre links externos em nova aba com proteções padrão. */
export function openExternalUrl(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
