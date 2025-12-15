// backend/server.ts
import express from 'express';
import fs from 'fs';
import path from 'path';
import { Address, beginCell, Cell, contractAddress } from '@ton/core';

const app = express();
app.use(express.json());

// Load wallet code BOC on server start (compiled by Blueprint)
const walletCodeBocPath = path.join(__dirname, '..', 'artifacts', 'jetton_wallet.cell.boc');
if (!fs.existsSync(walletCodeBocPath)) {
  console.warn('Warning: wallet code BOC not found at', walletCodeBocPath, '. Ensure blueprint build outputs code cell BOC here.');
}

const walletCodeBoc = fs.existsSync(walletCodeBocPath) ? fs.readFileSync(walletCodeBocPath) : null;

function loadWalletCodeCell(): Cell | null {
  if (!walletCodeBoc) return null;
  const cells = Cell.fromBoc(walletCodeBoc);
  return cells[0] ?? null;
}

/**
 * Helper: build payload cell for mint and return base64 BOC
 */
function buildMintPayloadBase64(amountBn: bigint, recipientWalletAddr: Address): string {
  const b = beginCell();
  b.storeUint(0x23, 32);
  b.storeUint(amountBn, 128);
  b.storeAddress(recipientWalletAddr);
  const c = b.endCell();
  const boc = c.toBoc();
  return boc.toString('base64');
}

/**
 * Compute deterministic wallet address (server-side)
 */
function computeJettonWalletAddress(masterAddr: Address, ownerAddr: Address, walletCodeCell: Cell) {
  const db = beginCell();
  db.storeAddress(ownerAddr);
  db.storeAddress(masterAddr);
  const dataCell = db.endCell();

  const addr = contractAddress(0, {
    code: walletCodeCell,
    data: dataCell,
  });
  return addr;
}

// API: /api/build-mint
// body: { recipientOwner: string (TON address, e.g. EQ...), amount: string (integer tokens) }
// response: { payloadBase64, recipientWalletAddress (string), txMessage }
app.post('/api/build-mint', async (req, res) => {
  try {
    const { recipientOwner, amount } = req.body;
    if (!recipientOwner || !amount) {
      return res.status(400).json({ error: 'missing recipientOwner or amount' });
    }

    const walletCodeCell = loadWalletCodeCell();
    if (!walletCodeCell) {
      return res.status(500).json({ error: 'wallet code cell not found on server' });
    }

    const masterAddrStr = process.env.MINTER_ADDRESS;
    if (!masterAddrStr) {
      return res.status(500).json({ error: 'MINTER_ADDRESS not set in env' });
    }

    // parse addresses
    const ownerAddress = Address.parse(recipientOwner);
    const masterAddress = Address.parse(masterAddrStr);

    // compute wallet address
    const recipientWalletAddr = computeJettonWalletAddress(masterAddress, ownerAddress, walletCodeCell);

    // build payload
    const amountBn = BigInt(amount);
    const payloadBase64 = buildMintPayloadBase64(amountBn, recipientWalletAddr);

    // Build TON Connect message skeleton (caller can adjust value for gas)
    const message = {
      to: masterAddrStr,
      value: (1000000).toString(), // example nanoton (0.001 TON) — adjust after tests
      data: {
        payload: payloadBase64
      }
    };

    return res.json({
      payloadBase64,
      recipientWalletAddress: recipientWalletAddr.toString(),
      message
    });
  } catch (err: any) {
    console.error('build-mint error', err);
    return res.status(500).json({ error: err.message ?? String(err) });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
app.listen(PORT, () => {
  console.log(`Mint builder service listening on ${PORT}`);
});
