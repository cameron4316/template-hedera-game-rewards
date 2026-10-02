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

/**
 * How `account` can receive `tokenId`: already `associated`; `auto`-associated on first receipt (unlimited slots,
 * costs extra gas, see GAS.autoAssociation); or `none`, so it must associate first. Accounts with a limited number
 * of slots count as `none`, because the mirror node does not report how many are free.
 */
export async function tokenRelationship(network: NetworkName, account: string, tokenId: string) {
  const { tokens } = await mirrorGet<{ tokens: unknown[] }>(network, `/accounts/${account}/tokens?token.id=${tokenId}`);
  if (tokens.length > 0) return "associated";
  const info = await mirrorGet<MirrorAccount>(network, `/accounts/${account}`);
  return info.max_automatic_token_associations === -1 ? "auto" : "none";
}
