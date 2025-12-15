import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { JettonMinter } from '../wrappers/JettonMinter';
import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from '@jest/globals';

/**
 * Load wallet code cell from compiled artifact
 */
function loadWalletCodeCell(): Cell {
  const compiled = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '..', 'build', 'JettonMinter.compiled.json'),
      'utf8'
    )
  );
  return Cell.fromBoc(Buffer.from(compiled.hex, 'hex'))[0];
}

describe('JettonMinter (Sandbox)', () => {
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let user: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<JettonMinter>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();

    deployer = await blockchain.treasury('deployer');
    user = await blockchain.treasury('user');

    const walletCode = loadWalletCodeCell();

    minter = blockchain.openContract(
      JettonMinter.createFromConfig(
        {
          owner: deployer.address,
          wallet_code: walletCode,
          total_supply: 0n,
          mintable: true,
        },
        walletCode
      )
    );

    await minter.sendDeploy(deployer.getSender(), toNano('0.05'));
  });

  it('deploys JettonMinter', async () => {
    expect(minter.address).toBeInstanceOf(Address);
  });
});
