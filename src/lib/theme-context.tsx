import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
const STORAGE_KEY = "lmb-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeClass(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Dark é o padrão (definido em :root). Light é ativado isoladamente via .light.
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default = dark (mantém aparência atual premium preto+dourado)
  const [theme, setThemeState] = useState<Theme>("dark");

  // Hidrata do localStorage no client
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const initial: Theme = stored === "light" || stored === "dark" ? stored : "dark";
      setThemeState(initial);
      applyThemeClass(initial);
    } catch {
      applyThemeClass("dark");
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyThemeClass(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback seguro fora do provider (ex.: SSR antes da hidratação)
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
