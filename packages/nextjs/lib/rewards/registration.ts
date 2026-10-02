import { gameIdHash } from "./attest";
import type { RewardsConfig } from "./config";
import { NETWORKS } from "./constants";
import type { GameDefinition } from "./games/types";
import { REWARD_VAULT_ABI } from "./vault";
import { createPublicClient, http, parseAbi, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Compares the signer the vault has registered for each game with ATTESTOR_PRIVATE_KEY. A mismatch (new attestor
 * key, new vault, unregistered game) would make every claim() revert, so callers report it before signing.
 * Returns one message per problem; empty when every game is registered to this attestor.
 */
export async function registrationProblems(config: RewardsConfig, games: GameDefinition[]) {
  const client = createPublicClient({ transport: http(NETWORKS[config.network].rpcUrl) });
  const attestor = privateKeyToAccount(config.attestorKey).address;
  const abi = parseAbi(REWARD_VAULT_ABI);
  const problems: string[] = [];
  for (const game of games) {
    const [signer] = await client.readContract({
      address: config.vault,
      abi,
      functionName: "games",
      args: [gameIdHash(game.id)],
    });
    if (signer === zeroAddress) {
      problems.push(`Game "${game.id}" is not registered on the vault ${config.vault}. Run yarn deploy.`);
    } else if (signer.toLowerCase() !== attestor.toLowerCase()) {
      problems.push(
        `Game "${game.id}" is registered to signer ${signer}, but ATTESTOR_PRIVATE_KEY is ${attestor}. Run yarn deploy to register the current attestor.`,
      );
    }
  }
  return problems;
}
