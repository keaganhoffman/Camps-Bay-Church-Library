import type { MetadataRoute } from "next";

// The PWA manifest: what makes "Add to Home Screen" install the kiosk
// as a full-screen app with its own icon and name.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Library — Christian Life Camps Bay",
    short_name: "Library",
    description: "Self-service church library kiosk",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F5F7",
    theme_color: "#0B6B8D",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
