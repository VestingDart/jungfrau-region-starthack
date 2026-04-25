import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jungfrau Region Wallet",
  description: "Digital guest wallet for the Jungfrau Region",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
