"use client";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
export function ThemeToggle() {
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    let t="dark";try{t=localStorage.getItem("pulse-theme") || "dark"}catch{}
    if(!["light","dark"].includes(t))t="dark";
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
        try{localStorage.setItem("pulse-theme", t)}catch{}
      }}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
