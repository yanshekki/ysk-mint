/**
 * Testnet launch + OFT send: Base Sepolia → Arb Sepolia.
 * Usage: TESTNET_PK=0x... node scripts/e2e-testnet-oft.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatEther,
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseUnits,
  stringToBytes,
  pad,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { arbitrumSepolia, baseSepolia } from "viem/chains";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const LZ = "0x6EDCE65403992e310A62460808c4b910D972f10f";
const OPTIONS = "0x00030100110100000000000000000000000000030d40";
const NEED = parseEther("0.02");

function bytecode(sol, name) {
  const json = JSON.parse(readFileSync(join(root, "packages/contracts/out", sol, `${name}.json`), "utf8"));
  return json.bytecode.object;
}

const tokenFactoryAbi = parseAbi([
  "constructor(address endpoint_)",
  "function createToken((string name, string symbol, uint8 decimals, uint256 totalSupply, address owner, uint8 supplyMode, uint16 moduleFlags) params, bytes32 salt) payable returns (address token)",
  "event Launch(address indexed token, address indexed deployer, bytes32 indexed salt, string name, string symbol, uint8 supplyMode)",
]);
const oftAbi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function setPeer(uint32 eid, bytes32 peer)",
  "function peers(uint32 eid) view returns (bytes32)",
  "function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) sendParam, bool payInLzToken) view returns ((uint256 nativeFee, uint256 lzTokenFee))",
  "function send((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd) sendParam, (uint256 nativeFee, uint256 lzTokenFee) fee, address refundAddress) payable",
]);
const lockerAbi = parseAbi(["constructor()"]);
const managerAbi = parseAbi(["constructor(address locker_)"]);

const chains = [
  {
    id: "base",
    chain: baseSepolia,
    rpc: "https://sepolia.base.org",
    eid: 40245,
    explorer: "https://sepolia.basescan.org",
  },
  {
    id: "arb",
    chain: arbitrumSepolia,
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    eid: 40231,
    explorer: "https://sepolia.arbiscan.io",
  },
];

function clients(account, row) {
  const transport = http(row.rpc);
  return {
    public: createPublicClient({ chain: row.chain, transport }),
    wallet: createWalletClient({ account, chain: row.chain, transport }),
  };
}

async function deploy(account, row) {
  const { public: pub, wallet } = clients(account, row);
  const lockerHash = await wallet.deployContract({ abi: lockerAbi, bytecode: bytecode("LiquidityLocker.sol", "LiquidityLocker"), account });
  const locker = (await pub.waitForTransactionReceipt({ hash: lockerHash })).contractAddress;
  const managerHash = await wallet.deployContract({
    abi: managerAbi,
    bytecode: bytecode("LiquidityManager.sol", "LiquidityManager"),
    args: [locker],
    account,
  });
  const manager = (await pub.waitForTransactionReceipt({ hash: managerHash })).contractAddress;
  const factoryHash = await wallet.deployContract({
    abi: tokenFactoryAbi,
    bytecode: bytecode("TokenFactory.sol", "TokenFactory"),
    args: [LZ],
    account,
  });
  const factory = (await pub.waitForTransactionReceipt({ hash: factoryHash })).contractAddress;
  if (!factory) throw new Error(`no factory on ${row.id}`);
  console.log(row.id, "factory", factory, `${row.explorer}/address/${factory}`);
  return { pub, wallet, factory, manager };
}

async function createToken(stack, account, supply) {
  const salt = keccak256(stringToBytes(`${account.address}:E2E:${Date.now()}:${supply}`));
  const params = {
    name: "Ysk E2E",
    symbol: "YSKE2E",
    decimals: 18,
    totalSupply: supply,
    owner: account.address,
    supplyMode: 0,
    moduleFlags: 0,
  };
  const hash = await stack.wallet.writeContract({
    address: stack.factory,
    abi: tokenFactoryAbi,
    functionName: "createToken",
    args: [params, salt],
    account,
  });
  const receipt = await stack.pub.waitForTransactionReceipt({ hash });
  let token;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: tokenFactoryAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Launch") token = ev.args.token;
    } catch {
      /* skip */
    }
  }
  if (!token) throw new Error("Launch event missing");
  return token;
}

