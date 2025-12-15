// scripts/deploy.ts
import { toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';
import fs from 'fs';

export async function run(provider: NetworkProvider) {
  const minter = provider.open(JettonMinter.createFromConfig({}, await compile('JettonMinter')));

  console.log('Deploying Jetton Minter...');
  await minter.sendDeploy(provider.sender(), toNano('0.05'));

  await provider.waitForDeploy(minter.address);

  console.log('Minter deployed at:', minter.address.toString());
  fs.writeFileSync('deployed.json', JSON.stringify({ minter: minter.address.toString() }, null, 2));
}

