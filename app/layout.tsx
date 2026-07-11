import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AdminAppShell } from "./providers/AdminAppShell";
import { AuthProvider } from "./providers/AuthProvider";
import { ThemeProvider } from "./providers/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Miniway Admin Dashboard",
  description:
    "Comprehensive admin dashboard for Miniway transportation system",
  keywords: ["transportation", "admin", "dashboard", "miniway", "bus", "fleet"],
  authors: [{ name: "Miniway Team" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <AdminAppShell>{children}</AdminAppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

