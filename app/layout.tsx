import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { UserProvider } from '@/contexts/UserContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { RewardPopupProvider } from '@/components/ui/RewardPopup';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Hive Earn - Earn USDT',
  description: 'Earn USDT by watching ads, completing tasks, and referring friends.',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#0A0A0A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className="bg-[#0A0A0A] text-white antialiased">
        {/* Adsgram SDK */}
        <Script src="https://sad.adsgram.ai/js/sad.min.js" strategy="afterInteractive" />
        {/* Monetag SDK */}
        <Script
          src="//libtl.com/sdk.js"
          data-zone="11196790"
          data-sdk="show_11196790"
          strategy="afterInteractive"
        />
        {/* Gigapub SDK */}
        <Script src="https://ad.gigapub.tech/script?id=7069" strategy="afterInteractive" />
        <UserProvider>
          <LanguageProvider telegramLangCode={typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code : undefined}>
            <RewardPopupProvider>
              {children}
              <Toaster
                theme="dark"
                position="top-center"
                toastOptions={{
                  style: {
                    background: 'rgba(20, 20, 20, 0.95)',
                    border: '1px solid rgba(245, 197, 24, 0.2)',
                    color: '#fff',
                    backdropFilter: 'blur(20px)',
                  },
                }}
              />
            </RewardPopupProvider>
          </LanguageProvider>
        </UserProvider>
      </body>
    </html>
  );
}
