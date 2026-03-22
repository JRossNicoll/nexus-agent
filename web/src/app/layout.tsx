import type { Metadata } from 'next';
import './globals.css';

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
      <body className="min-h-screen bg-surface-0">
        {children}
      </body>
    </html>
  );
}
