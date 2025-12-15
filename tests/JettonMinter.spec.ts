// tests/jetton_minter.spec.ts
import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { JettonMinter } from '../wrappers/JettonMinter';

describe('JettonMinter (Sandbox)', () => {
  let code: Cell;
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let minter: SandboxContract<JettonMinter>;

  beforeAll(async () => {
    code = await compile('JettonMinter');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');

    minter = blockchain.openContract(JettonMinter.createFromConfig({}, code));

    const deployResult = await minter.sendDeploy(deployer.getSender(), toNano('0.05'));
    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: minter.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy', async () => {
    // the check is done inside beforeEach
    // blockchain and minter are ready to use
  });
});
