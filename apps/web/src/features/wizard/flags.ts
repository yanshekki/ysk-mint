import { ModuleFlag, moduleBit } from "@ysk-mint/sdk";

export function packFlags(w: { modulePause: boolean; moduleMaxTx: boolean; moduleTax: boolean }): number {
  let flags = 0;
  if (w.modulePause) flags |= moduleBit(ModuleFlag.Pause);
  if (w.moduleMaxTx) flags |= moduleBit(ModuleFlag.MaxTx) | moduleBit(ModuleFlag.MaxWallet);
  if (w.moduleTax) flags |= moduleBit(ModuleFlag.BuyTax) | moduleBit(ModuleFlag.SellTax);
  return flags;
}
