import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

// Only for the "nexora" wordmark in the logo.
const sora = Sora({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-sora",
});

export const metadata: Metadata = {
  title: "Nexora CRM",
  description: "Internal sales platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${sora.variable} bg-canvas text-navy antialiased`}>
        {children}
      </body>
    </html>
  );
}