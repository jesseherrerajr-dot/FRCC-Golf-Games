import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FRCC Golf Games",
    short_name: "FRCC Golf",
    description:
      "Fairbanks Ranch Country Club golf event management — RSVPs, schedules, and more.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f0f3f7", // navy-50
    theme_color: "#1b2a4a", // navy-900
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
