import { evolutionChannel } from "./evolution-channel";
import { waLinkChannel } from "./wa-link-channel";
import type { SendResult, WhatsAppChannel, WhatsAppMessage } from "./types";

export type { SendResult, WhatsAppChannel, WhatsAppMessage };

/**
 * Estratégia: tenta o canal automático real (Evolution API). Se falhar
 * (ex.: ainda não configurado, sem rede), faz fallback transparente para
 * wa.me — abre o WhatsApp manualmente com a mensagem pronta.
 *
 * Isto preserva o fluxo profissional desejado sem quebrar enquanto a
 * automação real não está ligada.
 */
export async function sendWhatsApp(msg: WhatsAppMessage): Promise<SendResult> {
  // Heurística simples: tenta Evolution; se a rota não existir ou cair, usa wa-link.
  const auto = await evolutionChannel.send(msg);
  if (auto.ok) return auto;
  return waLinkChannel.send(msg);
}

/** Indica se o ambiente tem automação real (para mostrar selo "automático"). */
export function automationEnabled(): boolean {
  // Detecção real virá quando o endpoint /api/notify-whatsapp responder 200
  // a uma chamada de healthcheck. Por enquanto retorna false.
  return false;
}

export { evolutionChannel, waLinkChannel };
