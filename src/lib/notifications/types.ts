/**
 * Arquitetura de notificações WhatsApp — channel adapter pattern.
 *
 * Permite trocar o backend de envio (wa.me link, Evolution API, Twilio,
 * Cloud API oficial) sem mudar o código de produto. Cada channel implementa
 * o mesmo contrato `WhatsAppChannel`.
 */

export type WhatsAppMessage = {
  to: string; // E.164 ou dígitos
  text: string;
};

export type SendResult =
  | { ok: true; mode: "automated" | "manual"; channel: string }
  | { ok: false; mode: "automated" | "manual"; channel: string; reason: string };

export interface WhatsAppChannel {
  /** Identificador legível do canal: "wa-link", "evolution", "cloud-api". */
  readonly id: string;
  /** True quando entrega é automática (sem clique do usuário). */
  readonly automated: boolean;
  /** Envia ou prepara o envio. */
  send(msg: WhatsAppMessage): Promise<SendResult>;
}
