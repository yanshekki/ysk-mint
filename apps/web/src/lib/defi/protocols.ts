import { VENUES } from "../dexVenues.ts";
import { minswapProtocol } from "./ada/minswap.ts";
import { makeAero } from "./evm/aerodrome.ts";
import { ALGEBRA_VENUES, makeAlgebra } from "./evm/algebra.ts";
import { BALANCER_CHAINS, makeBalancer } from "./evm/balancer.ts";
import { CURVE_CHAINS, makeCurve } from "./evm/curve.ts";
import { makeSync, SYNCSWAP_VENUES } from "./evm/syncswap.ts";
import { makeV2 } from "./evm/univ2.ts";
import { makeV3 } from "./evm/univ3.ts";
import { nearRefProtocol } from "./near/ref.ts";
import { register } from "./registry.ts";
import { meteoraProtocol, orcaProtocol, raydiumProtocol } from "./sol/amm.ts";
import { jupiterProtocol } from "./sol/jupiter.ts";
import { cetusProtocol } from "./sui/cetus.ts";

let ready = false;

export function ensureProtocols() {
  if (ready) return;
  ready = true;
  for (const v of VENUES) {
    if (v.kind === "v2") register(makeV2(v));
    else if (v.kind === "aero") register(makeAero(v));
    else register(makeV3(v));
  }
  for (const id of CURVE_CHAINS) register(makeCurve(id));
  for (const id of BALANCER_CHAINS) register(makeBalancer(id));
  for (const v of ALGEBRA_VENUES) register(makeAlgebra(v));
  for (const v of SYNCSWAP_VENUES) register(makeSync(v));
  register(nearRefProtocol);
  register(minswapProtocol);
  register(jupiterProtocol);
  register(raydiumProtocol);
  register(orcaProtocol);
  register(meteoraProtocol);
  register(cetusProtocol);
}
