import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "מעקב התקדמות בנייה - מוסינזון 5",
  description: "מערכת מעקב התקדמות לפרויקט תמ״א 38/2 מוסינזון 5, תל אביב",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased min-h-screen bg-background`}>
        <div className="flex min-h-screen">
          <Navigation />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
