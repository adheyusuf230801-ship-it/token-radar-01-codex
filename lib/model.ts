// Northstar's conditional capital model. Names never enter selection or valuation.
export interface Protocol {
  slug: string; name: string; category: string | null; chains: string[];
  tvl_usd: number; change_7d: number | null; mcap_usd: number | null;
  listed_at: string | null; gecko_id: string | null; symbol: string | null;
}
export interface Snapshot {
  as_of: string; source: string; floor_usd: number; protocols: Protocol[]; watchlist: string[];
}
const lexical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
export function parseSnapshot(text: string): Snapshot {
  const s = JSON.parse(text) as Snapshot;
  if (!s || !Array.isArray(s.protocols) || !Array.isArray(s.watchlist) || !Number.isFinite(Date.parse(s.as_of))) throw new Error('Invalid sealed snapshot');
  const seen = new Set<string>();
  for (const p of s.protocols) {
    if (!p.slug || seen.has(p.slug) || !p.name || !Number.isSafeInteger(p.tvl_usd) || p.tvl_usd < 0 || !Array.isArray(p.chains)) throw new Error('Invalid protocol record');
    seen.add(p.slug);
  }
  if (s.watchlist.some(slug => !seen.has(slug))) throw new Error('Unknown watchlist slug');
  return s;
}
export function recordsNoToken(p: Protocol): boolean {
  return p.gecko_id === null && p.symbol === null && p.mcap_usd === null;
}
export function trackingAge(p: Protocol, s: Snapshot): number | null {
  const start = p.listed_at === null ? NaN : Date.parse(p.listed_at + 'T00:00:00Z');
  return Number.isFinite(start) ? Math.max(0, Math.floor((Date.parse(s.as_of + 'T00:00:00Z') - start) / 86400000)) : null;
}
export function valueModel(p: Protocol, age: number | null) {
  const growth = clamp(p.change_7d ?? 0, -60, 120);
  const momentum = 1 + growth / 200;
  const maturity = 0.7 + 0.3 * Math.sqrt(Math.min(age ?? 365, 1460) / 1460);
  // Breadth is a deliberately small adjustment: +1% per extra chain, capped at +6%.
  // Category affects the farm action only; it contributes no valuation premium.
  const breadth = 1 + Math.min(6, Math.max(0, new Set(p.chains).size - 1)) / 100;
  const base = p.tvl_usd * 0.32;
  return { base_multiple: 0.32, base_usd: base, growth_clamped: growth, momentum, maturity, breadth,
    effective_age_days: age ?? 365, implied_value_usd: Math.max(1, Math.round(base * momentum * maturity * breadth)) };
}
export function farmPlan(p: Protocol, age: number | null): string[] {
  const chain = [...p.chains].sort(lexical)[0] ?? 'a supported chain';
  const c = (p.category ?? '').toLowerCase();
  const capital = p.tvl_usd >= 100_000_000 ? 100 : 50;
  const hold = (age ?? 365) < 180 ? 28 : 14;
  let action = 'Inspect the product and identify its smallest reversible user action. If access or a withdrawal route cannot be verified, stop before funding';
  if (/lend|cdp|collateral/.test(c)) action = 'If a supply market is available, supply an accepted asset without borrowing. Check collateral rules, withdrawal liquidity and the approval amount before confirming';
  else if (/dex/.test(c)) action = 'If spot swaps are available, quote a $10 swap between liquid assets, cap slippage at 0.5%, and execute only if the total fee is below $2. Avoid leverage and unnecessary round trips';
  else if (/bridge/.test(c)) action = 'If a route is available, quote a $10 bridge transfer to a chain you can exit from. Compare the received amount and return-route fee before sending; stop if either route is unclear';
  else if (/staking|restak/.test(c)) action = 'If staking is available, read the lock and redemption queue first, then stake the minimum accepted asset amount. Record receipt units and the unbonding procedure';
  else if (/yield|vault|allocator|rwa/.test(c)) action = 'If an eligible vault is available, inspect its underlying assets, access restrictions and redemption queue. Deposit only the minimum accepted amount and record the shares received';
  else if (/derivative|perpetual|options/.test(c)) action = 'Inspect the collateral and liquidation rules in the trading interface. Use a simulation first; if a small unlevered position is unavailable, skip trading rather than force volume';
  else if (/stable/.test(c)) action = 'If minting or redemption is available, compare its fee and collateral requirements. Test the minimum mint and redemption with accepted assets only, without borrowing';
  return [
    `Verify ${p.name}'s official app and documentation independently, then confirm ${chain} support and eligibility. The snapshot supplies no app URL or reward rules. Cost: $0. Time: 15 minutes.`,
    `Prepare a separate wallet on ${chain}; cap the experiment at $${capital} of capital and $15 total fees. Quote gas before funding and skip if the budget is exceeded. Cost: up to $${capital} capital plus $5 funding fees. Time: 10 minutes.`,
    `${action}. Cost: at most $${capital} exposed capital plus $2 transaction fees; capital can be lost. Time: 15–25 minutes.`,
    `Record transaction hashes, asset units and exit fees; inspect the position twice over ${hold} days. Repeat an action only for actual product use, never to manufacture activity. Cost: $0 to inspect; capital remains exposed. Time: 5 minutes per review over ${hold} days.`,
    `Test withdrawal of a small portion, then unwind the rest if the product or fee budget no longer fits. Check and revoke unused approvals. Read any published reward terms before a claim; no eligibility is assumed. Cost: reserve $8 for exit and revocation. Time: 15 minutes plus any disclosed redemption queue.`
  ];
}
export function buildRadar(s: Snapshot) {
  const watch = new Set(s.watchlist);
  const early = s.protocols.filter(p => recordsNoToken(p) && !watch.has(p.slug) && p.tvl_usd < s.floor_usd)
    .sort((a,b) => b.tvl_usd - a.tvl_usd || lexical(a.slug,b.slug)).slice(0,160);
  const selected = [...s.protocols.filter(p => watch.has(p.slug)), ...early];
  if (selected.some(p => !recordsNoToken(p))) throw new Error('Watchlist contains a token record');
  const board = selected.map(p => {
    const age = trackingAge(p,s), model = valueModel(p,age);
    // Emit durations only: no source dates or fetch timestamps enter the outputs.
    return { rank: 0, slug: p.slug, name: p.name, category: p.category ?? 'Unclassified', chains: [...p.chains].sort(lexical),
      tvl_usd: p.tvl_usd, change_7d: p.change_7d, age_days: age, watchlist: watch.has(p.slug),
      implied_value_usd: model.implied_value_usd, model, farm_steps: farmPlan(p,age) };
  }).sort((a,b) => b.implied_value_usd - a.implied_value_usd || lexical(a.slug,b.slug));
  board.forEach((r,i) => r.rank = i+1);
  const live = s.protocols.filter(p => !recordsNoToken(p)).map(p => ({ slug:p.slug, name:p.name, category:p.category ?? 'Unclassified',
    chains:[...p.chains].sort(lexical), tvl_usd:p.tvl_usd, mcap_usd:p.mcap_usd, symbol:p.symbol }))
    .sort((a,b) => (b.mcap_usd ?? -1) - (a.mcap_usd ?? -1) || lexical(a.slug,b.slug));
  return { board, radar: { rows:board, live, early_size:early.length, live_size:live.length, watchlist_size:watch.size,
    floor_usd:s.floor_usd, model_version:'Northstar / 01' } };
}
type Board = ReturnType<typeof buildRadar>['board'];
export function boardIssue(rows: Board, s: Snapshot): string | null {
  if (rows.length < 100 || rows.length > 4000) return 'Row count outside gate';
  const known = new Set(s.protocols.map(p => p.slug)), seen = new Set<string>();
  for (const [i,r] of rows.entries()) {
    if (!known.has(r.slug) || seen.has(r.slug)) return 'Invalid or duplicate slug';
    seen.add(r.slug);
    if (r.rank !== i+1 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) return 'Invalid rank or value';
    if (i && rows[i-1].implied_value_usd < r.implied_value_usd) return 'Value ordering failed';
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12 || r.farm_steps.some(t => t.trim().length < 20 || t.trim().length > 600)) return 'Invalid farm plan';
  }
  if (s.watchlist.some(slug => !seen.has(slug))) return 'Watchlist missing';
  if (new Set(rows.map(r => r.implied_value_usd)).size < 2) return 'Flat valuation';
  return null;
}
export function dataScript(radar: ReturnType<typeof buildRadar>['radar']): string {
  return 'window.RADAR=' + JSON.stringify(radar).replace(/</g, '\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029') + ';\n';
}
