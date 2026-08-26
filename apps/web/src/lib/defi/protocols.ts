import { VENUES } from "../dexVenues.ts";
import { minswapProtocol } from "./ada/minswap.ts";
import { makeAero } from "./evm/aerodrome.ts";
import { makeV2 } from "./evm/univ2.ts";
import { makeV3 } from "./evm/univ3.ts";
import { nearRefProtocol } from "./near/ref.ts";
import { register } from "./registry.ts";
import { jupiterProtocol } from "./sol/jupiter.ts";

let ready = false;

export function ensureProtocols() {
  if (ready) return;
  ready = true;
  for (const v of VENUES) {
    if (v.kind === "v2") register(makeV2(v));
    else if (v.kind === "aero") register(makeAero(v));
    else register(makeV3(v));
  }
  register(nearRefProtocol);
  register(minswapProtocol);
  register(jupiterProtocol);
}
