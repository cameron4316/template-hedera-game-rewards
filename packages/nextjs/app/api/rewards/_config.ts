import deployedContracts from "~~/contracts/deployedContracts";
import type { Hex } from "~~/lib/rewards/claim";
import { readRewardsConfig, resolveNetwork } from "~~/lib/rewards/config";
import { NETWORKS } from "~~/lib/rewards/constants";
import type { GenericContractsDeclaration } from "~~/utils/scaffold-hbar/contract";

/** Attestor config from the root .env plus the RewardVault address that `yarn deploy` writes to deployedContracts.ts. */
export function rewardsConfig() {
  const network = resolveNetwork(process.env);
  const contracts = deployedContracts as GenericContractsDeclaration;
  const vault = network ? contracts[NETWORKS[network].chainId]?.RewardVault?.address : undefined;
  return readRewardsConfig(process.env, vault as Hex | undefined);
}
