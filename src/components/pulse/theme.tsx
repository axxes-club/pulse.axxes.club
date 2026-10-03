"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const t = localStorage.getItem("pulse-theme") || "dark";
    setTheme(t);
    document.documentElement.dataset.theme = t;
  }, []);
  return (
    <button
      className="icon-button"
      aria-label="Switch theme"
      onClick={() => {
        const t = theme === "dark" ? "light" : "dark";
        setTheme(t);
        document.documentElement.dataset.theme = t;
        localStorage.setItem("pulse-theme", t);
      }}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
