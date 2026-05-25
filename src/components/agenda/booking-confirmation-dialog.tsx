import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildWhatsAppUrl, formatPhone, openExternalUrl } from "@/lib/phone";
import { CheckCircle2, Calendar, Clock, Scissors, User, MessageCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export interface BookingConfirmationData {
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  startsAt: Date;
  shopName?: string;
}

export function BookingConfirmationDialog({
  data,
  open,
  onOpenChange,
}: {
  data: BookingConfirmationData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!data) return null;

  const dateLabel = format(data.startsAt, "EEEE, dd 'de' MMMM", { locale: ptBR });
  const timeLabel = format(data.startsAt, "HH:mm", { locale: ptBR });
  const shop = data.shopName ?? "Léo Moraes Barber";

  const message =
    `Olá, ${data.customerName} 👋\n\n` +
    `Seu horário foi confirmado com sucesso ✂\n\n` +
    `📅 Data: ${dateLabel}\n` +
    `🕒 Horário: ${timeLabel}\n` +
    `✂ Serviço: ${data.serviceName}\n\n` +
    `Nos vemos em breve 🙂\n\n` +
    `${shop}`;

  const waUrl = buildWhatsAppUrl(data.customerPhone, message);

  function handleSend() {
    if (!waUrl) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    openExternalUrl(waUrl);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden border-gold/30 bg-gradient-to-b from-background to-black/60 p-0">
        {/* Header premium */}
        <div className="relative bg-gradient-to-br from-gold/20 via-gold/5 to-transparent px-6 pt-7 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40">
            <CheckCircle2 className="h-7 w-7 text-gold" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Horário reservado com sucesso ✂
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tudo pronto. Agora é só avisar o cliente.
          </p>
        </div>

        {/* Detalhes */}
        <div className="space-y-3 px-6 py-5">
          <DetailRow icon={<User className="h-4 w-4" />} label="Cliente" value={data.customerName} />
          <DetailRow icon={<Scissors className="h-4 w-4" />} label="Serviço" value={data.serviceName} />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label="Data"
            value={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
          />
          <DetailRow icon={<Clock className="h-4 w-4" />} label="Horário" value={timeLabel} />
        </div>

        {/* CTA WhatsApp */}
        <div className="border-t border-border/40 bg-black/30 px-6 py-5 space-y-3">
          {waUrl ? (
            <>
              <Button
                type="button"
                onClick={handleSend}
                className="w-full bg-gradient-to-r from-[#25D366] to-[#1DA851] text-white hover:opacity-95 shadow-lg shadow-emerald-500/10"
                size="lg"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Enviar confirmação no WhatsApp
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Abriremos o WhatsApp com a mensagem pronta para{" "}
                <span className="text-gold/90">{formatPhone(data.customerPhone)}</span>
              </p>
            </>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cliente sem telefone cadastrado. Adicione o número no perfil para enviar a
                confirmação automaticamente.
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gold/10 text-gold">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
