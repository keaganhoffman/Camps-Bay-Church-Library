import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Library — Christian Life Camps Bay",
  description: "Self-service library kiosk for Christian Life Camps Bay",
  // An internal church tool — keep it out of search engines.
  robots: { index: false, follow: false },
  // iPad "Add to Home Screen" behaviour: full-screen, named Library.
  appleWebApp: { capable: true, title: "Library", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Kiosk feel: no pinch-zoom drift on a shared touchscreen.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B6B8D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
