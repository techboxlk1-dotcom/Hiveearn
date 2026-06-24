import './globals.css';
import type { Metadata } from 'next';
import { UserProvider } from '@/contexts/UserContext';
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
        <UserProvider>
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
        </UserProvider>
      </body>
    </html>
  );
}
