// jetton_wallet.tolk
tolk 1.2

type UInt128 = uint128

// Storage holds owner (the user or address that controls this wallet), master (minter) and balance
struct Storage {
  owner: address,
  master: address,
  balance: UInt128
}

fun Storage.load(): Storage {
  return Storage.fromCell(contract.getData());
}

fun Storage.save(self): void {
  contract.setData(self.toCell());
}

fun onInternalMessage(in: InMessage) {
  if (in.body.isEmpty()) {
    return;
  }

  var cs = in.body;
  val opcode = cs.loadUint(32);

  if (opcode == 0x23) {
    val amount = cs.loadUint(128) as UInt128;
    val recipientWallet = cs.loadAddress();

    if (recipientWallet != contract.getAddress()) {
      throw 201;
    }

    var st = Storage.load();
    if (in.senderAddress != st.master) {
      throw 200;
    }
    st.balance = st.balance + amount;
    st.save();

    return;
  }

  return;
}

get fun get_balance(): int {
  val st = lazy Storage.load();
  return st.balance as int;
}
