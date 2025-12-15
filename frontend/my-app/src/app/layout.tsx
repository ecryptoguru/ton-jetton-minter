// app/layout.tsx
import './globals.css'; // optional
import { ReactNode } from 'react';

export const metadata = {
  title: 'Jetton Minter dApp',
  description: 'TON Jetton minter frontend (Next 14, App Router)'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
