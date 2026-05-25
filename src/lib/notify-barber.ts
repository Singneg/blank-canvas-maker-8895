import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppUrl, formatPhone, openExternalUrl } from "@/lib/phone";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export interface NewBookingNotification {
  barberId: string;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  startsAt: Date;
}

/**
 * Notifica o barbeiro automaticamente via WhatsApp quando um novo
 * agendamento é criado. Usa o telefone salvo em `barbers.phone`.
 *
 * Estratégia anti-bloqueio:
 * - SEMPRE usa wa.me (nunca api.whatsapp.com)
 * - Abertura via window.open com noopener,noreferrer
 *
 * Como muitos navegadores bloqueiam window.open fora de um gesto direto
 * do usuário, esta função deve ser chamada DENTRO do mesmo handler de click
 * que confirma o agendamento.
 */
export async function notifyBarberNewBooking(
  data: NewBookingNotification,
): Promise<{ ok: boolean; reason?: "no-phone" | "barber-not-found" | "blocked" }> {
  const { data: barber, error } = await supabase
    .from("barbers")
    .select("phone, full_name")
    .eq("id", data.barberId)
    .maybeSingle();

  if (error || !barber) {
    return { ok: false, reason: "barber-not-found" };
  }

  if (!barber.phone) {
    toast.message("Sem WhatsApp do profissional", {
      description:
        "Cadastre o telefone do profissional em Configurações para receber alertas automáticos.",
    });
    return { ok: false, reason: "no-phone" };
  }

  const dateLabel = format(data.startsAt, "dd 'de' MMMM", { locale: ptBR });
  const timeLabel = format(data.startsAt, "HH:mm", { locale: ptBR });
  const phoneLabel = data.customerPhone ? formatPhone(data.customerPhone) : "Não informado";

  const message =
    `Novo agendamento ✂\n\n` +
    `Cliente: ${data.customerName}\n` +
    `Telefone: ${phoneLabel}\n` +
    `Serviço: ${data.serviceName}\n` +
    `Data: ${dateLabel}\n` +
    `Horário: ${timeLabel}\n\n` +
    `Seu cliente acabou de agendar.`;

  const url = buildWhatsAppUrl(barber.phone, message);
  if (!url) {
    return { ok: false, reason: "no-phone" };
  }

  openExternalUrl(url);
  return { ok: true };
}

// ---------------------------------------------------------------
// Notificação ao CLIENTE quando o status do agendamento muda
// ---------------------------------------------------------------

export type CustomerNotifyStatus = "confirmed" | "rescheduling" | "cancelled";

export interface CustomerStatusNotification {
  status: CustomerNotifyStatus;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  startsAt: Date;
  shopName?: string;
}

/**
 * Dispara mensagem premium no WhatsApp do cliente conforme o novo status.
 * Deve ser chamada DENTRO do handler de clique para preservar o gesto
 * do usuário e evitar bloqueio de window.open pelo navegador.
 */
export function notifyCustomerStatusChange(
  data: CustomerStatusNotification,
): { ok: boolean; reason?: "no-phone" } {
  if (!data.customerPhone) {
    toast.message("Cliente sem WhatsApp cadastrado", {
      description: "Não foi possível enviar a confirmação automática.",
    });
    return { ok: false, reason: "no-phone" };
  }

  const shop = data.shopName ?? "Léo Moraes Barber";
  const dateLabel = format(data.startsAt, "dd 'de' MMMM", { locale: ptBR });
  const timeLabel = format(data.startsAt, "HH:mm", { locale: ptBR });
  const firstName = data.customerName.split(" ")[0] || data.customerName;

  let message = "";
  if (data.status === "confirmed") {
    message =
      `Olá, ${firstName} 👋\n\n` +
      `Seu horário foi confirmado com sucesso ✂\n\n` +
      `📅 Data: ${dateLabel}\n` +
      `🕒 Horário: ${timeLabel}\n` +
      `✂ Serviço: ${data.serviceName}\n\n` +
      `Te esperamos 🙂\n${shop}`;
  } else if (data.status === "rescheduling") {
    message =
      `Olá, ${firstName} 👋\n\n` +
      `Precisamos ajustar seu horário agendado.\n\n` +
      `Por favor, entre em contato para reagendamento 🙂\n${shop}`;
  } else {
    message =
      `Olá, ${firstName} 👋\n\n` +
      `Seu agendamento foi cancelado.\n\n` +
      `Caso queira um novo horário, estamos à disposição 🙂\n${shop}`;
  }

  const url = buildWhatsAppUrl(data.customerPhone, message);
  if (!url) {
    return { ok: false, reason: "no-phone" };
  }
  openExternalUrl(url);
  // log silencioso para devs — útil em produção
  void formatPhone;
  return { ok: true };
}
