// components/MintForm.client.tsx
'use client';

import React, { useState } from 'react';
import { TonConnect } from '@tonconnect/sdk';

export default function MintForm() {
  const [recipientOwner, setRecipientOwner] = useState('');
  const [amount, setAmount] = useState('1000');
  const [status, setStatus] = useState('');
  const [tc, setTc] = React.useState<TonConnect | null>(null);

  React.useEffect(() => {
    const tonConnect = new TonConnect({
      manifestUrl: typeof window !== 'undefined' ? `${window.location.origin}/manifest.json` : undefined
    });
    setTc(tonConnect);
  }, []);

  const buildAndSendMint = async () => {
    setStatus('Requesting server to build payload...');
    try {
      const resp = await fetch('/api/build-mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientOwner, amount })
      });
      const body = await resp.json();
      if (!resp.ok) {
        setStatus('Server error: ' + JSON.stringify(body));
        return;
      }

      // backend returns message object ready to pass to TON Connect
      const message = body.message;
      setStatus('Got message from server; requesting wallet to send transaction...');
      if (!tc) {
        setStatus('TON Connect is not initialized.');
        return;
      }

      // send transaction using TON Connect
      // SDK APIs differ across versions; common pattern:
      // await tc.sendTransaction({ validUntil: Date.now() + 60000, messages: [message]});
      const request: Parameters<TonConnect['sendTransaction']>[0] = {
        validUntil: Date.now() + 60000,
        messages: [message]
      } as Parameters<TonConnect['sendTransaction']>[0];
      const result = await tc.sendTransaction(request);
      setStatus('Transaction sent: ' + JSON.stringify(result));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus('Error: ' + message);
    }
  };

  return (
    <div>
      <div>
        <label>Recipient (owner address): </label>
        <input value={recipientOwner} onChange={(e) => setRecipientOwner(e.target.value)} style={{ width: 480 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <label>Amount: </label>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={buildAndSendMint}>Request Mint</button>
      </div>
      <div style={{ marginTop: 12 }}>{status}</div>
    </div>
  );
}
