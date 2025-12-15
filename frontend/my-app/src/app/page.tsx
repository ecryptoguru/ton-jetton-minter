// app/page.tsx
import dynamic from 'next/dynamic';

// Client components must be loaded dynamically or imported inside client file.
// We'll dynamically import the WalletConnect and MintForm client components.
const WalletConnect = dynamic(() => import('../components/WalletConnect.client'), { ssr: false });
const MintForm = dynamic(() => import('../components/MintForm.client'), { ssr: false });

export default function Page() {
  return (
    <div>
      <h1>Jetton Minter dApp (Next 14)</h1>
      <WalletConnect />
      <hr style={{ margin: '16px 0' }} />
      <MintForm />
    </div>
  );
}
