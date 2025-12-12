// contracts/jetton_minter.tolk
module JettonMinter

type Address = b256
type UInt128 = u128

// Storage
struct Storage {
  owner: Address,
  jetton_code_hash: b256,   // reference to wallet code (or store the code)
  total_minted: UInt128,
  mintable: bool
}

// Messages the contract accepts
enum AllowedMessage =
  | DeployWallet { owner: Address }
  | Mint { to: Address, amount: UInt128 }
  | BurnNotify { from: Address, amount: UInt128 }
  | SetTrusted { addr: Address }

// Main handlers
from func on_message(msg: AllowedMessage, ctx: Context) -> () {
  match msg {
    DeployWallet { owner } => {
      // compose wallet stateInit and send deploy message
      let wallet_state = ContractState { code: self.storage.jetton_code_hash, data: ... }
      send_deploy_message(owner, wallet_state)
    }
    Mint { to, amount } => {
      ensure(self.storage.mintable, "Not mintable");
      self.storage.total_minted = self.storage.total_minted + amount;
      // send mint call to wallet or transfer tokens
      call_wallet_mint(to, amount);
    }
    BurnNotify { from, amount } => {
      // handle burn events
      self.storage.total_minted = self.storage.total_minted - amount;
    }
    SetTrusted { addr } => {
      require(ctx.caller == self.storage.owner, "Only owner");
      // set trusted addresses, etc.
    }
  }
}
