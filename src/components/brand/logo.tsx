import { Link } from "@tanstack/react-router";
import logoUrl from "@/assets/logo-leo-moraes.png";
import logoLightUrl from "@/assets/logo-leo-moraes-light.png";
import { useTheme } from "@/lib/theme-context";

/**
 * Logo oficial LÉO MORAES BARBER.
 * Theme-aware:
 *  - Dark mode → logo branca + dourada (original)
 *  - Light mode → logo preta + dourada
 *
 * O PNG fonte é 1024x1024. Renderizamos sempre em 2x do tamanho de exibição
 * via width/height intrínsecos para preservar nitidez em DPR alto e evitar
 * downscale borrado em headers pequenos.
 */
export function Logo({
  className = "",
  size = 44,
  withLink = true,
}: {
  className?: string;
  size?: number;
  withLink?: boolean;
}) {
  const { theme } = useTheme();
  const src = theme === "light" ? logoLightUrl : logoUrl;
  const intrinsic = Math.min(1024, Math.round(size * 3));

  const content = (
    <img
      src={src}
      alt="LÉO MORAES BARBER"
      width={intrinsic}
      height={intrinsic}
      decoding="async"
      className="select-none object-contain"
      style={{
        width: size,
        height: size,
        imageRendering: "auto",
      }}
      draggable={false}
    />
  );

  if (!withLink) {
    return <div className={`flex items-center ${className}`}>{content}</div>;
  }

  return (
    <Link
      to="/"
      className={`flex items-center ${className}`}
      aria-label="LÉO MORAES BARBER — início"
    >
      {content}
    </Link>
  );
}

export function LogoMark({ size = 96 }: { size?: number }) {
  const { theme } = useTheme();
  const src = theme === "light" ? logoLightUrl : logoUrl;
  const intrinsic = Math.min(1024, Math.round(size * 2));
  return (
    <img
      src={src}
      alt="LÉO MORAES BARBER"
      width={intrinsic}
      height={intrinsic}
      decoding="async"
      className="select-none object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
  );
}

export { logoUrl };
