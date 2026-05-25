import { buildWhatsAppUrl, openExternalUrl } from "@/lib/phone";
import type { SendResult, WhatsAppChannel, WhatsAppMessage } from "./types";

/**
 * Canal FALLBACK baseado em wa.me — abre o WhatsApp do USUÁRIO ATUAL com
 * a mensagem pré-preenchida. NÃO é automação real; depende de gesto do
 * usuário e a mensagem sai do número do usuário, não da plataforma.
 *
 * Existe apenas para manter o produto funcional enquanto a Evolution API
 * (canal automático real) não estiver configurada.
 */
export const waLinkChannel: WhatsAppChannel = {
  id: "wa-link",
  automated: false,
  async send(msg: WhatsAppMessage): Promise<SendResult> {
    const url = buildWhatsAppUrl(msg.to, msg.text);
    if (!url) {
      return {
        ok: false,
        mode: "manual",
        channel: "wa-link",
        reason: "Telefone inválido",
      };
    }
    openExternalUrl(url);
    return { ok: true, mode: "manual", channel: "wa-link" };
  },
};
