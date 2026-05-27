import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TinyFish World Cup Fantasy Scout",
  description: "A joke-first, source-backed World Cup Fantasy scout powered by TinyFish Search and Fetch."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
