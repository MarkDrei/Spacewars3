import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spacewars: Ironcore",
  description: "A space exploration and resource management game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
