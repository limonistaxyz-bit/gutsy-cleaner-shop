import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gutsy Cleaner Shop",
  description: "Shop small-batch Gutsy Cleaner by Limonista for local pickup.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

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
