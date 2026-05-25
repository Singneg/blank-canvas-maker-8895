/**
 * Marca d'água oficial LÉO MORAES BARBER — versão editorial premium.
 * Logo transparente, escala ampla, opacidade 2-4%, blur sutil, blend suave.
 */
import logoUrl from "@/assets/logo-leo-moraes.png";

export function GoldWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
    >
      <img
        src={logoUrl}
        alt=""
        draggable={false}
        className="select-none object-contain opacity-[0.03] md:opacity-[0.04]"
        style={{
          width: "min(95vw, 1100px)",
          height: "min(95vw, 1100px)",
          filter: "blur(0.4px) saturate(1.1)",
        }}
      />
    </div>
  );
}
