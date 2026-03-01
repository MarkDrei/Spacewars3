import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spacewars: Ironcore",
  description: "A space exploration and resource management game",
  manifest: "/manifest.json",
  themeColor: "#ff6600",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spacewars",
  },
  icons: {
    icon: "/favicon/favicon.ico",
    shortcut: "/favicon/favicon-32x32.png",
    apple: "/favicon/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
