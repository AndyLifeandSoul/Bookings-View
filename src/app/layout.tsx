import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Inter, bundled and applied the same on every machine regardless of OS -
 * the staff terminals this app actually runs on are Windows laptops, not
 * Mac, and the OS-native font stack tried previously meant Andy's own Mac
 * (San Francisco) would never match what staff on Windows see (Segoe UI).
 * Inter is the closest freely-licensable relative to SF Pro - both are
 * grotesks purpose-built for legibility in dense UI at small sizes, which
 * is why SF Pro read as "clean and easy to read" in the first place - and
 * shipping it as a real font file means every machine renders identically,
 * a shared product should look the same on the manager's Mac and the
 * bar's Windows laptop alike. JetBrains Mono stays for the one place
 * monospace actually earns its keep: a generated password shown as a
 * literal string of characters to copy.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Life & Soul Staff",
  description: "Staff and admin portal for Life & Soul venues.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
