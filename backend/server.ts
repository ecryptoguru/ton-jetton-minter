// backend/server.ts
import express from 'express';
import fs from 'fs';
import path from 'path';
import { Address, beginCell, Cell, contractAddress } from '@ton/core';

const app = express();
app.use(express.json());

const walletBocPath = path.join(__dirname, '..', 'artifacts', 'jetton_wallet.cell.boc');
let walletCodeCell: Cell | null = null;


if (fs.existsSync(walletBocPath)) {
const boc = fs.readFileSync(walletBocPath);
const cells = Cell.fromBoc(boc);
walletCodeCell = cells[0];
console.log('Loaded wallet code cell from', walletBocPath);
} else {
console.warn('wallet BOC not found at', walletBocPath);
}


function buildMintPayloadBase64(amountBn: bigint, recipientWalletAddr: Address): string {
const b = beginCell();
b.storeUint(0x23, 32);
b.storeUint(amountBn, 128);
b.storeAddress(recipientWalletAddr);
const c = b.endCell();
const boc = c.toBoc();
return boc.toString('base64');
}


function computeJettonWalletAddress(masterAddr: Address, ownerAddr: Address, walletCode: Cell) {
const db = beginCell();
db.storeAddress(ownerAddr);
db.storeAddress(masterAddr);
const dataCell = db.endCell();
const addr = contractAddress(0, { code: walletCode, data: dataCell });
return addr;
}


app.post('/api/build-mint', (req, res) => {
try {
const { recipientOwner, amount } = req.body;
if (!recipientOwner || !amount) return res.status(400).json({ error: 'missing recipientOwner or amount' });
if (!walletCodeCell) return res.status(500).json({ error: 'wallet code not loaded on server' });
const masterAddrStr = process.env.MINTER_ADDRESS;
if (!masterAddrStr) return res.status(500).json({ error: 'MINTER_ADDRESS not set' });
const ownerAddress = Address.parse(recipientOwner);
const masterAddress = Address.parse(masterAddrStr);
const recipientWalletAddr = computeJettonWalletAddress(masterAddress, ownerAddress, walletCodeCell);
const payloadBase64 = buildMintPayloadBase64(BigInt(amount), recipientWalletAddr);
const message = {
to: masterAddrStr,
value: (1500000).toString(),
data: { payload: payloadBase64 }
};
return res.json({ payloadBase64, recipientWalletAddress: recipientWalletAddr.toString(), message });
} catch (err: any) {
console.error(err);
return res.status(500).json({ error: err.message ?? String(err) });
}
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Mint builder running on ${PORT}`));