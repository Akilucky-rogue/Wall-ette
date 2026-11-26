import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* storage blocked */ }
  }
  return (
    <button type="button" onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={dark} className="grid size-10 place-items-center rounded-full text-foreground transition hover:bg-sand">
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
