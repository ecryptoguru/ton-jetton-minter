import { NetworkProvider } from '@ton/blueprint';
import { Address, Cell, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import fs from 'fs';
import path from 'path';

/**
 * Load JettonWallet code cell from compiled hex
 * (You already validated this hex successfully)
 */
function loadWalletCodeCell(): Cell {
  const compiled = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'build', 'JettonMinter.compiled.json'),
      'utf8'
    )
  );

  if (!compiled.hex) {
    throw new Error('Compiled artifact missing hex field');
  }

  return Cell.fromBoc(Buffer.from(compiled.hex, 'hex'))[0];
}

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();

  ui.write('🚀 Deploying JettonMinter contract...');

  const owner =
    process.env.MINTER_OWNER_ADDRESS
      ? Address.parse(process.env.MINTER_OWNER_ADDRESS)
      : provider.sender().address!;

  ui.write(`Owner address: ${owner.toString()}`);

  const walletCode = loadWalletCodeCell();

  const minter = provider.open(
    JettonMinter.createFromConfig(
      {
        owner,
        wallet_code: walletCode,
        total_supply: 0n,
        mintable: true,
      },
      walletCode
    )
  );

  await minter.sendDeploy(provider.sender(), toNano('0.05'));

  await provider.waitForDeploy(minter.address);

  ui.write(`✅ JettonMinter deployed at: ${minter.address.toString()}`);

  // Save address for backend/frontend
  fs.writeFileSync(
    path.join(process.cwd(), 'deployed.json'),
    JSON.stringify(
      {
        minter: minter.address.toString(),
        network: provider.network(),
      },
      null,
      2
    )
  );

  ui.write('📄 deployed.json written');
}
