import type { SendResult, WhatsAppChannel, WhatsAppMessage } from "./types";

/**
 * Canal AUTOMÁTICO REAL via Evolution API.
 *
 * Status: arquitetura pronta — aguarda configuração de credenciais
 * (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE) como secrets
 * do servidor + endpoint server function `/api/notify-whatsapp`.
 *
 * Quando configurado, este canal entrega a mensagem sem qualquer ação do
 * usuário — direto do número da barbearia para o destinatário.
 */
export const evolutionChannel: WhatsAppChannel = {
  id: "evolution",
  automated: true,
  async send(msg: WhatsAppMessage): Promise<SendResult> {
    try {
      const res = await fetch("/api/notify-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return {
          ok: false,
          mode: "automated",
          channel: "evolution",
          reason: `HTTP ${res.status} ${txt}`.trim(),
        };
      }
      return { ok: true, mode: "automated", channel: "evolution" };
    } catch (err) {
      return {
        ok: false,
        mode: "automated",
        channel: "evolution",
        reason: err instanceof Error ? err.message : "network error",
      };
    }
  },
};
