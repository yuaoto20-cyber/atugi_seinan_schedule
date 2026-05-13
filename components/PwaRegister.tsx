"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const scope = basePath ? `${basePath}/` : "/";
      navigator.serviceWorker.register(`${basePath}/sw.js`, { scope }).catch(() => {
        // PWA support is additive; the app remains usable without a worker.
      });
    }
  }, []);

  return null;
}
