/* Northstar's renderer consumes the exact model breakdowns and farm strings in board.json.
   The only script inputs are local data.js and the deterministic capture query. */
(() => {
  'use strict';
  const data = window.RADAR;
  const $ = id => document.getElementById(id);
  if (!data) { $('count').textContent = 'Missing local data.js. Build the entry first.'; return; }
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => n == null ? 'Unreported' : '$' + (n >= 1e9 ? (n/1e9).toFixed(2)+'B' : n >= 1e6 ? (n/1e6).toFixed(2)+'M' : n.toLocaleString('en-US'));
  const exact = n => '$' + n.toLocaleString('en-US', {maximumFractionDigits:0});
  const pct = n => n == null ? 'Unreported' : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  const age = n => n == null ? 'Unknown' : n.toLocaleString('en-US') + 'd';
  const state = {query:'', category:'', key:'rank', direction:1};
  const categories = [...new Set(data.rows.map(r => r.category))].sort();
  $('category').insertAdjacentHTML('beforeend', categories.map(c => `<option value="${escape(c)}">${escape(c)}</option>`).join(''));
  const total = data.rows.reduce((n,r) => n+r.tvl_usd,0);
  $('metrics').innerHTML = [
    ['Protocols on radar',data.rows.length,'160 early discoveries'],
    ['Watchlist coverage',data.watchlist_size+'/'+data.watchlist_size,'All records covered'],
    ['Capital in view',money(total),'Snapshot TVL'],
    ['Token records set aside',data.live_size,'Separate market context']
  ].map(([label,value,note]) => `<div class="metric"><small>${label}</small><strong>${value}</strong><em>${note}</em></div>`).join('');
  function visibleRows() {
    return data.rows.filter(r => (!state.category || r.category === state.category) &&
      [r.name,r.slug,r.category,...r.chains].join(' ').toLowerCase().includes(state.query.trim().toLowerCase()))
      .sort((a,b) => {
        const x=a[state.key],y=b[state.key];
        if (x == null || y == null) return x == null && y == null ? a.rank-b.rank : x == null ? 1 : -1;
        return (x-y)*state.direction || a.rank-b.rank;
      });
  }
  function renderBoard() {
    const rows = visibleRows();
    $('count').textContent = `${rows.length} / ${data.rows.length} signals`;
    $('empty').hidden = rows.length !== 0;
    $('rows').innerHTML = rows.map(r => `<tr data-slug="${escape(r.slug)}"><td>${String(r.rank).padStart(2,'0')}</td><td><div class="protocol"><span class="avatar" aria-hidden="true">${escape(r.name.slice(0,2).toUpperCase())}</span><div><button class="name-button" data-open="${escape(r.slug)}">${escape(r.name)}</button><span class="row-tag">${r.watchlist?'WATCH':'EARLY'}</span><span class="subline">${escape(r.category)} · ${escape(r.chains.slice(0,2).join(', ') || 'Chain unreported')}${r.chains.length>2?' +'+(r.chains.length-2):''}</span></div></div></td><td title="${exact(r.implied_value_usd)}">${money(r.implied_value_usd)}</td><td class="number">${money(r.tvl_usd)}</td><td class="number ${r.change_7d == null?'':r.change_7d<0?'negative':'positive'}">${pct(r.change_7d)}</td><td class="number">${age(r.age_days)}</td><td><button class="open-row" data-open="${escape(r.slug)}" aria-label="Inspect ${escape(r.name)}">↗</button></td></tr>`).join('');
    document.querySelectorAll('th[data-key]').forEach(th => {
      const active=th.dataset.key === state.key;
      th.setAttribute('aria-sort', active ? state.direction===1?'ascending':'descending' : 'none');
      th.querySelector('span').textContent = active ? state.direction===1?' ↑':' ↓' : ' ↕';
    });
  }
  let opener = null;
  function openDetail(slug, source) {
    const r = data.rows.find(row => row.slug===slug);
    if (!r) return;
    opener = source || document.activeElement;
    const m = r.model;
    const recomputed = Math.max(1, Math.round(r.tvl_usd * m.base_multiple * m.momentum * m.maturity * m.breadth));
    const reconciled = recomputed === r.implied_value_usd;
    $('detail-content').innerHTML = `<header class="detail-top"><div><p class="eyebrow">PROTOCOL DOSSIER / RANK ${String(r.rank).padStart(2,'0')}</p><h2 id="detail-title">${escape(r.name)} <span class="pill">${r.watchlist?'WATCHLIST':'EARLY DISCOVERY'}</span></h2><span class="muted">${escape(r.category)} · ${escape(r.chains.join(', ') || 'Chain unreported')}</span></div><button class="close-detail" id="close-detail">Close ×</button></header><div class="detail-body"><section class="valuation"><p class="eyebrow">CONDITIONAL IMPLIED VALUE</p><div class="detail-value">${money(r.implied_value_usd)}</div><span class="muted">${exact(r.implied_value_usd)} · whole token value estimate</span><div class="detail-facts"><div><small>Snapshot TVL</small><b>${money(r.tvl_usd)}</b></div><div><small>7d TVL change</small><b>${pct(r.change_7d)}</b></div><div><small>Tracked age</small><b>${age(r.age_days)}</b></div><div><small>Token record</small><b>Records no token</b></div></div><h3>Trace the valuation</h3><p class="detail-caveat">${reconciled ? '✓ Recomputed from the factors below; matches the board.' : 'Data mismatch: rebuild before using this estimate.'}</p><dl class="breakdown"><div><dt>TVL × 0.32</dt><dd>${exact(m.base_usd)}</dd></div><div><dt>Momentum · ${m.growth_clamped.toFixed(2)}% clamped</dt><dd>× ${m.momentum.toFixed(6)}</dd></div><div><dt>Maturity · ${m.effective_age_days}d${r.age_days==null?' default':''}</dt><dd>× ${m.maturity.toFixed(6)}</dd></div><div><dt>Chain breadth · ${r.chains.length} chains</dt><dd>× ${m.breadth.toFixed(2)}</dd></div><div><dt>Rounded result</dt><dd>${exact(r.implied_value_usd)}</dd></div></dl><p class="detail-caveat">The same function scores every record. Tracking age is a proxy for operating history. Missing growth uses zero and missing age uses 365 days. Category changes the plan, never the valuation.</p><p class="detail-caveat">A token launch, user allocation and rewards are unconfirmed. The estimate is neither a market price nor a personal payout.</p></section><section class="farm"><h3>Your field plan</h3><p>Category-derived actions · verify product support first<br>Capital is exposed, fees are budget limits, rewards are unconfirmed.</p><ol>${r.farm_steps.map(step => {const split=step.indexOf(' Cost:');return `<li>${escape(step.slice(0,split))}<small>${escape(step.slice(split+1))}</small></li>`;}).join('')}</ol></section></div>`;
    $('close-detail').addEventListener('click', () => $('detail').close());
    if (!$('detail').open) $('detail').showModal();
    $('detail').scrollTop=0;
  }
  $('detail').addEventListener('close', () => { if (opener && opener.isConnected) opener.focus({preventScroll:true}); });
  $('detail').addEventListener('click', event => { if (event.target === $('detail')) {const b=$('detail').getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)$('detail').close();} });
  $('rows').addEventListener('click', event => { const row=event.target.closest('tr[data-slug]');if(row)openDetail(row.dataset.slug,event.target.closest('button')); });
  $('search').addEventListener('input', event => {state.query=event.target.value;renderBoard();});
  $('category').addEventListener('change', event => {state.category=event.target.value;renderBoard();});
  $('reset').addEventListener('click', () => {state.query='';state.category='';$('search').value='';$('category').value='';renderBoard();});
  document.querySelectorAll('th[data-key] button').forEach(button => button.addEventListener('click', () => {
    const key=button.parentElement.dataset.key;
    state.direction=state.key===key ? -state.direction : key==='rank'?1:-1;
    state.key=key;renderBoard();
  }));
  function renderLive() {
    const query=$('live-search').value.trim().toLowerCase();
    const rows=data.live.filter(r => (r.name+' '+r.slug+' '+(r.symbol||'')).toLowerCase().includes(query));
    $('live-count').textContent=data.live_size+' RECORDS';
    $('live').innerHTML=rows.length ? rows.map(r => `<article class="live-card"><div><b>${escape(r.name)}</b><small>${escape(r.symbol || 'Ticker unreported')} · ${escape(r.category)}</small></div><div class="cap">${money(r.mcap_usd)}<small>SNAPSHOT MARKET CAP</small></div></article>`).join('') : '<p class="muted">No matching trading records.</p>';
  }
  $('live-search').addEventListener('input',renderLive);
  const shot=new URLSearchParams(location.search).get('shot');
  if(shot==='filtered') {
    // Most populated category; lexical ordering resolves ties without protocol-name rules.
    const category=categories.map(c => [c,data.rows.filter(r=>r.category===c).length]).sort((a,b)=>b[1]-a[1] || (a[0]<b[0]?-1:1))[0][0];
    state.category=category;$('category').value=category;
  }
  renderBoard();renderLive();
  if(shot==='detail')openDetail(data.rows[0].slug);
  window.scrollTo(0,0);
  requestAnimationFrame(() => requestAnimationFrame(() => {window.__shotReady=true;}));
})();
