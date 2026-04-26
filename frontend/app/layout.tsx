import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/language";

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
    <html lang="de">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
