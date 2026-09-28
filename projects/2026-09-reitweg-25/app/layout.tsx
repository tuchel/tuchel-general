import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reitweg 25 — Design Studio",
  description: "Explore a new chapter for Reitweg 25: light, landscape, and architecture.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = {width:"device-width",initialScale:1,viewportFit:"cover"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
