import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Ícone "i" elegante com tooltip premium.
 * Usado nos KPIs estratégicos para explicar o indicador em linguagem
 * de negócio simples — sem termos técnicos.
 */
export function KpiHint({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Sobre este indicador"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/60 transition hover:text-gold focus:outline-none focus-visible:text-gold"
          >
            <Info className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="end"
          className="max-w-[240px] border border-gold/20 bg-surface-1 text-foreground shadow-lg"
        >
          <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
