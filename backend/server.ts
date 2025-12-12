// backend/server.ts
/**
 * Payload builder service for TON Jetton Minter
 *
 * Behavior:
 *  - Loads JettonWallet code cell from multiple possible artifact formats/locations:
 *      artifacts/jetton_wallet.cell.boc
 *      artifacts/JettonWallet.json (keys: hex, code, codeBoc, TVC)
 *      build/JettonWallet.json
 *      artifacts/jetton_wallet.tvc
 *      path provided via env WALLET_CODE_PATH
 *  - Exposes POST /api/build-mint expecting JSON { recipientOwner, amount }
 *  - Returns JSON { payloadBase64, recipientWalletAddress, message }
 *
 * Notes:
 *  - Ensure MINTER_ADDRESS env var is set (the minter contract address on Testnet).
 *  - This server only builds payloads and returns transaction skeletons. It does NOT sign or submit transactions.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { Address, beginCell, Cell, contractAddress } from '@ton/core';

const app = express();
app.use(express.json({ limit: '1mb' }));

// Config
const DEFAULT_WALLET_BOC_PATHS = [
  path.join(process.cwd(), 'artifacts', 'jetton_wallet.cell.boc'),
  path.join(process.cwd(), 'artifacts', 'JettonWallet.json'),
  path.join(process.cwd(), 'build', 'JettonWallet.json'),
  path.join(process.cwd(), 'artifacts', 'jetton_wallet.tvc'),
  path.join(process.cwd(), 'build', 'jetton_wallet.tvc'),
];

const WALLET_CODE_PATH = process.env.WALLET_CODE_PATH; // optional override
const MINTER_ADDRESS = process.env.MINTER_ADDRESS; // required
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const MAX_MINT_AMOUNT = process.env.MAX_MINT_AMOUNT ? BigInt(process.env.MAX_MINT_AMOUNT) : BigInt('1000000000000000000'); // default cap = 1e18 units (adjust)
const DEFAULT_MSG_VALUE = process.env.DEFAULT_MSG_VALUE || '1500000'; // nanoTON to send with message (adjust after gas profiling)

let walletCodeCell: Cell | null = null;

/**
 * Try to load wallet code cell from a BOC buffer.
 * Returns a Cell or throws.
 */
function loadCellFromBocBuffer(buf: Buffer): Cell {
  const arr = Cell.fromBoc(buf);
  if (!arr || arr.length === 0) throw new Error('Cell.fromBoc returned empty array');
  // If the BOC contains multiple top-level cells, typically the first is code.
  return arr[0];
}

/**
 * Attempt to load wallet code cell from different artifact formats.
 * Priorities:
 *  1) explicit WALLET_CODE_PATH env var
 *  2) artifacts/jetton_wallet.cell.boc
 *  3) artifacts/JettonWallet.json (keys: hex, code, codeBoc, TVC)
 *  4) build/JettonWallet.json
 *  5) artifacts/jetton_wallet.tvc
 *
 * This function tries to decode common fields conservatively.
 */
