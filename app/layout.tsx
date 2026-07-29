import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Library — Christian Life Camps Bay",
  description: "Self-service library kiosk for Christian Life Camps Bay",
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
