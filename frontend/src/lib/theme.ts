import { useSyncExternalStore } from "react";

function subscribe(listener: () => void) {
  window.addEventListener("smeta-theme-change", listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener("smeta-theme-change", listener);
    window.removeEventListener("storage", listener);
  };
}

export function setTheme(value: "dark" | "light") {
  const root = document.documentElement;
  root.dataset.switchingTheme = "true";
  root.dataset.theme = value;
  try {
    localStorage.setItem("smeta-theme", value);
  } catch {}
  window.dispatchEvent(new Event("smeta-theme-change"));
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      delete root.dataset.switchingTheme;
    }),
  );
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
}
