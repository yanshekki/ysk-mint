declare module "*.json" {
  const value: {
    ChainKey: Record<string, number>;
    DexKind: Record<string, number>;
    LockMode: Record<string, number>;
    OwnershipAction: Record<string, number>;
    SupplyMode: Record<string, number>;
    LaunchStep: Record<string, number>;
    LaunchStatus: Record<string, number>;
    ModuleFlag: Record<string, number>;
  };
  export default value;
}
