import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/horarios")({
  component: HorariosPage,
});

const WEEKDAYS = [
  { i: 0, label: "Domingo" },
  { i: 1, label: "Segunda" },
  { i: 2, label: "Terça" },
  { i: 3, label: "Quarta" },
  { i: 4, label: "Quinta" },
  { i: 5, label: "Sexta" },
  { i: 6, label: "Sábado" },
];

interface Row {
  week_day: number;
  start_time: string;
  end_time: string;
  lunch_start: string | null;
  lunch_end: string | null;
  active: boolean;
}

function trimTime(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

function HorariosPage() {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(
    WEEKDAYS.map((d) => ({
      week_day: d.i,
      start_time: "09:00",
      end_time: "20:00",
      lunch_start: null,
      lunch_end: null,
      active: d.i >= 2 && d.i <= 6,
    })),
  );
  const [saving, setSaving] = useState(false);

  const { data: hours, isLoading } = useQuery({
    queryKey: ["business-hours"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("week_day, start_time, end_time, lunch_start, lunch_end, active");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!hours) return;
    setRows(
      WEEKDAYS.map((d) => {
        const h = hours.find((x) => (x as { week_day: number }).week_day === d.i) as
          | {
              week_day: number;
              start_time: string;
              end_time: string;
              lunch_start: string | null;
              lunch_end: string | null;
              active: boolean;
            }
          | undefined;
        return h
          ? {
              week_day: d.i,
              start_time: trimTime(h.start_time),
              end_time: trimTime(h.end_time),
              lunch_start: h.lunch_start ? trimTime(h.lunch_start) : null,
              lunch_end: h.lunch_end ? trimTime(h.lunch_end) : null,
              active: h.active,
            }
          : {
              week_day: d.i,
              start_time: "09:00",
              end_time: "20:00",
              lunch_start: null,
              lunch_end: null,
              active: false,
            };
      }),
    );
  }, [hours]);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((x) => (x.week_day === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    setSaving(true);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes.user) {
      setSaving(false);
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    const ownerId = userRes.user.id;
    const payload = rows.map((r) => ({
      owner_id: ownerId,
      week_day: r.week_day,
      start_time: r.start_time,
      end_time: r.end_time,
      lunch_start: r.lunch_start || null,
      lunch_end: r.lunch_end || null,
      active: r.active,
    }));
    const { error } = await supabase
      .from("business_hours")
      .upsert(payload, { onConflict: "owner_id,week_day" });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Horários atualizados");
    qc.invalidateQueries({ queryKey: ["business-hours"] });
    qc.invalidateQueries({ queryKey: ["slots"] });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-medium tracking-[0.3em] text-gold">
          OPERAÇÃO
        </p>
        <h1 className="mt-2 font-display text-4xl font-bold">
          Horário de atendimento
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define os horários disponíveis para agendamento público.
        </p>
      </header>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-border/60 bg-surface-1 p-6">
          {rows.map((r) => {
            const label = WEEKDAYS.find((d) => d.i === r.week_day)!.label;
            return (
              <div
                key={r.week_day}
                className="grid grid-cols-1 items-center gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0 lg:grid-cols-[120px_auto_1fr_1fr]"
              >
                <p className="font-medium">{label}</p>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) => update(r.week_day, { active: v })}
                  />
                  <span className="text-xs text-muted-foreground">
                    {r.active ? "Aberto" : "Fechado"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Abre</Label>
                  <Input
                    type="time"
                    value={r.start_time}
                    onChange={(e) =>
                      update(r.week_day, { start_time: e.target.value })
                    }
                    disabled={!r.active}
                    className="w-28"
                    step="1800"
                  />
                  <Label className="text-xs text-muted-foreground">Fecha</Label>
                  <Input
                    type="time"
                    value={r.end_time}
                    onChange={(e) =>
                      update(r.week_day, { end_time: e.target.value })
                    }
                    disabled={!r.active}
                    className="w-28"
                    step="1800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Almoço</Label>
                  <Input
                    type="time"
                    value={r.lunch_start ?? ""}
                    onChange={(e) =>
                      update(r.week_day, { lunch_start: e.target.value || null })
                    }
                    disabled={!r.active}
                    className="w-28"
                    step="1800"
                  />
                  <span className="text-xs text-muted-foreground">até</span>
                  <Input
                    type="time"
                    value={r.lunch_end ?? ""}
                    onChange={(e) =>
                      update(r.week_day, { lunch_end: e.target.value || null })
                    }
                    disabled={!r.active}
                    className="w-28"
                    step="1800"
                  />
                </div>
              </div>
            );
          })}
          <Button
            onClick={save}
            disabled={saving}
            className="mt-4 bg-gold text-background hover:bg-gold-soft"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar horários
          </Button>
        </div>
      )}
    </div>
  );
}
