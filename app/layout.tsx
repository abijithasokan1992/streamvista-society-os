import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vista OS Command Center',
  description: 'AI operating layer for StreamVista workflows and connected agents.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
