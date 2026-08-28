/** LayerZero TYPE_3 executor lzReceive option. Empty extraOptions on-chain also default to 200k gas. */
export function lzExecutorLzReceiveOption(gas = 200_000n, value = 0n): `0x${string}` {
  const gasHex = gas.toString(16).padStart(32, "0");
  const option = value === 0n ? `01${gasHex}` : `01${gasHex}${value.toString(16).padStart(32, "0")}`;
  const size = (option.length / 2).toString(16).padStart(4, "0");
  return `0x0003${"01"}${size}${option}`;
}
