// frontend/lib/payload.ts
import { beginCell, Cell, Address, contractAddress } from '@ton/core';

export const MINT_OPCODE = 0x23;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof window === 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

export function buildMintPayloadBOC(amount: bigint, recipientWalletAddress: Address): string {
  const builder = beginCell();
  builder.storeUint(MINT_OPCODE, 32);
  builder.storeUint(amount, 128);
  builder.storeAddress(recipientWalletAddress);
  const cell = builder.endCell();
  const boc = cell.toBoc();
  return bytesToBase64(boc);
}

export function computeJettonWalletAddress(minterMasterAddress: Address, ownerAddress: Address, walletCodeCell: Cell): Address {
  const dataBuilder = beginCell();
  dataBuilder.storeAddress(ownerAddress);
  dataBuilder.storeAddress(minterMasterAddress);
  const dataCell = dataBuilder.endCell();
  const addr = contractAddress(0, { code: walletCodeCell, data: dataCell });
  return addr;
}

export function buildMinterTransactionForTonConnect(minterAddress: string, amount: bigint, recipientWalletAddress: Address, sendFundsValueNano = '1500000'): {
  to: string;
  value: string;
  payload: string;
} {
  const payloadBase64 = buildMintPayloadBOC(amount, recipientWalletAddress);
  return {
    to: minterAddress,
    value: sendFundsValueNano,
    payload: payloadBase64
  };
}