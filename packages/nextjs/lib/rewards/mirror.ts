import { NETWORKS, NetworkName } from "./constants";

export const mirrorUrl = (network: NetworkName) => process.env.HEDERA_MIRROR_URL || NETWORKS[network].mirrorUrl;

/**
 * GETs a mirror node REST path (e.g. `/accounts/0.0.5`). `waitMs` keeps retrying 404s for that long, since the
 * mirror node indexes new transactions a few seconds after consensus.
 */
export async function mirrorGet<T>(network: NetworkName, path: string, { waitMs = 0 } = {}): Promise<T> {
  const deadline = Date.now() + waitMs;
  const url = `${mirrorUrl(network)}/api/v1${path}`;
  for (;;) {
    const res = await fetch(url);
    if (res.ok) return (await res.json()) as T;
    if (res.status !== 404 || Date.now() >= deadline) {
      throw new Error(`Mirror node returned ${res.status} for ${url}. Check HEDERA_MIRROR_URL and your network.`);
    }
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
}

export type MirrorAccount = { account: string; evm_address: string; max_automatic_token_associations: number };

export type TokenRelationship = "associated" | "auto" | "none";

/**
 * How `account` holds `tokenId`. `relationship` is `associated`; `auto` (associated on first receipt because the
 * account has unlimited slots, which costs GAS.autoAssociation extra); or `none`, so it must associate first.
 * Accounts with a limited number of slots count as `none`, because the mirror node does not report how many are free.
 */
export async function tokenHolding(network: NetworkName, account: string, tokenId: string) {
  const res = await fetch(`${mirrorUrl(network)}/api/v1/accounts/${account}`);
  if (res.status === 404) {
    throw new Error(
      `${account} has no Hedera ${network} account yet. Send it HBAR from https://portal.hedera.com/faucet.`,
    );
  }
  if (!res.ok) throw new Error(`Mirror node returned ${res.status} for account ${account}. Retry in a moment.`);
  const info = (await res.json()) as MirrorAccount;

  const { tokens } = await mirrorGet<{ tokens: { balance: number }[] }>(
    network,
    `/accounts/${info.account}/tokens?token.id=${tokenId}`,
  );
  const relationship: TokenRelationship =
    tokens.length > 0 ? "associated" : info.max_automatic_token_associations === -1 ? "auto" : "none";
  return { accountId: info.account, relationship, balance: BigInt(tokens[0]?.balance ?? 0) };
}
