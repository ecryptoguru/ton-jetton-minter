// Jetton Minter Contract

// Error codes
const ERR_NOT_OWNER = 100;
const ERR_NOT_MINTABLE = 101;
const ERR_NOT_TRUSTED = 102;

struct Storage {
  ownerAddress: address;
  walletCode: cell;
  totalMinted: uint128;
  mintable: bool;
  trusted: map<address, bool>;
}

fun Storage.load(): Storage {
  return Storage.fromCell(contract.getData());
}

fun Storage.save(self) {
  contract.setData(self.toCell());
}

struct (0x00000001) DeployWallet {
  owner: address;
}

struct (0x00000002) Mint {
  to: address;
  amount: uint128;
}

struct (0x00000003) BurnNotify {
  from: address;
  amount: uint128;
}

struct (0x00000004) SetTrusted {
  addr: address;
  trusted: bool;
}

type AllowedMessage = DeployWallet | Mint | BurnNotify | SetTrusted;

fun onInternalMessage(in: InMessage) {
  if (in.body.isEmpty()) {
    return;
  }

  val msg = lazy AllowedMessage.fromSlice(in.body);

  match (msg) {
    DeployWallet => {
      val storage = lazy Storage.load();
      assert(in.senderAddress == storage.ownerAddress) throw ERR_NOT_OWNER;
      return;
    }
    Mint => {
      var storage = lazy Storage.load();
      assert(in.senderAddress == storage.ownerAddress) throw ERR_NOT_OWNER;
      assert(storage.mintable) throw ERR_NOT_MINTABLE;
      storage.totalMinted += msg.amount;
      storage.save();
      // Deploy wallet if needed and send tokens
      // (Implementation depends on your wallet contract)
      // ...
      return;
    }
    BurnNotify => {
      var storage = lazy Storage.load();
      val lookup = storage.trusted.get(in.senderAddress);
      val isTrusted = lookup.isFound ? lookup.loadValue() : false;
      assert(isTrusted) throw ERR_NOT_TRUSTED;
      storage.totalMinted -= msg.amount;
      storage.save();
      return;
    }
    SetTrusted => {
      var storage = lazy Storage.load();
      assert(in.senderAddress == storage.ownerAddress) throw ERR_NOT_OWNER;
      storage.trusted.set(msg.addr, msg.trusted);
      storage.save();
      return;
    }
    else => {
      assert(in.body.isEmpty()) throw 0xFFFF;
    }
  }
}

get fun totalSupply(): int {
  val storage = lazy Storage.load();
  return storage.totalMinted;
}

get fun getOwner(): address {
  val storage = lazy Storage.load();
  return storage.ownerAddress;
}

get fun getWalletCode(): cell {
  val storage = lazy Storage.load();
  return storage.walletCode;
}

get fun isMintable(): bool {
  val storage = lazy Storage.load();
  return storage.mintable;
}

get fun isTrusted(addr: address): bool {
  val storage = lazy Storage.load();
  val lookup = storage.trusted.get(addr);
  return lookup.isFound ? lookup.loadValue() : false;
}
