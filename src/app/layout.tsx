import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Berri Tutor Admin Portal",
  description: "Advanced tools for tracking and managing candidate progress",
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-row bg-[#0d0d0f] text-white overflow-hidden" style={{ height: "100vh" }}>
        <Sidebar />
        <div style={{ flex: 1, overflowY: "auto", height: "100vh" }}>
           {children}
        </div>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
