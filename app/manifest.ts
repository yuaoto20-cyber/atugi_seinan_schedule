import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const scopedRoot = basePath ? `${basePath}/` : "/";

  return {
    name: "授業管理",
    short_name: "授業管理",
    description: "非連続の日付ごとに授業予定と出席状況を管理できます。",
    start_url: scopedRoot,
    scope: scopedRoot,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    orientation: "portrait-primary",
    icons: [
      {
        src: `${basePath}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable"
      }
    ]
  };
}
