// components/WalletConnect.client.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { TonConnect, Wallet } from '@tonconnect/sdk';

export default function WalletConnect() {
  const [tc, setTc] = useState<TonConnect | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    const tonConnect = new TonConnect({
      manifestUrl: typeof window !== 'undefined' ? `${window.location.origin}/manifest.json` : undefined
    });
    setTc(tonConnect);

    const handleStatus = (wallet: Wallet | null) => {
      setAccount(wallet?.account.address ?? null);
    };
    const unsubscribe = tonConnect.onStatusChange(handleStatus);

    return () => {
      unsubscribe();
    };
  }, []);

  const connect = async () => {
    if (!tc) return;
    const wallets = await tc.getWallets();
    const wallet = wallets[0];
    if (!wallet) return;

    if ('jsBridgeKey' in wallet) {
      tc.connect({ jsBridgeKey: wallet.jsBridgeKey });
      return;
    }

    if ('universalLink' in wallet && 'bridgeUrl' in wallet) {
      tc.connect({ universalLink: wallet.universalLink, bridgeUrl: wallet.bridgeUrl });
    }
  };

  const disconnect = async () => {
    if (!tc) return;
    await tc.disconnect();
  };

  return (
    <div>
      {account ? (
        <>
          <div>Connected: {account}</div>
          <button onClick={disconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
