// jetton_wallet.tolk
module JettonWallet

import std::cell
import std::msg
import std::tvm
import std::slice

type Address = b256
type UInt128 = u128
type Cell = cell

// Storage holds owner (the user or address that controls this wallet), master (minter) and balance
struct Storage {
  owner: Address,
  master: Address,
  balance: UInt128
}

// Constructor: wallet data must be (owner, master) in that order in stateInit data.
constructor(owner: Address, master: Address) {
  self.storage = Storage {
    owner: owner,
    master: master,
    balance: 0u128
  }
}

// Helper to assert caller is owner (if needed for outgoing transfers)
priv func require_owner(ctx: Context) -> () {
  if ctx.caller != self.storage.owner {
    tvm::revert(200, "Not owner")
  }
}

// Public view: get balance
pub func get_balance() -> UInt128 {
  return self.storage.balance;
}

// Handler for internal messages with payloads
// We parse the payload cell and if opcode == 0x23, interpret as mint(payload)
receive(payload: Cell, ctx: Context) {
  // if no payload, do nothing
  if payload.is_empty() {
    return;
  }

  // read payload header (uint32 opcode)
  let cell_slice = payload.as_slice();
  let opcode = cell_slice.load_uint(32);

  if opcode == 0x23u32 {
    // Mint opcode
    // Next field: uint128 amount
    let amount = cell_slice.load_uint_u128(128);
    // Next field: recipient_wallet address (256-bit)
    let recipient_wallet = cell_slice.load_address();

    // For safety: ensure recipient_wallet equals the address of THIS wallet.
    // If it does not, we still allow crediting the recipient address only if business logic allows it.
    let self_addr = self.address();
    if recipient_wallet != self_addr {
      // In strict flow, reject or forward — here we simply reject to avoid mis-crediting
      tvm::revert(201, "Recipient mismatch");
    }

    // Credit the balance
    self.storage.balance = self.storage.balance + amount;

    // Optionally: emit or send a small internal message back to master to acknowledge mint (not required)
    // e.g., send a log or call
    // msg::send(self.storage.master, 0u64, 0u64, <optional payload>)

    return;
  } else {
    // Unknown opcode: ignore or revert depending on policy
    // Accept other wallet operations here (transfer out) if you extend the wallet
    return;
  }
}
