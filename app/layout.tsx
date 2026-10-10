import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import ApiLoadingBar from "@/components/ApiLoadingBar";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import MicrosoftClarity from "@/components/MicrosoftClarity";
import DisableAutocomplete from "@/components/DisableAutocomplete";
import SplashScreen from "@/components/SplashScreenLoader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Yoton",
  description: "Yoton - Electronic Health Record System for Hospital",
  appleWebApp: {
    title: "Yoton",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full">
        <MicrosoftClarity />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <SplashScreen />
          <ServiceWorkerRegistration />
          <DisableAutocomplete />
          <ApiLoadingBar />
          {children}
          <Toaster
            position="bottom-right"
            richColors
            duration={3000}
            visibleToasts={1}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
