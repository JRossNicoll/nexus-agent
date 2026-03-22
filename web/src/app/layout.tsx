import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/lib/query-provider';

export const metadata: Metadata = {
  title: 'MEDO — Personal AI Agent',
  description: 'Your intelligent personal AI assistant with memory, skills, and proactive insights.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: '#0a0a0a' }}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
