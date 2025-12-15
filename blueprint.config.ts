import type { Config } from '@ton/blueprint';

export const config: Config = {
  network: {
    type: 'testnet',
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    version: 'v2',
  },
};