async function faucetHint(address) {
  const urls = [
    `https://www.alchemy.com/faucets/base-sepolia`,
    `https://www.alchemy.com/faucets/arbitrum-sepolia`,
    `https://docs.base.org/base-chain/network-information/network-faucets`,
    `https://faucet.quicknode.com/base/sepolia`,
    `https://faucet.quicknode.com/arbitrum/sepolia`,
    `https://bwarelabs.com/faucets`,
  ];
  console.log("fund gas:", address);
  for (const u of urls) console.log(" ", u);
}

async function main() {
  const pk = process.env.TESTNET_PK || generatePrivateKey();
  if (!process.env.TESTNET_PK) {
    writeFileSync("/tmp/ysk-e2e-pk", `${pk}\n`, { mode: 0o600 });
    console.log("wrote key to /tmp/ysk-e2e-pk. Fund the address, then:");
    console.log("TESTNET_PK=$(cat /tmp/ysk-e2e-pk) node apps/web/scripts/e2e-testnet-oft.mjs");
  }
  const account = privateKeyToAccount(pk);
  console.log("account", account.address);

  const bals = [];
  for (const row of chains) {
    const { public: pub } = clients(account, row);
    const bal = await pub.getBalance({ address: account.address });
    bals.push(bal);
    console.log(row.id, "balance", formatEther(bal), "ETH");
  }
  if (bals.some((b) => b < NEED)) {
    await faucetHint(account.address);
    throw new Error("need ≥ 0.02 ETH on Base Sepolia and Arb Sepolia");
  }

  const home = await deploy(account, chains[0]);
  const spoke = await deploy(account, chains[1]);
  const supply = parseUnits("1000000", 18);
  const homeToken = await createToken(home, account, supply);
  const spokeToken = await createToken(spoke, account, 0n);
  console.log("home token", homeToken);
  console.log("spoke token", spokeToken);

  const homeBal = await home.pub.readContract({ address: homeToken, abi: oftAbi, functionName: "balanceOf", args: [account.address] });
  if (homeBal !== supply) throw new Error(`home supply ${homeBal} != ${supply}`);
  console.log("mint ok", formatEther(homeBal));

  await home.pub.waitForTransactionReceipt({
    hash: await home.wallet.writeContract({
      address: homeToken,
      abi: oftAbi,
      functionName: "setPeer",
      args: [chains[1].eid, pad(spokeToken, { size: 32 })],
      account,
    }),
  });
  await spoke.pub.waitForTransactionReceipt({
    hash: await spoke.wallet.writeContract({
      address: spokeToken,
      abi: oftAbi,
      functionName: "setPeer",
      args: [chains[0].eid, pad(homeToken, { size: 32 })],
      account,
    }),
  });
  console.log("peers set");

  const amount = supply / 10n;
  const sendParam = {
    dstEid: chains[1].eid,
    to: pad(account.address, { size: 32 }),
    amountLD: amount,
    minAmountLD: amount,
    extraOptions: OPTIONS,
    composeMsg: "0x",
    oftCmd: "0x",
  };
  const fee = await home.pub.readContract({
    address: homeToken,
    abi: oftAbi,
    functionName: "quoteSend",
    args: [sendParam, false],
  });
  console.log("quote nativeFee", formatEther(fee.nativeFee));
  if (fee.nativeFee === 0n) throw new Error("quoteSend returned 0 — not a live LZ quote");

  const sendHash = await home.wallet.writeContract({
    address: homeToken,
    abi: oftAbi,
    functionName: "send",
    args: [sendParam, fee, account.address],
    value: fee.nativeFee,
    account,
  });
  await home.pub.waitForTransactionReceipt({ hash: sendHash });
  console.log("sent", `${chains[0].explorer}/tx/${sendHash}`);

  const afterSrc = await home.pub.readContract({ address: homeToken, abi: oftAbi, functionName: "balanceOf", args: [account.address] });
  if (afterSrc !== supply - amount) throw new Error(`src not burned: ${afterSrc}`);

  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const dest = await spoke.pub.readContract({ address: spokeToken, abi: oftAbi, functionName: "balanceOf", args: [account.address] });
    console.log("dest balance", formatEther(dest));
    if (dest === amount) {
      console.log("OFT receive ok");
      return;
    }
    await new Promise((r) => setTimeout(r, 20_000));
  }
  throw new Error("dest did not mint within 15m");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
