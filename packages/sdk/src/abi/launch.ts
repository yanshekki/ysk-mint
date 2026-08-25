export const tokenFactoryAbi = [
  {
    type: "function",
    name: "createToken",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "decimals", type: "uint8" },
          { name: "totalSupply", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "supplyMode", type: "uint8" },
          { name: "moduleFlags", type: "uint16" },
        ],
      },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
  {
    type: "function",
    name: "predictToken",
    stateMutability: "view",
    inputs: [{ name: "salt", type: "bytes32" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "Launch",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "deployer", type: "address", indexed: true },
      { name: "salt", type: "bytes32", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "supplyMode", type: "uint8", indexed: false },
    ],
  },
] as const;

export const yskOftAbi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "v", type: "uint256" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "setPeer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eid", type: "uint32" },
      { name: "peer", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "peers",
    stateMutability: "view",
    inputs: [{ name: "eid", type: "uint32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "quoteSend",
    stateMutability: "view",
    inputs: [
      {
        name: "sendParam",
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      { name: "payInLzToken", type: "bool" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "send",
    stateMutability: "payable",
    inputs: [
      {
        name: "sendParam",
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      {
        name: "fee",
        type: "tuple",
        components: [
          { name: "nativeFee", type: "uint256" },
          { name: "lzTokenFee", type: "uint256" },
        ],
      },
      { name: "refundAddress", type: "address" },
    ],
    outputs: [],
  },
] as const;

export const liquidityManagerAbi = [
  {
    type: "function",
    name: "addAndLock",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "router", type: "address" },
      { name: "tokenAmount", type: "uint256" },
      { name: "amountTokenMin", type: "uint256" },
      { name: "amountETHMin", type: "uint256" },
      { name: "lockMode", type: "uint8" },
      { name: "lockDuration", type: "uint64" },
    ],
    outputs: [
      { name: "lockId", type: "uint256" },
      { name: "liquidity", type: "uint256" },
      { name: "lpToken", type: "address" },
    ],
  },
  {
    type: "event",
    name: "LiquidityLaunched",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "lpToken", type: "address", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "liquidity", type: "uint256", indexed: false },
      { name: "lockId", type: "uint256", indexed: false },
    ],
  },
] as const;

export const liquidityLockerAbi = [
  {
    type: "function",
    name: "getLock",
    stateMutability: "view",
    inputs: [{ name: "lockId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "token", type: "address" },
          { name: "owner", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "unlockAt", type: "uint64" },
          { name: "mode", type: "uint8" },
          { name: "withdrawn", type: "bool" },
        ],
      },
    ],
  },
] as const;
