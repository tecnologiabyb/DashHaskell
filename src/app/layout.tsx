import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'Haskell | Relatório de Marketing',
  description: 'Dashboard de Meta Ads e Google Ads da Haskell Cosméticos',
  icons: { icon: '/haskell-logo.webp' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={montserrat.variable}>
      <body>{children}</body>
    </html>
  );
}
