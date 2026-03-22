import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/lib/query-provider';

export const metadata: Metadata = {
  title: 'NEXUS — Personal AI Agent',
  description: 'Enhanced Personal AI Agent Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: '#0c0e12' }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
