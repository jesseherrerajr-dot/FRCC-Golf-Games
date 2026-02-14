import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FRCC Golf Games",
  description: "Fairbanks Ranch Country Club golf event management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-navy-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