function discoverAndLoadWalletCodeCell(): Cell | null {
  const candidatePaths = WALLET_CODE_PATH ? [WALLET_CODE_PATH, ...DEFAULT_WALLET_BOC_PATHS] : DEFAULT_WALLET_BOC_PATHS;

  for (const p of candidatePaths) {
    try {
      if (!fs.existsSync(p)) continue;
      const stat = fs.statSync(p);
      if (stat.isFile()) {
        const ext = path.extname(p).toLowerCase();
        if (ext === '.boc') {
          const buf = fs.readFileSync(p);
          const cell = loadCellFromBocBuffer(buf);
          console.log('Loaded wallet code cell from BOC:', p);
          return cell;
        }

        if (ext === '.json') {
          const json = JSON.parse(fs.readFileSync(p, 'utf8'));
          // Look for common keys
          if (json.hex) {
            const buf = Buffer.from(json.hex, 'hex');
            try {
              const cell = loadCellFromBocBuffer(buf);
              console.log('Loaded wallet code from JSON.hex at', p);
              return cell;
            } catch (e) {
              // not BOC; perhaps hex is raw TVC bytes or different shape - still try as code block
              // fallback: treat as raw bytes and attempt to parse
              try {
                const altCell = loadCellFromBocBuffer(buf);
                console.log('Loaded wallet code (fallback) from JSON.hex at', p);
                return altCell;
              } catch (err) {
                // continue to other keys
              }
            }
          }
          if (json.code) {
            // code may be base64 or hex string
            const codeStr: string = json.code;
            let buf: Buffer | null = null;
            if (/^[0-9a-fA-F]+$/.test(codeStr)) {
              buf = Buffer.from(codeStr, 'hex');
            } else {
              // assume base64
              buf = Buffer.from(codeStr, 'base64');
            }
            try {
              const cell = loadCellFromBocBuffer(buf);
              console.log('Loaded wallet code from JSON.code at', p);
              return cell;
            } catch (e) {
              // continue
            }
          }
          if (json.codeBoc) {
            const buf = Buffer.from(json.codeBoc, 'base64');
            try {
              const cell = loadCellFromBocBuffer(buf);
              console.log('Loaded wallet code from JSON.codeBoc at', p);
              return cell;
            } catch (e) {
              // continue
            }
          }
          if (json.TVC) {
            // some artifacts embed TVC (base64). Try to parse the TVC as BOC (often works depending on format).
            try {
              const buf = Buffer.from(json.TVC, 'base64');
              const cell = loadCellFromBocBuffer(buf);
              console.log('Loaded wallet code from JSON.TVC at', p);
              return cell;
            } catch (e) {
              // TVC may not be raw cell BOC; continue to other candidates
            }
          }
          // If JSON contained nested artifact shape, try to inspect top-level keys and search for any base64-looking value
          const keys = Object.keys(json);
          for (const k of keys) {
            const v = json[k];
            if (typeof v === 'string' && v.length > 100) {
              // try base64 decode
              try {
                const buf = Buffer.from(v, 'base64');
                const cell = loadCellFromBocBuffer(buf);
                console.log(`Loaded wallet code from JSON key '${k}' at ${p}`);
                return cell;
              } catch {
                // ignore
              }
            }
          }
        }

        if (ext === '.tvc') {
          // attempt to parse TVC file as BOC (some toolchains produce a parseable format)
          try {
            const buf = fs.readFileSync(p);
            const cell = loadCellFromBocBuffer(buf);
            console.log('Loaded wallet code cell from TVC-like file:', p);
            return cell;
          } catch (e) {
            console.warn('Found .tvc file but could not parse as cell BOC:', p);
            // continue
          }
        }

        // Generic attempt: try reading file bytes and parse them as BOC
        try {
          const buf = fs.readFileSync(p);
          const cell = loadCellFromBocBuffer(buf);
          console.log('Loaded wallet code by generic BOC parse from', p);
          return cell;
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Failed to inspect candidate path', p, ':', (err as Error).message);
    }
  }

  console.warn('No wallet code cell could be discovered automatically. Tried paths:', candidatePaths);
  return null;
}

/**
 * Build mint payload cell and return base64-encoded BOC
 * Layout (must match on-chain contract):
 *  - uint32 opcode = 0x23
 *  - uint128 amount
 *  - address (recipient wallet address)
 */
function buildMintPayloadBase64(amountBn: bigint, recipientWalletAddr: Address): string {
  const b = beginCell();
  b.storeUint(0x23, 32);
  b.storeUint(amountBn, 128);
  b.storeAddress(recipientWalletAddr);
  const c = b.endCell();
  return c.toBoc().toString('base64');
}

/**
 * Compute deterministic jetton wallet address using wallet code cell and data layout:
 * data cell = [ owner_address ; master_address ]
 * (This must match the wallet contract's constructor/data encoding.)
 */
function computeJettonWalletAddress(masterAddr: Address, ownerAddr: Address, walletCode: Cell): Address {
  const db = beginCell();
  db.storeAddress(ownerAddr);
  db.storeAddress(masterAddr);
  const dataCell = db.endCell();
  const addr = contractAddress(0, { code: walletCode, data: dataCell });
  return addr;
}

// Attempt to discover wallet code at startup
walletCodeCell = discoverAndLoadWalletCodeCell();
if (!walletCodeCell) {
  console.warn('Wallet code cell not loaded at startup. You can provide it later by placing a supported artifact in artifacts/ or by setting WALLET_CODE_PATH env var.');
} else {
  console.log('Wallet code cell loaded successfully.');
}

// POST /api/build-mint
app.post('/api/build-mint', async (req, res) => {
  try {
    if (!MINTER_ADDRESS) return res.status(500).json({ error: 'Server misconfigured: MINTER_ADDRESS env var is not set' });

    const { recipientOwner, amount } = req.body ?? {};
    if (!recipientOwner || !amount) {
      return res.status(400).json({ error: 'Missing required fields: recipientOwner, amount' });
    }

    // Load wallet code lazily if not available
    if (!walletCodeCell) {
      walletCodeCell = discoverAndLoadWalletCodeCell();
      if (!walletCodeCell) {
        return res.status(500).json({ error: 'Wallet code cell not available on server. Place artifacts/jetton_wallet.cell.boc or set WALLET_CODE_PATH.' });
      }
    }

    // Validate addresses and amount
    let ownerAddress: Address;
    try {
      ownerAddress = Address.parse(recipientOwner);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid recipientOwner address format' });
    }

    let amountBn: bigint;
    try {
      // Accept numeric string or number
      if (typeof amount === 'string' && amount.trim() === '') throw new Error('empty');
      amountBn = BigInt(amount);
      if (amountBn < BigInt(0)) throw new Error('negative');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid amount; provide positive integer string or number' });
    }

    // Enforce a sensible cap to avoid accidental huge payloads (configurable via MAX_MINT_AMOUNT)
    if (amountBn > MAX_MINT_AMOUNT) {
      return res.status(400).json({ error: `Amount exceeds server cap (${MAX_MINT_AMOUNT.toString()})` });
    }

    const masterAddress = Address.parse(MINTER_ADDRESS);

    // Compute wallet address deterministically
    const recipientWalletAddr = computeJettonWalletAddress(masterAddress, ownerAddress, walletCodeCell);

    // Build payload
    const payloadBase64 = buildMintPayloadBase64(amountBn, recipientWalletAddr);

    // Prepare message skeleton
    const message = {
      to: MINTER_ADDRESS,
      value: DEFAULT_MSG_VALUE, // front-end can adjust this after gas profiling
      data: { payload: payloadBase64 }
    };

    return res.json({
      payloadBase64,
      recipientWalletAddress: recipientWalletAddr.toString(),
      message
    });
  } catch (err: any) {
    console.error('Error in /api/build-mint:', err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
});

// Health check
app.get('/ping', (_req, res) => {
  res.json({
    status: 'ok',
    walletCodeLoaded: !!walletCodeCell,
    minterAddressConfigured: !!MINTER_ADDRESS
  });
});

app.listen(PORT, () => {
  console.log(`Mint builder service running on http://localhost:${PORT}`);
  console.log(`MINTER_ADDRESS set: ${!!MINTER_ADDRESS}`);
  if (!walletCodeCell) console.log('Wallet code not loaded yet; place artifacts/jetton_wallet.cell.boc or set WALLET_CODE_PATH and restart.');
});
