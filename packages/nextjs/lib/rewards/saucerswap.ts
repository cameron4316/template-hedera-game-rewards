/**
 * SaucerSwap V1 (Uniswap V2 style) and HTS fragments, as human-readable ABI usable by ethers and viem's parseAbi.
 * The router exposes two WHBAR addresses: `whbar()` is the WHBAR HTS token used in swap paths and pairs,
 * `WHBAR()` is the wrapper contract. Pools and paths always use `whbar()`.
 */
export const SAUCERSWAP_V1_ROUTER_ABI = [
  "function factory() view returns (address)",
  "function whbar() view returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function addLiquidityETHNewPool(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)",
] as const;

export const SAUCERSWAP_V1_FACTORY_ABI = [
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function pairCreateFee() view returns (uint256)",
] as const;

/** Exchange rate system contract; SaucerSwap prices its pool creation fee in tinycents. */
export const EXCHANGE_RATE_ADDRESS = "0x0000000000000000000000000000000000000168";
export const EXCHANGE_RATE_ABI = [
  "function tinycentsToTinybars(uint256 tinycents) returns (uint256 tinybars)",
] as const;

/** ERC-20 facade every HTS token exposes at its EVM address, plus HIP-719 self-association. */
export const HTS_TOKEN_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function associate() returns (uint256 responseCode)",
] as const;
