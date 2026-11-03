/* Meu caixa · integração Pluggy + Painel + Previsão + layout web/celular + notificações
   Coloque este arquivo ao lado do index.html e adicione, logo antes de </body>:
     <script src="pluggy.js"></script>
   Ele usa as funções do seu app (S, save, render, renderRec, recSug, recCommit, CATS...). */
(() => {
'use strict';
if (typeof S === 'undefined' || typeof save !== 'function') { console.warn('pluggy.js: carregue depois do script principal do app'); return; }

// ------------------------------------------------------------------ config
const LS = 'caixa-pluggy';
const CONNECT_JS = 'https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js';
let CFG = {};
try { CFG = JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) {}
const saveCfg = () => { try { localStorage.setItem(LS, JSON.stringify(CFG)); } catch (e) {} };
const ready = () => !!(CFG.url && CFG.key);
// Estado que vai junto com seus dados (e para o Firebase): nada secreto aqui.
// P() só lê (não altera S, para não marcar os dados como modificados); PW() é usado quando vamos gravar.
const PG0 = () => ({ accMap: {}, accounts: [], bills: [], items: [], auto: true });
const P = () => (S.pg && typeof S.pg === 'object') ? Object.assign(PG0(), S.pg) : PG0();
const PW = () => { S.pg = Object.assign(PG0(), (S.pg && typeof S.pg === 'object') ? S.pg : {}); return S.pg; };
const hoje = () => today();
const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const diffD = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const dBR = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mAdd = (ym, n) => { let [y, mo] = ym.split('-').map(Number); mo += n; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return y + '-' + String(mo).padStart(2, '0'); };
const fmt0 = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const say = (t, bad) => { try { toast(t, bad); } catch (e) { console.log(t); } };

async function api(path, opt = {}) {
  const r = await fetch(CFG.url.replace(/\/+$/, '') + path, {
    ...opt, headers: { Authorization: 'Bearer ' + CFG.key, 'Content-Type': 'application/json' },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Servidor respondeu ' + r.status);
  return j;
}

// ------------------------------------------------------------------ estilos
const css = `
:root{--cr:#eb6834;--db:#2a78d6}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--cr:#d95926;--db:#3987e5}}
:root[data-theme="dark"]{--cr:#d95926;--db:#3987e5}
.pgk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:16px}
.pgk>div{background:var(--sf);border:1px solid var(--ln);border-radius:14px;padding:12px 14px}
.pgk small{display:block}.pgk b{display:block;font-size:1.25rem;font-weight:800;letter-spacing:-.02em;margin-top:2px}
.pgk .dl{font-size:.78rem;color:var(--mu)}
.pgk i.sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:0}
.sw.cr{background:var(--cr)}.sw.db{background:var(--db)}
.pgl{display:flex;gap:14px;flex-wrap:wrap;font-size:.82rem;color:var(--mu);margin:-4px 0 12px}
.pgl i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
#pg-rank li{padding:8px 0;border-top:1px solid var(--ln);cursor:pointer}#pg-rank li:first-child{border-top:0}
#pg-rank .rw{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
#pg-rank .pb{display:flex;gap:2px;height:10px;margin-top:6px;border-radius:4px;overflow:hidden;background:var(--ln)}
#pg-rank .pb i{display:block;height:100%}#pg-rank .pb i.cr{background:var(--cr)}#pg-rank .pb i.db{background:var(--db)}
#pg-rank .tl{margin:8px 0 2px;font-size:.85rem}#pg-rank .tl div{display:flex;justify-content:space-between;gap:8px;padding:3px 0;color:var(--mu)}
#pg-rank .tl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pgchart{position:relative}.pgchart svg{display:block;width:100%;height:auto;overflow:visible}
.pgchart text{fill:var(--mu);font-size:11px;font-family:inherit}
.pgtip{position:absolute;pointer-events:none;background:var(--ink);color:var(--bg);border-radius:10px;padding:8px 10px;font-size:.8rem;line-height:1.35;white-space:nowrap;transform:translate(-50%,-100%);z-index:5}
.pgtip[hidden]{display:none}
#pg-fc li{display:grid;grid-template-columns:52px 1fr auto;gap:4px 10px;padding:9px 0;border-top:1px solid var(--ln);align-items:baseline}
#pg-fc li:first-child{border-top:0}#pg-fc .dt{font-weight:700}#pg-fc .tg{font-size:.72rem;border:1px solid var(--ln);border-radius:6px;padding:1px 6px;margin-left:6px;color:var(--mu);white-space:nowrap}
#pg-fc b.in{color:var(--in)}#pg-fc b.out{color:var(--out)}#pg-fc .sb{grid-column:2/-1;font-size:.78rem;color:var(--mu)}
#pg-fc li.ng .sb{color:var(--out);font-weight:600}
.pgseg{display:flex;gap:4px;background:var(--ln);padding:3px;border-radius:10px;margin-bottom:10px}
.pgseg button{flex:1;border:0;background:transparent;border-radius:8px;min-height:36px;font-weight:600;color:var(--mu)}
.pgseg button[aria-pressed=true]{background:var(--sf);color:var(--ink)}
#pg-top li{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--ln)}#pg-top li:first-child{border-top:0}
#pg-top span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#pgc .acc{display:flex;justify-content:space-between;gap:8px;font-size:.88rem;padding:4px 0}
#pgc .it{padding:10px 0;border-top:1px solid var(--ln)}#pgc .it:first-of-type{border-top:0}
#pgc .bd{font-size:.72rem;border-radius:6px;padding:1px 7px;margin-left:6px;border:1px solid currentColor}
#pgc .bd.ok{color:var(--in)}#pgc .bd.er{color:var(--out)}#pgc .bd.wa{color:var(--am)}
#pgc select.mp{min-height:34px;padding:4px 8px;margin-top:4px;font-size:.85rem}
#pgc label.ck{display:flex;gap:8px;align-items:center;margin:10px 0;font-size:.92rem}
#pgc label.ck input{width:auto;min-height:0}
#pgc .bk button[disabled]{opacity:.5}
.pgempty{color:var(--mu);font-size:.9rem;padding:8px 0}

/* ---------- Celular: barra de abas embaixo, como app ---------- */
@media (max-width:1023px){
  main{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}
  main>nav[role=tablist]{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:30;margin:0;max-width:544px;margin-inline:auto;box-shadow:0 6px 24px rgba(0,0,0,.18)}
  .toast{bottom:calc(84px + env(safe-area-inset-bottom,0px))}
}
/* ---------- Computador: menu lateral e cartões em duas colunas ---------- */
@media (min-width:1024px){
  main{max-width:1240px;display:grid;grid-template-columns:200px minmax(0,1fr);column-gap:28px;padding:24px 32px 56px}
  main>*{grid-column:2;min-width:0}
  main>nav[role=tablist]{grid-column:1;grid-row:1/span 60;align-self:start;position:sticky;top:24px;display:flex;flex-direction:column;overflow:visible;gap:4px;padding:6px}
  main>nav[role=tablist] button{flex:0 0 auto;text-align:left;padding:12px 14px}
  main>header{margin-bottom:8px}
  .tape{display:grid;grid-template-columns:auto 1fr;column-gap:32px;align-items:end}
  .tape>.lbl,.tape>.big{grid-column:1}.tape>.big{margin-bottom:0}
  .tape>:not(.lbl):not(.big){grid-column:2;grid-row:auto}
  section[role=tabpanel]:not([hidden]){display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
  section[role=tabpanel]>.card{margin:0}
  section[role=tabpanel]>:not(.card){grid-column:1/-1}
  section[role=tabpanel]>.wide{grid-column:1/-1}
  #plan:not([hidden]){display:block}#plan>.card{margin-bottom:16px}
  .pgk{grid-template-columns:repeat(4,minmax(0,1fr));margin:0}
  .mdl .mbox{max-width:480px}
}`;
document.head.insertAdjacentHTML('beforeend', '<style id="pgcss">' + css + '</style>');

// ------------------------------------------------------------------ aba Painel
const nav = document.querySelector('main>nav[role=tablist]') || document.querySelector('nav[role=tablist]');
const TABS = ['res', 'lan', 'plan', 'cxs', 'rec'];
nav.querySelector('[data-t=res]').insertAdjacentHTML('afterend', '<button role="tab" data-t="pnl" aria-selected="false">Painel</button>');
$('res').insertAdjacentHTML('afterend', `
<section id="pnl" role="tabpanel" hidden>
  <div class="pgk wide" id="pg-kpi"></div>
  <div class="card"><h2>Onde vai seu dinheiro</h2>
    <div class="pgl"><span><i style="background:var(--cr)"></i>Crédito (cartão)</span><span><i style="background:var(--db)"></i>Débito, Pix e dinheiro</span></div>
    <ul id="pg-rank"></ul></div>
  <div class="card"><h2>Previsão de entradas e saídas</h2>
    <div class="pgseg" id="pg-hz"><button type="button" data-h="15">15 dias</button><button type="button" data-h="30">30 dias</button><button type="button" data-h="60">60 dias</button></div>
    <div class="pgchart" id="pg-fcc"></div><ul id="pg-fc" style="margin-top:8px"></ul></div>
  <div class="card"><h2>Gastos nos últimos 6 meses</h2>
    <div class="pgl"><span><i style="background:var(--cr)"></i>Crédito</span><span><i style="background:var(--db)"></i>Débito, Pix e dinheiro</span></div>
    <div class="pgchart" id="pg-6m"></div></div>
  <div class="card"><h2>Onde você mais compra</h2><ul id="pg-top"></ul></div>
</section>`);
const pbtn = nav.querySelector('[data-t=pnl]');
function showPanel() {
  nav.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === pbtn));
  TABS.forEach(id => { if ($(id)) $(id).hidden = true; });
  $('pnl').hidden = false; paintPanel();
}
pbtn.addEventListener('click', showPanel);
nav.querySelectorAll('button').forEach(b => { if (b !== pbtn) b.addEventListener('click', () => { $('pnl').hidden = true; }); });
const goTab = t => { const b = nav.querySelector('[data-t=' + t + ']'); if (b) b.click(); };

// ------------------------------------------------------------------ dados do painel
const isCredit = t => !!t.card;                 // compra lançada num cartão = crédito
const monthTx = ym => S.tx.filter(t => t.date && t.date.slice(0, 7) === ym && t.cat !== 'Caixinhas' && !String(t.cat || '').startsWith('cx:'));
const val = t => t.amount || 0;

function paintKpi(ym) {
  const tx = monthTx(ym), prev = monthTx(mAdd(ym, -1));
  const inc = tx.filter(t => t.type === 'in').reduce((a, t) => a + val(t), 0);
  const out = tx.filter(t => t.type === 'out'), exp = out.reduce((a, t) => a + val(t), 0);
  const cr = out.filter(isCredit).reduce((a, t) => a + val(t), 0), db = exp - cr;
  const pexp = prev.filter(t => t.type === 'out').reduce((a, t) => a + val(t), 0);
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const dv = pexp ? Math.round((exp - pexp) / pexp * 100) : null;
  $('pg-kpi').innerHTML = `
    <div><small>Entradas</small><b style="color:var(--in)">${fmt(inc)}</b><span class="dl">no mês</span></div>
    <div><small>Saídas</small><b style="color:var(--out)">${fmt(exp)}</b><span class="dl">${dv === null ? 'sem mês anterior' : (dv > 0 ? '▲ ' : dv < 0 ? '▼ ' : '') + Math.abs(dv) + '% vs mês anterior'}</span></div>
    <div><small><i class="sw cr"></i>No crédito</small><b>${fmt(cr)}</b><span class="dl">${pct(cr, exp)}% das saídas</span></div>
    <div><small><i class="sw db"></i>No débito / Pix</small><b>${fmt(db)}</b><span class="dl">${pct(db, exp)}% das saídas</span></div>`;
}

let openRank = null;
function paintRank(ym) {
  const out = monthTx(ym).filter(t => t.type === 'out'), by = {};
  out.forEach(t => { const c = t.cat || 'Sem categoria'; (by[c] = by[c] || { c, cr: 0, db: 0, tx: [] }); by[c][isCredit(t) ? 'cr' : 'db'] += val(t); by[c].tx.push(t); });
  const rows = Object.values(by).map(r => ({ ...r, tot: r.cr + r.db })).sort((a, b) => b.tot - a.tot);
  const total = rows.reduce((a, r) => a + r.tot, 0), max = rows[0]?.tot || 1;
  if (!rows.length) { $('pg-rank').innerHTML = '<li class="pgempty">Nenhuma despesa neste mês ainda.</li>'; return; }
  $('pg-rank').innerHTML = rows.map(r => {
    const w = r.tot / max * 100, wc = r.tot ? r.cr / r.tot * w : 0, wd = w - wc;
    const tl = openRank === r.c ? '<div class="tl">' + r.tx.sort((a, b) => val(b) - val(a)).slice(0, 6).map(t => `<div><span>${dBR(t.date)} · ${esc(t.desc || '')}</span><span>${fmt(val(t))}</span></div>`).join('') + '</div>' : '';
    return `<li data-c="${esc(r.c)}" title="Crédito ${fmt(r.cr)} · Débito ${fmt(r.db)}"><div class="rw"><span><b>${esc(r.c)}</b> <small>${Math.round(r.tot / total * 100)}%</small></span><b>${fmt(r.tot)}</b></div>
      <div class="pb" style="width:${Math.max(w, 2)}%">${wc ? `<i class="cr" style="flex:${wc}"></i>` : ''}${wd ? `<i class="db" style="flex:${wd}"></i>` : ''}</div>${tl}</li>`;
  }).join('');
}
$('pg-rank') && document.addEventListener('click', e => {
  const li = e.target.closest('#pg-rank li[data-c]'); if (!li) return;
  openRank = openRank === li.dataset.c ? null : li.dataset.c; paintRank(m);
});

function tipFor(box) {
  let t = box.querySelector('.pgtip');
  if (!t) { t = document.createElement('div'); t.className = 'pgtip'; t.hidden = true; box.appendChild(t); }
  return t;
}
function paint6m(ym) {
  const box = $('pg-6m'), months = [-5, -4, -3, -2, -1, 0].map(i => mAdd(ym, i));
  const data = months.map(k => { const o = monthTx(k).filter(t => t.type === 'out'); const cr = o.filter(isCredit).reduce((a, t) => a + val(t), 0); return { k, cr, db: o.reduce((a, t) => a + val(t), 0) - cr }; });
  const W = Math.round(Math.min(680, Math.max(300, box.clientWidth || 360))), H = 200, pl = 8, pb = 22, pt = 18, mx = Math.max(1, ...data.map(d => d.cr + d.db));
  const bw = (W - pl * 2) / data.length, colW = Math.min(44, bw * .56), y = v => (H - pb) - v / mx * (H - pb - pt);
  let g = `<line x1="${pl}" x2="${W - pl}" y1="${H - pb}" y2="${H - pb}" stroke="var(--ln)" />`;
  data.forEach((d, i) => {
    const x = pl + bw * i + (bw - colW) / 2, yd = y(d.db), yc = y(d.db + d.cr), gap = d.cr && d.db ? 2 : 0;
    if (d.db) g += `<path d="${barPath(x, yd, colW, H - pb - yd, !d.cr)}" fill="var(--db)"/>`;
    if (d.cr) g += `<path d="${barPath(x, yc, colW, Math.max(0, yd - yc - gap), true)}" fill="var(--cr)"/>`;
    const [yy, mm] = d.k.split('-');
    g += `<text x="${x + colW / 2}" y="${H - 6}" text-anchor="middle" ${d.k === ym ? 'style="fill:var(--ink);font-weight:700"' : ''}>${MESES[+mm - 1]}${mm === '01' ? '/' + yy.slice(2) : ''}</text>`;
    if (d.cr + d.db) g += `<text x="${x + colW / 2}" y="${yc - 5}" text-anchor="middle" style="fill:var(--ink)">${fmtK(d.cr + d.db)}</text>`;
    g += `<rect x="${pl + bw * i}" y="0" width="${bw}" height="${H}" fill="transparent" data-i="${i}"/>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gastos por mês, crédito e débito">${g}</svg>`;
  const tip = tipFor(box), svg = box.querySelector('svg');
  const show = e => {
    const r = e.target.closest('rect[data-i]'); if (!r) { tip.hidden = true; return; }
    const d = data[+r.dataset.i], [yy, mm] = d.k.split('-'), bb = svg.getBoundingClientRect(), sc = bb.width / W;
    tip.innerHTML = `<b>${MESES[+mm - 1]}/${yy}</b><br>Crédito ${fmt(d.cr)}<br>Débito/Pix ${fmt(d.db)}<br>Total ${fmt(d.cr + d.db)}`;
    tip.style.left = Math.min(Math.max((pl + bw * (+r.dataset.i + .5)) * sc, 70), bb.width - 70) + 'px'; tip.style.top = (y(d.cr + d.db) * sc - 22) + 'px'; tip.hidden = false;
  };
  svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show); svg.addEventListener('pointerleave', () => tip.hidden = true);
}
// barra com cantos arredondados só no topo
function barPath(x, y, w, h, roundTop) {
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, h, w / 2) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ''}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ''}V${y + h}Z`;
}
const fmtK = v => v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : Math.round(v).toString();

function paintTop(ym) {
  const by = {};
  monthTx(ym).filter(t => t.type === 'out').forEach(t => {
    const k = (typeof rkey === 'function' ? rkey(t.desc || '') : norm(t.desc || '')) || norm(t.desc || '');
    if (!k) return; (by[k] = by[k] || { n: (t.desc || '').replace(/\s*\(\d+\/\d+\)$/, ''), v: 0, q: 0 }); by[k].v += val(t); by[k].q++;
  });
  const rows = Object.values(by).sort((a, b) => b.v - a.v).slice(0, 8);
  $('pg-top').innerHTML = rows.length ? rows.map(r => `<li><span>${esc(r.n)} <small>${r.q}×</small></span><b>${fmt(r.v)}</b></li>`).join('') : '<li class="pgempty">Sem compras neste mês.</li>';
}

// ------------------------------------------------------------------ previsão
// Compromissos do app: occ(mês) já junta os avulsos (S.comp) e os fixos que repetem (S.cfix).
// st 'a' = a pagar; os atrasados aparecem no dia de hoje.
function compEvents(from, to) {
  if (typeof occ !== 'function') return [];
  const ev = [], seen = new Set();
  const add = (x, date, late) => {
    const id = 'c' + x.id; if (seen.has(id)) return; seen.add(id);
    const amount = Math.abs(+x.v || 0); if (!amount) return;
    ev.push({ id, date, name: x.n || 'Compromisso', amount, dir: 'out', src: late ? 'Atrasado' : 'Compromisso', cat: x.c });
  };
  // atrasados: só os do último mês (os mais antigos provavelmente foram pagos e não marcados)
  const lim = addD(from, -31);
  try { if (typeof lateOld === 'function') lateOld().forEach(x => { if (x.d >= lim) add(x, from, true); }); } catch (e) {}
  for (let k = from.slice(0, 7); k <= to.slice(0, 7); k = mAdd(k, 1)) {
    occ(k).forEach(x => {
      if (x.st !== 'a' || !x.d) return;
      if (x.d < from) { if (x.d >= lim) add(x, from, true); } else if (x.d <= to) add(x, x.d, false);
    });
  }
  return ev;
}

// Detecta contas que se repetem todo mês (luz, internet, salário...) pelo histórico.
function recurringEvents(from, to, skipNames) {
  const cur = hoje().slice(0, 7), months = [1, 2, 3, 4].map(i => mAdd(cur, -i)), groups = {};
  S.tx.forEach(t => {
    if (!t.date || t.card || t.cat === 'Caixinhas' || String(t.cat || '').startsWith('cx:')) return; // cartão já entra pela fatura
    const ym = t.date.slice(0, 7); if (!months.includes(ym) && ym !== cur) return;
    const k = t.type + '|' + ((typeof rkey === 'function' ? rkey(t.desc || '') : norm(t.desc || '')) || '');
    if (k.length < 5) return;
    (groups[k] = groups[k] || []).push(t);
  });
  const ev = [];
  Object.entries(groups).forEach(([k, list]) => {
    const past = list.filter(t => t.date.slice(0, 7) !== cur), ms = new Set(past.map(t => t.date.slice(0, 7)));
    if (ms.size < 3) return;
    const amts = past.map(val).sort((a, b) => a - b), med = amts[Math.floor(amts.length / 2)];
    if (past.some(t => Math.abs(val(t) - med) > med * .35)) return;
    const days = past.map(t => +t.date.slice(8, 10)).sort((a, b) => a - b), day = days[Math.floor(days.length / 2)];
    const name = list[list.length - 1].desc.replace(/\s*\(\d+\/\d+\)$/, '');
    if (skipNames.some(n => norm(n) && (norm(name).includes(norm(n)) || norm(n).includes(norm(name))))) return;
    const doneThis = list.some(t => t.date.slice(0, 7) === cur);
    for (let i = 0; i < 3; i++) {
      const ym = mAdd(cur, i); if (i === 0 && doneThis) continue;
      const last = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), d = ym + '-' + String(Math.min(day, last)).padStart(2, '0');
      if (d >= from && d <= to) ev.push({ id: 'r:' + k + ':' + d, date: d, name, amount: Math.round(med * 100) / 100, dir: list[0].type === 'in' ? 'in' : 'out', src: 'Recorrente', cat: list[0].cat });
    }
  });
  return ev;
}

function billEvents(from, to) {
  const p = P(), ev = [];
  p.accounts.filter(a => a.type === 'CREDIT').forEach(a => {
    const bills = p.bills.filter(b => b.accountId === a.id && b.dueDate >= from && b.dueDate <= to);
    const seen = new Set();
    bills.forEach(b => { seen.add(b.dueDate); ev.push({ id: 'b:' + b.id, date: b.dueDate, name: 'Fatura ' + a.name, amount: b.total, dir: 'out', src: 'Fatura' }); });
    const due = a.credit && a.credit.dueDate;
    if (due && due >= from && due <= to && !seen.has(due) && Math.abs(a.balance || 0) > 0)
      ev.push({ id: 'b:' + a.id + ':' + due, date: due, name: 'Fatura ' + a.name, amount: Math.abs(a.balance), dir: 'out', src: 'Fatura aberta' });
  });
  return ev;
}

let horizon = 30;
function forecast() {
  const from = hoje(), to = addD(from, horizon);
  const comp = compEvents(from, to);
  const ev = [...billEvents(from, to), ...comp, ...recurringEvents(from, to, [...comp.map(e => e.name), ...(S.comp || []).map(x => x.n), ...(S.cfix || []).map(x => x.n)].filter(Boolean).map(n => String(n).replace(/\s*\(\d+\/\d+\)$/, '')))].sort((a, b) => a.date.localeCompare(b.date) || (a.dir === 'in' ? -1 : 1));
  const bank = P().accounts.filter(a => a.type === 'BANK');
  const start = bank.length ? bank.reduce((s, a) => s + (+a.balance || 0), 0) : null;
  return { from, to, ev, start };
}
function paintForecast() {
  document.querySelectorAll('#pg-hz button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.h === horizon));
  const { from, to, ev, start } = forecast();
  let run = start ?? 0;
  const pts = [{ d: from, v: run }];
  const rows = ev.map(e => {
    run += e.dir === 'in' ? e.amount : -e.amount; pts.push({ d: e.date, v: run, e });
    const dd = diffD(from, e.date), quando = dd === 0 ? 'hoje' : dd === 1 ? 'amanhã' : 'em ' + dd + ' dias';
    return `<li class="${start !== null && run < 0 ? 'ng' : ''}"><span class="dt">${dBR(e.date)}</span><span>${esc(e.name)}<span class="tg">${e.src}</span></span><b class="${e.dir}">${e.dir === 'in' ? '+' : '−'}${fmt(e.amount)}</b>
      <span class="sb">${quando}${start !== null ? ' · saldo previsto ' + fmt(run) : ''}</span></li>`;
  });
  const tin = ev.filter(e => e.dir === 'in').reduce((a, e) => a + e.amount, 0), tout = ev.filter(e => e.dir === 'out').reduce((a, e) => a + e.amount, 0);
  $('pg-fc').innerHTML = rows.length
    ? `<li style="grid-template-columns:1fr auto"><span><small>Entradas previstas</small><br><b class="in">+${fmt(tin)}</b></span><span style="text-align:right"><small>Saídas previstas</small><br><b class="out">−${fmt(tout)}</b></span></li>` + rows.join('')
    : '<li class="pgempty" style="display:block">Nada previsto. Cadastre compromissos na aba Lançamentos → Compromissos ou conecte seu cartão para ver as faturas.</li>';
  paintBalanceLine(pts, from, to, start);
  queueReminders(ev);
}
function paintBalanceLine(pts, from, to, start) {
  const box = $('pg-fcc');
  if (start === null || pts.length < 2) { box.innerHTML = start === null ? '<small>Conecte uma conta corrente no Pluggy para ver o saldo previsto dia a dia.</small>' : ''; return; }
  const W = Math.round(Math.min(680, Math.max(300, box.clientWidth || 360))), H = 160, pl = 4, pr = 4, pt = 16, pb = 20, span = Math.max(1, diffD(from, to));
  const series = []; let v = pts[0].v;
  for (let i = 0; i <= span; i++) { const d = addD(from, i); pts.filter(p => p.d === d && p.e).forEach(p => v = p.v); series.push({ d, v }); }
  const lo = Math.min(0, ...series.map(s => s.v)), hi = Math.max(1, ...series.map(s => s.v));
  const x = i => pl + i / span * (W - pl - pr), y = val => pt + (hi - val) / (hi - lo || 1) * (H - pt - pb);
  let path = ''; series.forEach((s, i) => { path += (i ? 'H' + x(i).toFixed(1) + 'V' : 'M' + x(i).toFixed(1) + ',') + y(s.v).toFixed(1); });
  const minS = series.reduce((a, s) => s.v < a.v ? s : a, series[0]);
  let g = `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ln)" ${lo < 0 ? 'stroke-dasharray="4 4"' : ''}/>`;
  g += `<path d="${path}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>`;
  g += `<circle cx="${x(series.indexOf(minS))}" cy="${y(minS.v)}" r="4" fill="${minS.v < 0 ? 'var(--out)' : 'var(--ink)'}" stroke="var(--sf)" stroke-width="2"/>`;
  g += `<text x="${Math.min(Math.max(x(series.indexOf(minS)), 60), W - 60)}" y="${Math.min(y(minS.v) + 16, H - pb - 2)}" text-anchor="middle" style="fill:var(--ink)">menor: ${fmt0(minS.v)} em ${dBR(minS.d)}</text>`;
  g += `<text x="${pl}" y="${H - 4}">${dBR(from)}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${dBR(to)}</text>${series.indexOf(minS) > span * .25 ? `<text x="${pl}" y="10">${fmt0(series[0].v)} hoje</text>` : ''}`;
  g += `<line id="pgx" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--mu)" visibility="hidden"/><rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo previsto em conta">${g}</svg>`;
  const svg = box.querySelector('svg'), tip = tipFor(box), cross = svg.querySelector('#pgx');
  const move = e => {
    const bb = svg.getBoundingClientRect(), sc = bb.width / W, i = Math.round(Math.min(Math.max((e.clientX - bb.left) / sc - pl, 0), W - pl - pr) / (W - pl - pr) * span), s = series[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    const evs = pts.filter(p => p.d === s.d && p.e).map(p => esc(p.e.name)).join('<br>');
    tip.innerHTML = `<b>${dBR(s.d)}</b> · saldo ${fmt(s.v)}${evs ? '<br>' + evs : ''}`; tip.style.left = Math.min(Math.max(x(i) * sc, 80), bb.width - 80) + 'px'; tip.style.top = (y(s.v) * sc - 10) + 'px'; tip.hidden = false;
  };
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}
$('pg-hz').addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) { horizon = +b.dataset.h; paintForecast(); } });

// Envia ao servidor as contas previstas, para ele avisar no celular mesmo com o app fechado.
let remTimer = null, remLast = '';
function queueReminders(ev) {
  if (!ready()) return;
  const items = ev.filter(e => e.src === 'Compromisso' || e.src === 'Recorrente').map(e => ({ id: e.id, name: e.name, amount: e.amount, date: e.date, dir: e.dir }));
  const sig = JSON.stringify(items); if (sig === remLast) return;
  clearTimeout(remTimer);
  remTimer = setTimeout(() => api('/reminders', { method: 'PUT', body: JSON.stringify({ items }) }).then(() => remLast = sig).catch(() => {}), 2500);
}

function paintPanel() {
  if ($('pnl').hidden) return;
  try { paintKpi(m); paintRank(m); paintForecast(); paint6m(m); paintTop(m); } catch (e) { console.error('Painel:', e); }
}
// Redesenha o painel sempre que o app redesenha (troca de mês, novo lançamento...).
if (typeof window.render === 'function') {
  const orig = window.render;
  window.render = function () { const r = orig.apply(this, arguments); paintPanel(); return r; };
}

// ------------------------------------------------------------------ categorias
const SUGESTAO = ['Casa', 'Alimentação', 'Saúde', 'Estudo', 'Lazer', 'Transporte', 'Bobeiras', 'Assinaturas'];
// Tradução das categorias do Pluggy para as suas (a primeira que existir no seu app é usada).
const PCAT = [
  [/digital service|video streaming|music streaming|streaming|software|assinatura/, ['Assinaturas', 'Lazer']],
  [/online bet|gambling|lotter|gaming|game|aposta|jogos/, ['Bobeiras', 'Lazer']],
  [/grocer|supermarket|supermerc|food|eating out|restaurant|delivery|bakery|aliment|mercado|padaria/, ['Alimentação', 'Mercado']],
  [/rent|housing|utilit|water|electric|energy|^gas$|gas bill|urban land|condo|home insurance|aluguel|moradia|energia|agua|condom|iptu/, ['Casa', 'Moradia']],
  [/telecom|internet|mobile|^tv$|telefon|celular/, ['Casa', 'Moradia', 'Assinaturas']],
  [/health|dentist|pharmac|hospital|clinic|lab|optom|saude|farmac|medic|gym|fitness|wellness|academia/, ['Saúde']],
  [/educat|course|universit|school|bookstore|escola|curso|faculdade|livrar/, ['Estudo', 'Educação']],
  [/transport|taxi|ride|uber|gas station|fuel|parking|toll|vehicle|automotive|bus|car rental|bicycle|combust|estacion|pedag/, ['Transporte']],
  [/leisure|ticket|cinema|theater|concert|travel|airline|airport|accomodat|accommodat|hotel|stadium|museum|sport|lazer|viage/, ['Lazer']],
  [/shopping|clothing|electronic|kids|toys|gift|presente|vestu|roupa/, ['Bobeiras', 'Compras', 'Lazer']],
  [/pet/, ['Pet', 'Casa']],
  [/tax|fee|interest|tarifa|imposto|juros|iof/, ['Taxas', 'Impostos', 'Outros']],
];
const PCAT_IN = [
  [/salary|salario|payroll|wage/, ['Salário']],
  [/income|entrepreneur|retire|aid|non-recurring|refund|cashback|rendiment|reembolso/, ['Extra', 'Outros']],
];
function mapCat(pc, type) {
  const n = norm(pc || ''); if (!n) return '';
  for (const [re, opts] of (type === 'in' ? PCAT_IN : PCAT)) if (re.test(n)) { const c = opts.find(o => CATS[type].includes(o)); if (c) return c; }
  return '';
}
function addSuggestedCats() {
  const out = CATS.out, has = c => out.some(x => norm(x) === norm(c));
  const ren = [['Moradia', 'Casa'], ['Educação', 'Estudo']];
  let msg = [];
  ren.forEach(([a, b]) => { if (has(a) && !has(b) && typeof renameCat === 'function') { const r = renameCat('out', a, b); if (r !== 'noop' && r !== false) msg.push(a + '→' + b); } });
  SUGESTAO.forEach(c => { if (!has(c)) { out.push(c); msg.push('+' + c); } });
  if (S.cats && S.cats.out !== out) S.cats.out = out;
  save(); try { fillCats(); } catch (e) {} render(); renderRec(); renderPg();
  say(msg.length ? 'Categorias: ' + msg.join(', ') : 'Você já tem todas as categorias sugeridas.');
}

// ------------------------------------------------------------------ sincronização
function cardFor(acc) {
  const p = PW();
  if (p.accMap[acc.id] && S.cards.some(c => c.id === p.accMap[acc.id])) return p.accMap[acc.id];
  const nm = (acc.name || 'Cartão').replace(/\s+/g, ' ').trim().slice(0, 30);
  let c = S.cards.find(x => norm(x.name) === norm(nm)) || S.cards.find(x => norm(x.name).length > 2 && (norm(nm).includes(norm(x.name)) || norm(x.name).includes(norm(nm))));
  if (!c) { c = { id: typeof uid === 'function' ? uid() : Date.now(), name: nm }; S.cards.push(c); try { fillCards(); } catch (e) {} }
  p.accMap[acc.id] = c.id; return c.id;
}
const INTERNAL = /same person|same ownership|mesma titularidade|entre contas|credit card payment|pagamento de fatura|pagto fatura|pag fatura|fatura cart|investment|aplicac|resgate|cofrinho|dinheiro (retirado|reservado)/;

function toRec(t, accById) {
  // Conta corrente: espera confirmar. Cartão: as compras da fatura aberta vêm como pendentes, então entram já.
  if (t.status === 'PENDING' && !t.isCard) return null;
  const acc = accById[t.accountId] || {}, type = t.dir === 'in' ? 'in' : 'out', kind = t.isCard ? 'fatura' : 'conta';
  const desc = ((t.merchant && t.desc.length < 4 ? t.merchant : t.desc) || t.merchant || '(sem descrição)') + (t.inst ? ` (${t.inst.n}/${t.inst.total})` : '');
  const mv = { id: 'p:' + t.id, date: t.date, type, amount: t.amount, desc, st: 'pend', kind, src: 'pluggy', pcat: t.category, acc: t.accountId };
  if (t.status === 'PENDING') mv.pend = 1;
  if (t.isCard && type === 'out') mv.card = cardFor(acc);
  const n = norm(desc + ' ' + (t.category || '')), me = norm(S.myname || '');
  if ((t.isCard && type === 'in' && /pagamento|payment|pgto/.test(n)) || INTERNAL.test(n) || (me.length > 3 && norm(desc).includes(me) && /transfer|pix|ted/.test(n))) mv.st = 'ign';
  mv.dup = S.tx.some(x => x.type === type && Math.abs((x.gross || x.amount) - t.amount) < .005 && Math.abs(new Date(x.date) - new Date(t.date)) <= 864e5)
    || S.rec.some(x => x.src !== 'pluggy' && x.st === 'pend' && x.type === type && Math.abs(x.amount - t.amount) < .005 && x.date === t.date);
  if (!(recSug(mv) || {}).cat) { const c = mapCat(t.category, type); if (c) mv.cat = c; }
  return mv;
}

let syncing = false;
async function sync(opts = {}) {
  if (!ready() || syncing) return;
  syncing = true; setBusy(true);
  const p = PW();
  try {
    // versão 2: passou a aceitar compras pendentes do cartão, então busca os 90 dias de novo uma vez
    const full = opts.full || p.ver !== 2;
    const from = p.lastSync && !full ? addD(p.lastSync.slice(0, 10), -15) : addD(hoje(), -90);
    const r = await api('/sync?from=' + from);
    p.items = r.items || []; p.accounts = r.accounts || []; p.bills = r.bills || [];
    const accById = Object.fromEntries(p.accounts.map(a => [a.id, a]));
    // quantas movimentações chegaram de cada conta (aparece no cartão de configuração)
    p.counts = {};
    (r.transactions || []).forEach(t => { const c = p.counts[t.accountId] = p.counts[t.accountId] || { n: 0, pe: 0 }; c.n++; if (t.status === 'PENDING') c.pe++; });
    // compra que veio pendente e agora chegou confirmada (com outro id): não lança de novo
    const samePurchase = t => S.rec.find(x => x.pend && x.acc === t.accountId && !x.postedId && Math.abs(x.amount - t.amount) < .005 && Math.abs(new Date(x.date) - new Date(t.date)) <= 5 * 864e5);
    const have = new Set(S.rec.map(x => x.id));
    let novas = 0, auto = 0, rev = 0;
    (r.transactions || []).sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      if (have.has('p:' + t.id) || S.rec.some(x => x.postedId === t.id)) return;
      if (t.isCard && t.status !== 'PENDING') { const old = samePurchase(t); if (old) { old.postedId = t.id; old.pend = 0; return; } }
      const mv = toRec(t, accById); if (!mv) return;
      S.rec.push(mv); have.add(mv.id); novas++;
      if (mv.st !== 'pend') return;
      const s = recSug(mv) || {}, cat = mv.cat || s.cat;
      if (p.auto && !mv.dup && cat) { recCommit(mv, cat, mv.kind === 'fatura' ? 'Cartão' : (s.pay && s.pay !== 'Cartão' ? s.pay : recPay(mv))); auto++; } else rev++;
    });
    // limpa o histórico antigo de conciliação (mantém o banco do Firebase leve)
    const cut = addD(hoje(), -120);
    S.rec = S.rec.filter(x => !(x.src === 'pluggy' && x.st !== 'pend' && x.date < cut));
    p.ver = 2;
    p.lastSync = new Date().toISOString(); p.lastErr = (r.errors || []).join(' · ') || null;
    save(); render(); renderRec(); renderPg();
    say(novas ? `${novas} movimentação(ões) nova(s): ${auto} lançada(s) sozinha(s), ${rev} para revisar.` : 'Tudo em dia. Nenhuma movimentação nova.');
    if (rev && opts.fromPush) goTab('rec');
  } catch (e) {
    PW().lastErr = e.message; renderPg(); say('Pluggy: ' + e.message, true);
  } finally { syncing = false; setBusy(false); }
}
function setBusy(b) { const x = $('pg-sync'); if (x) { x.disabled = b; x.textContent = b ? 'Sincronizando…' : 'Sincronizar agora'; } }

// ------------------------------------------------------------------ conectar banco
function loadConnect() {
  if (window.PluggyConnect) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = CONNECT_JS; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o Pluggy Connect.')); document.head.appendChild(s); });
}
async function connectBank(itemId) {
  try {
    const [{ accessToken }] = await Promise.all([api('/connect-token', { method: 'POST', body: JSON.stringify(itemId ? { itemId } : {}) }), loadConnect()]);
    new window.PluggyConnect({
      connectToken: accessToken, includeSandbox: !!CFG.sandbox, updateItem: itemId || undefined,
      onSuccess: async data => { await addItem(data.item.id, true); },
      onError: err => say('Conexão não concluída: ' + (err && err.message || 'erro'), true),
    }).init();
  } catch (e) { say(e.message, true); }
}
async function addItem(id, quiet) {
  try {
    const r = await api('/items', { method: 'POST', body: JSON.stringify({ itemId: id.trim() }) });
    if (!quiet) say((r.bank || 'Banco') + ' adicionado.');
    await sync({ full: true });
  } catch (e) { say(e.message, true); }
}

// ------------------------------------------------------------------ notificações
const u8 = b => { b = b.replace(/-/g, '+').replace(/_/g, '/'); const s = atob(b + '==='.slice((b.length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function enablePush() {
  if (!pushOk()) {
    const ios = /iphone|ipad/i.test(navigator.userAgent);
    say(ios ? 'No iPhone: toque em Compartilhar → "Adicionar à Tela de Início", abra o app por lá e tente de novo.' : 'Este navegador não aceita notificações.', true); return;
  }
  try {
    if (await Notification.requestPermission() !== 'granted') { say('Permissão de notificação negada. Libere nas configurações do navegador.', true); return; }
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise((_, no) => setTimeout(() => no(new Error('O service worker (sw.js) não está ativo.')), 8000))]);
    const { vapidPublic } = await api('/config');
    if (!vapidPublic) throw new Error('O servidor não tem VAPID_PUBLIC configurada.');
    let sub = await reg.pushManager.getSubscription();
    if (sub && CFG.vapid && CFG.vapid !== vapidPublic) { await sub.unsubscribe(); sub = null; }
    sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(vapidPublic) });
    await api('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), device: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '' }) });
    CFG.push = true; CFG.vapid = vapidPublic; saveCfg(); renderPg();
    say('Notificações ativadas neste aparelho.');
  } catch (e) { say('Notificações: ' + e.message, true); }
}

// ------------------------------------------------------------------ cartão "Contas bancárias" na aba ⚙
const recSec = $('rec');
recSec.insertAdjacentHTML('afterbegin', '<div class="card" id="pgc"></div>');
function renderPg() {
  const el = $('pgc'); if (!el) return;
  const p = P();
  if (!ready()) {
    el.innerHTML = `<h2>Contas bancárias automáticas</h2>
      <small style="display:block;margin-bottom:10px">Conecte seus bancos pelo Pluggy (Open Finance) e as entradas e saídas chegam sozinhas, já com sugestão de categoria. Primeiro publique o servidor (veja o guia) e cole os dados dele aqui.</small>
      <input id="pg-url" placeholder="Endereço do servidor (https://meu-caixa-api....workers.dev)" aria-label="Endereço do servidor" value="${esc(CFG.url || '')}">
      <input id="pg-key" type="password" placeholder="Chave do app (APP_KEY)" aria-label="Chave do app" style="margin-top:8px" autocomplete="off">
      <button class="go" id="pg-save" type="button" style="margin-top:10px">Salvar e testar</button>`;
    return;
  }
  const items = p.items || [], accs = p.accounts || [];
  const badge = it => !it.ok ? '<span class="bd er">erro</span>' : /UPDATED|SUCCESS/.test(it.status + it.executionStatus) ? '<span class="bd ok">ok</span>' : /ERROR|OUTDATED|LOGIN/.test(it.status) ? '<span class="bd er">' + esc(it.status) + '</span>' : '<span class="bd wa">' + esc(it.status || '…') + '</span>';
  const when = s => s ? new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const cardOpts = (sel, a) => `<option value=""${S.cards.some(c => c.id === sel) ? '' : ' selected'}>Vincular a um cartão do app…</option>` + S.cards.map(c => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + `<option value="__new">+ Criar cartão "${esc(a.name)}"</option>`;
  const list = items.length ? items.map(it => {
    const exp = it.consentExpiresAt ? diffD(hoje(), it.consentExpiresAt.slice(0, 10)) : null;
    return `<div class="it"><div class="rw"><b>${esc(it.bank || 'Banco')}${badge(it)}</b><button class="sm" data-pg="del" data-id="${esc(it.id)}" type="button">Remover</button></div>
      <small>Atualizado ${when(it.lastUpdatedAt)}${exp !== null ? ' · autorização ' + (exp < 0 ? 'expirou' : 'vale mais ' + exp + ' dia(s)') : ''}${it.error ? ' · ' + esc(it.error) : ''}</small>
      ${accs.filter(a => a.itemId === it.id).map(a => `<div class="acc"><span>${a.type === 'CREDIT' ? '💳 ' : '🏦 '}${esc(a.name)}${a.credit && a.credit.dueDate ? ' <small>vence ' + dBR(a.credit.dueDate) + '</small>' : ''} <small>· ${(p.counts && p.counts[a.id] ? p.counts[a.id].n : 0)} mov.${p.counts && p.counts[a.id] && p.counts[a.id].pe ? ' (' + p.counts[a.id].pe + ' pendentes)' : ''}</small></span><b>${fmt(+a.balance || 0)}</b></div>
        ${a.type === 'CREDIT' ? `<select class="mp" data-acc="${esc(a.id)}" aria-label="Cartão do app para ${esc(a.name)}">${cardOpts(p.accMap[a.id], a)}</select>` : ''}`).join('')}</div>`;
  }).join('') : '<p class="pgempty">Nenhum banco conectado ainda.</p>';
  el.innerHTML = `<h2>Contas bancárias automáticas</h2>
    <small style="display:block;margin-bottom:6px">Última sincronização: ${when(p.lastSync)}${p.lastErr ? ' · <span style="color:var(--out)">' + esc(p.lastErr) + '</span>' : ''}</small>
    ${list}
    <div class="bk"><button class="pri" id="pg-sync" type="button">Sincronizar agora</button><button id="pg-conn" type="button">Conectar banco</button></div>
    <details class="adv"><summary>Adicionar conexão do Meu Pluggy (itemId)</summary>
      <input id="pg-iid" placeholder="ex.: 3f2a9c1e-…" aria-label="itemId" style="margin-top:8px"><button class="go" id="pg-add" type="button" style="margin-top:8px">Adicionar</button></details>
    <label class="ck"><input type="checkbox" id="pg-auto"${p.auto ? ' checked' : ''}> Lançar sozinho quando a categoria for reconhecida (o resto fica em Pendentes)</label>
    <div class="bk"><button id="pg-push" type="button">${CFG.push ? 'Notificações ativas ✓' : 'Ativar notificações'}</button><button id="pg-ptest" type="button"${CFG.push ? '' : ' disabled'}>Testar notificação</button></div>
    <div class="bk"><button id="pg-cats" type="button">Usar categorias sugeridas</button><button id="pg-cfg" type="button">Alterar servidor</button></div>`;
}
recSec.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || !$('pgc').contains(b)) return;
  if (b.id === 'pg-save') {
    const url = $('pg-url').value.trim().replace(/\/+$/, ''), key = $('pg-key').value.trim();
    if (!/^https:\/\//.test(url) || !key) { say('Preencha o endereço (https://…) e a chave.', true); return; }
    CFG.url = url; CFG.key = key;
    try { await api('/config'); saveCfg(); renderPg(); say('Servidor conectado!'); sync({ full: true }); }
    catch (err) { CFG.key = ''; say('Não consegui falar com o servidor: ' + err.message, true); }
  } else if (b.id === 'pg-sync') sync();
  else if (b.id === 'pg-conn') connectBank();
  else if (b.id === 'pg-add') { const v = $('pg-iid').value; if (v.trim()) addItem(v); }
  else if (b.id === 'pg-push') enablePush();
  else if (b.id === 'pg-ptest') api('/push/test', { method: 'POST' }).then(r => say(r.sent ? 'Enviado para ' + r.sent + ' aparelho(s).' : 'Nenhum aparelho inscrito. Ative as notificações de novo.', !r.sent)).catch(err => say(err.message, true));
  else if (b.id === 'pg-cats') addSuggestedCats();
  else if (b.id === 'pg-cfg') { CFG.key = ''; saveCfg(); renderPg(); }
  else if (b.dataset.pg === 'del') {
    if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Confirmar?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Remover'; }, 3500); return; }
    try { await api('/items/' + b.dataset.id, { method: 'DELETE' }); const p = PW(); p.items = p.items.filter(i => i.id !== b.dataset.id); p.accounts = p.accounts.filter(a => a.itemId !== b.dataset.id); save(); renderPg(); say('Conexão removida. Os lançamentos já feitos continuam.'); } catch (err) { say(err.message, true); }
  }
});
recSec.addEventListener('change', e => {
  if (e.target.id === 'pg-auto') { PW().auto = e.target.checked; save(); }
  else if (e.target.dataset.acc) {
    const p = PW(), id = e.target.dataset.acc;
    if (!e.target.value) return;
    if (e.target.value === '__new') {
      const acc = p.accounts.find(a => a.id === id) || { id, name: 'Cartão' };
      const nm = String(acc.name || 'Cartão').replace(/\s+/g, ' ').trim().slice(0, 30);
      let c = S.cards.find(x => norm(x.name) === norm(nm));
      if (!c) { c = { id: typeof uid === 'function' ? uid() : Date.now(), name: nm }; S.cards.push(c); try { fillCards(); } catch (err) {} }
      e.target.value = String(c.id);
    }
    const card = isNaN(+e.target.value) ? e.target.value : +e.target.value;
    p.accMap[id] = card; S.rec.forEach(x => { if (x.acc === id && x.st === 'pend' && x.type === 'out') x.card = card; }); save(); render(); renderPg(); say('Cartão vinculado.');
  }
});

// ================================================================== EXTRAS
// 1) Forma de pagamento "Débito"  2) Transferências entre contas  3) Planilha de contas fixas
const XLSX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
document.head.insertAdjacentHTML('beforeend', `<style id="pgx-css">
#trc .g2{margin-top:8px}#trc select,#trc input{margin-top:8px}
#trl li{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-top:1px solid var(--ln)}#trl li:first-child{border-top:0}
#trl small{grid-column:1/-1}#trl button{border:0;background:none;color:var(--mu);text-decoration:underline;padding:0;min-height:0;font-size:.82rem;justify-self:start}
.pgx-m .mbox{max-width:440px}.pgx-m select,.pgx-m input{margin-top:8px}
#imp-tb{width:100%;border-collapse:collapse;font-size:.86rem;margin-top:8px}
#imp-tb td,#imp-tb th{padding:6px 4px;border-top:1px solid var(--ln);text-align:left;vertical-align:middle}
#imp-tb select{min-height:32px;padding:2px 6px;font-size:.82rem;width:100%}#imp-tb input[type=checkbox]{width:auto;min-height:0}
#imp-tb .du{color:var(--am);font-size:.75rem;display:block}
#impc .bk{margin-top:10px}
.lsg [aria-selected=true]{color:#fff}
</style>`);

// ---------- 1) Débito ----------
// "Cartão" no app quer dizer cartão de crédito (exige escolher o cartão). Compras no débito ganham opção própria.
if (Array.isArray(window.PAYS || (typeof PAYS !== 'undefined' && PAYS)) && !PAYS.includes('Débito')) PAYS.splice(1, 0, 'Débito');
(() => {
  const etp = $('etp');
  if (etp && ![...etp.options].some(o => o.value === 'Débito')) etp.options[0].insertAdjacentHTML('afterend', '<option>Débito</option>');
  const pix = document.querySelector('input[name=pg][value=Pix]');
  if (pix && !document.querySelector('input[name=pg][value="Débito"]')) {
    pix.closest('label').insertAdjacentHTML('afterend', '<label><input type="radio" name="pg" value="Débito">Débito</label>');
    const grp = pix.closest('.seg'); if (grp) grp.style.gridTemplateColumns = 'repeat(4,1fr)';
    const r = document.querySelector('input[name=pg][value="Débito"]');
    r.addEventListener('change', () => { try { parUI(); } catch (e) {} });
  }
})();
window.recPay = function (mv) {
  if (mv.kind === 'fatura') return 'Cartão';
  const n = norm(mv.desc || '');
  return /pix|transfer|\bted\b|\bdoc\b/.test(n) ? 'Pix' : /saque/.test(n) ? 'Dinheiro' : /debito|compra/.test(n) ? 'Débito' : 'Pix';
};
// Corrige o que já entrou como "Cartão" sem cartão (compras no débito)
(() => {
  let n = 0;
  S.tx.forEach(t => { if (t.type === 'out' && t.pay === 'Cartão' && !t.card && /debito/.test(norm(t.desc || ''))) { t.pay = 'Débito'; n++; } });
  S.rec.forEach(x => { if (x.st === 'pend' && x.kind !== 'fatura' && x.pay === 'Cartão') { x.pay = 'Débito'; n++; } });
  if (n) { save(); setTimeout(() => { try { render(); renderRec(); } catch (e) {} }, 0); }
})();

// ---------- 2) Transferências ----------
// Não contam como receita nem despesa: só registram o dinheiro mudando de lugar.
const TRF = () => (Array.isArray(S.trf) ? S.trf : (S.trf = []));
function contas() {
  const p = P(), list = [];
  const banks = p.accounts.filter(a => a.type === 'BANK');
  banks.forEach(a => {
    const dup = banks.filter(b => b.name === a.name).length > 1;
    list.push({ id: 'pg:' + a.id, name: a.name + (dup && a.number ? ' ' + String(a.number).slice(-6) : '') });
  });
  (S.cards || []).forEach(c => list.push({ id: 'card:' + c.id, name: 'Fatura do cartão ' + c.name }));
  list.push({ id: 'cash', name: 'Dinheiro (carteira)' });
  (Array.isArray(S.contas) ? S.contas : []).forEach(c => list.push({ id: 'c:' + c.id, name: c.name }));
  return list;
}
// conta do app correspondente a um pendente do Pluggy (banco → 'pg:', cartão → 'card:')
function accRef(x) {
  if (!x.acc) return '';
  const a = P().accounts.find(y => y.id === x.acc);
  if (a && a.type === 'CREDIT') { const c = P().accMap[x.acc] || x.card; return c ? 'card:' + c : ''; }
  return 'pg:' + x.acc;
}
const contaName = id => (contas().find(c => c.id === id) || {}).name || '(conta removida)';
const contaOpts = (sel, ph) => `<option value="">${ph}</option>` + contas().map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('') + '<option value="__new">+ Outra conta…</option>';
function newConta(sel) {
  const n = (prompt('Nome da conta (ex.: Poupança Caixa, Carteira digital):') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!n) { sel.value = ''; return; }
  if (!Array.isArray(S.contas)) S.contas = [];
  const c = { id: typeof uid === 'function' ? uid() : Date.now(), name: n }; S.contas.push(c); save();
  document.querySelectorAll('select[data-conta]').forEach(s => { const v = s === sel ? 'c:' + c.id : s.value; s.innerHTML = contaOpts(v, s.dataset.conta); });
}
document.addEventListener('change', e => { const s = e.target.closest && e.target.closest('select[data-conta]'); if (s && s.value === '__new') newConta(s); });

$('f').insertAdjacentHTML('afterend', `<div class="card" id="trc">
  <h2>Transferência entre contas</h2>
  <small style="display:block">Dinheiro que muda de lugar (de um banco para outro, pagamento da fatura, saque). Não entra como receita nem despesa.</small>
  <select id="tr-de" data-conta="De qual conta saiu?" aria-label="Conta de origem"></select>
  <select id="tr-pa" data-conta="Para qual conta foi?" aria-label="Conta de destino"></select>
  <div class="g2"><input id="tr-v" inputmode="decimal" placeholder="Valor" aria-label="Valor"><input id="tr-d" type="date" aria-label="Data"></div>
  <input id="tr-s" placeholder="Descrição (opcional)" aria-label="Descrição">
  <p id="tr-e" role="alert" style="color:var(--out);font-size:.88rem;min-height:1.2em;margin:6px 0 0"></p>
  <button class="go" id="tr-ok" type="button">Registrar transferência</button>
  <ul id="trl" style="margin-top:12px"></ul></div>`);
function renderTrf() {
  if (!$('trc')) return;
  ['tr-de', 'tr-pa'].forEach(id => { const s = $(id); s.innerHTML = contaOpts(s.value, s.dataset.conta); });
  if (!$('tr-d').value) $('tr-d').value = hoje();
  const l = TRF().filter(t => t.date && t.date.slice(0, 7) === m).sort((a, b) => b.date.localeCompare(a.date));
  $('trl').innerHTML = l.length ? l.map(t => `<li><span>${esc(t.fromN || contaName(t.from))} → ${esc(t.toN || contaName(t.to))}</span><b>${fmt(t.v)}</b>
    <small>${dBR(t.date)}${t.desc ? ' · ' + esc(t.desc) : ''}</small><button type="button" data-trdel="${esc(t.id)}">Excluir</button></li>`).join('')
    : '<li class="pgempty" style="display:block">Nenhuma transferência neste mês.</li>';
}
function addTrf({ from, to, v, date, desc }) {
  const t = { id: String(typeof uid === 'function' ? uid() : Date.now()), from, to, fromN: contaName(from), toN: contaName(to), v: Math.round(v * 100) / 100, date, desc: (desc || '').slice(0, 120) };
  TRF().push(t); return t;
}
$('tr-ok').addEventListener('click', () => {
  const from = $('tr-de').value, to = $('tr-pa').value, v = parse($('tr-v').value), d = $('tr-d').value, er = $('tr-e');
  if (!from || !to || from === '__new' || to === '__new') return er.textContent = 'Escolha a conta de origem e a de destino.';
  if (from === to) return er.textContent = 'A origem e o destino precisam ser diferentes.';
  if (!(v > 0)) return er.textContent = 'Digite um valor maior que zero.';
  if (!d) return er.textContent = 'Escolha a data.';
  er.textContent = ''; addTrf({ from, to, v, date: d, desc: $('tr-s').value.trim() });
  $('tr-v').value = ''; $('tr-s').value = ''; save(); renderTrf(); say('Transferência registrada.');
});
$('trl').addEventListener('click', e => {
  const b = e.target.closest('[data-trdel]'); if (!b) return;
  if (b.dataset.arm !== '1') { b.dataset.arm = '1'; b.textContent = 'Confirmar exclusão?'; setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Excluir'; }, 3500); return; }
  S.trf = TRF().filter(t => t.id !== b.dataset.trdel); save(); renderTrf();
});

// Janela para transformar um pendente ou um lançamento em transferência
document.body.insertAdjacentHTML('beforeend', `<div class="mdl pgx-m" id="trm" hidden role="dialog" aria-modal="true" aria-labelledby="trm-t"><div class="mbox">
  <h3 id="trm-t">É uma transferência entre contas</h3><p class="mi" id="trm-i"></p>
  <select id="trm-de" data-conta="De qual conta saiu?" aria-label="Conta de origem"></select>
  <select id="trm-pa" data-conta="Para qual conta foi?" aria-label="Conta de destino"></select>
  <p id="trm-e" role="alert" style="color:var(--out);font-size:.88rem;min-height:1.2em;margin:6px 0"></p>
  <button class="go" id="trm-ok" type="button">Salvar como transferência</button>
  <div class="bk"><button id="trm-c" type="button">Cancelar</button></div></div></div>`);
let trmCtx = null;
function openTrm(ctx) {
  trmCtx = ctx;
  $('trm-i').textContent = `${fmt(ctx.v)} em ${dBR(ctx.date)} · ${ctx.desc || ''}. Ela deixa de contar como ${ctx.type === 'in' ? 'receita' : 'despesa'}.`;
  $('trm-de').innerHTML = contaOpts(ctx.type === 'out' ? ctx.acc : '', $('trm-de').dataset.conta);
  $('trm-pa').innerHTML = contaOpts(ctx.type === 'in' ? ctx.acc : '', $('trm-pa').dataset.conta);
  $('trm-e').textContent = ''; $('trm').hidden = false;
}
$('trm-c').addEventListener('click', () => { $('trm').hidden = true; });
$('trm-ok').addEventListener('click', () => {
  const from = $('trm-de').value, to = $('trm-pa').value, c = trmCtx;
  if (!from || !to || from === '__new' || to === '__new') return $('trm-e').textContent = 'Escolha a origem e o destino.';
  if (from === to) return $('trm-e').textContent = 'A origem e o destino precisam ser diferentes.';
  addTrf({ from, to, v: c.v, date: c.date, desc: c.desc });
  c.done();
  // o outro lado da transferência (a entrada no outro banco), se já chegou
  const near = x => Math.abs(new Date(x.date) - new Date(c.date)) <= 3 * 864e5 && Math.abs(x.amount - c.v) < .005;
  let extra = 0;
  S.rec.forEach(x => { if (x.st === 'pend' && x.type !== c.type && near(x)) { x.st = 'done'; x.trf = 1; extra++; } });
  const twin = S.tx.find(x => x.type !== c.type && near(x) && !x.cx && !x.sid);
  if (twin && confirm(`Encontrei ${twin.type === 'in' ? 'uma entrada' : 'uma saída'} de ${fmt(twin.amount)} em ${dBR(twin.date)} ("${twin.desc}"), que parece ser o outro lado desta transferência.\n\nOK = tirar dos lançamentos também.`)) { S.tx = S.tx.filter(x => x !== twin); extra++; }
  $('trm').hidden = true; save(); render(); renderRec(); renderTrf();
  say('Salvo como transferência' + (extra ? ' (o outro lado também foi ajustado).' : '.'));
});

// Botão "Transferência" em cada pendente
const _renderRec = window.renderRec;
window.renderRec = function () {
  const r = _renderRec.apply(this, arguments);
  document.querySelectorAll('#rcl li[data-r]').forEach(li => {
    const bk = li.querySelector('.bk'); if (bk && !bk.querySelector('[data-a=trf]')) bk.insertAdjacentHTML('beforeend', '<button data-a="trf" type="button">Transferência</button>');
  });
  return r;
};
$('rcl').addEventListener('click', e => {
  const b = e.target.closest('[data-a=trf]'); if (!b) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const x = S.rec.find(v => v.id === b.closest('li').dataset.r); if (!x) return;
  openTrm({ v: x.amount, date: x.date, desc: x.desc, type: x.type, acc: accRef(x), done: () => { x.st = 'done'; x.trf = 1; } });
}, true);
// Botão no "Editar lançamento"
$('etsv').insertAdjacentHTML('afterend', '<button class="sm" id="et-trf" type="button" style="width:100%;margin-top:8px">É transferência entre contas</button>');
$('et-trf').addEventListener('click', () => {
  const t = etT; if (!t) return;
  if (t.sid || t.cx || t.res) { $('eter').textContent = 'Parcelas, caixinhas e ressarcimentos não podem virar transferência.'; return; }
  $('etm').hidden = true;
  openTrm({ v: t.amount, date: t.date, desc: t.desc, type: t.type, acc: '', done: () => { S.tx = S.tx.filter(x => x !== t); } });
});
renderTrf();

// ---------- 3) Planilha de contas fixas ----------
const IMP_HTML = `<div class="card" id="impc">
  <h2>Importar planilha de contas fixas</h2>
  <small style="display:block">Para o que não cai sozinho no banco nem no cartão (boleto, aluguel, condomínio, escola…). Cada linha vira um compromisso que se repete todo mês, entra na Previsão e gera aviso no celular antes do vencimento.</small>
  <small style="display:block;margin-top:6px">Colunas reconhecidas: <b>Descrição</b>, <b>Valor</b>, <b>Dia</b> (ou data do vencimento), <b>Categoria</b> e, se quiser, <b>Repete</b> (sim/não).</small>
  <div class="bk"><label for="imp-f" class="go" style="display:flex;align-items:center;justify-content:center;cursor:pointer">Escolher planilha</label><button id="imp-mod" type="button">Baixar modelo</button></div>
  <input id="imp-f" type="file" accept=".xlsx,.xls,.csv,.ods,text/csv" class="sr" style="position:absolute;width:1px;height:1px;opacity:0">
</div>`;
const _renderCpv = window.renderCpv;
window.renderCpv = function () { const r = _renderCpv.apply(this, arguments); if (!$('impc')) $('cpv').insertAdjacentHTML('beforeend', IMP_HTML); return r; };
document.addEventListener('click', e => {
  if (!e.target.closest('#imp-mod')) return;
  const csv = '﻿Descrição;Valor;Dia do vencimento;Categoria;Repete todo mês\nAluguel;1500,00;10;Casa;sim\nCondomínio;450,00;5;Casa;sim\nInternet;119,90;15;Casa;sim\nEscola de inglês;350,00;20;Estudo;sim\nIPVA (cota única);850,00;20/01/2027;Transporte;não\n';
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'modelo-contas-fixas.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'imp-f') return;
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const rows = await readSheet(f); openImp(parseFixas(rows)); }
  catch (err) { say('Não consegui ler a planilha: ' + err.message, true); }
});
function loadXlsx() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((ok, no) => { const s = document.createElement('script'); s.src = XLSX_JS; s.onload = ok; s.onerror = () => no(new Error('sem internet para abrir .xlsx; salve como CSV e tente de novo')); document.head.appendChild(s); });
}
async function readSheet(f) {
  if (/\.csv$/i.test(f.name) || f.type === 'text/csv') return csvRows((await readTxt(f)).replace(/^﻿/, ''));
  await loadXlsx();
  const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
}
function parseFixas(rows) {
  rows = rows.filter(r => r && r.some(c => String(c).trim()));
  const hi = rows.findIndex(r => r.some(c => /descri|nome|conta|item|despesa|gasto|compromisso/.test(norm(c))) && r.some(c => /valor|preco|quantia|montante|r\$/.test(norm(c))));
  if (hi < 0) throw new Error('não achei as colunas Descrição e Valor. Use o modelo.');
  const H = rows[hi].map(c => norm(c)), ix = re => H.findIndex(h => re.test(h));
  const cN = ix(/descri|nome|conta|item|despesa|gasto|compromisso/), cV = ix(/valor|preco|quantia|montante|r\$/), cD = ix(/dia|venc|data/),
    cC = ix(/categ/), cR = ix(/repet|mensal|recorr|fixo|todo mes/);
  const out = [], mes = hoje().slice(0, 7);
  rows.slice(hi + 1).forEach(r => {
    const n = String(r[cN] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60); if (!n) return;
    const rawV = r[cV]; const v = Math.round(Math.abs(typeof rawV === 'number' ? rawV : pnum(rawV)) * 100) / 100; if (!(v > 0)) return;
    let day = 0, date = '';
    const rd = cD >= 0 ? r[cD] : '';
    if (rd instanceof Date && !isNaN(rd)) date = new Date(rd.getTime() - rd.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    else if (typeof rd === 'number' && rd > 31) { const d = new Date(Math.round((rd - 25569) * 864e5)); date = d.toISOString().slice(0, 10); }
    else if (/^\s*\d{1,2}\s*$/.test(String(rd))) day = Math.min(31, Math.max(1, parseInt(rd, 10)));
    else if (String(rd).trim()) date = toISO(String(rd));
    if (date) day = +date.slice(8, 10);
    // sem a coluna "Repete", tudo é tratado como conta fixa mensal
    const rep = cR >= 0 && String(r[cR]).trim() ? !/^(n|nao|no|0|false|unica)/.test(norm(r[cR])) : true;
    const catTxt = cC >= 0 ? String(r[cC] || '').trim() : '';
    let c = catTxt && CATS.out.find(x => norm(x) === norm(catTxt));
    if (!c && catTxt) c = catTxt.slice(0, 30);                          // categoria nova da planilha
    if (!c) c = mapCat(n, 'out') || (CATS.out.includes('Casa') ? 'Casa' : CATS.out.find(x => x !== 'Caixinhas') || 'Outros');
    const dup = rep ? (S.cfix || []).some(x => !x.to && norm(x.n) === norm(n)) : (S.comp || []).some(x => norm(x.n) === norm(n) && x.d === date);
    out.push({ n, v, day, date, rep: rep || !date, c, from: date ? date.slice(0, 7) : mes, dup, on: !dup });
  });
  if (!out.length) throw new Error('nenhuma linha com descrição e valor.');
  return out;
}
document.body.insertAdjacentHTML('beforeend', `<div class="mdl pgx-m" id="impm" hidden role="dialog" aria-modal="true" aria-labelledby="impm-t"><div class="mbox" style="max-width:560px">
  <h3 id="impm-t">Contas fixas da planilha</h3><p class="mi" id="impm-i"></p>
  <div style="max-height:52vh;overflow:auto"><table id="imp-tb"></table></div>
  <button class="go" id="impm-ok" type="button" style="margin-top:12px">Criar compromissos</button>
  <div class="bk"><button id="impm-c" type="button">Cancelar</button></div></div></div>`);
let IMP = [];
function openImp(list) {
  IMP = list;
  const cats = [...new Set([...CATS.out.filter(c => c !== 'Caixinhas'), ...list.map(x => x.c)])];
  $('impm-i').textContent = `${list.length} linha(s) encontrada(s). Confira a categoria e desmarque o que não quiser.${list.some(x => x.dup) ? ' As marcadas como "já existe" ficaram desmarcadas.' : ''}`;
  $('imp-tb').innerHTML = '<tr><th></th><th>Conta</th><th>Valor</th><th>Venc.</th><th>Categoria</th></tr>' + list.map((x, i) => `<tr>
    <td><input type="checkbox" data-i="${i}" ${x.on ? 'checked' : ''} aria-label="Importar ${esc(x.n)}"></td>
    <td>${esc(x.n)}${x.dup ? '<span class="du">já existe</span>' : ''}</td><td>${fmt(x.v)}</td>
    <td>${x.rep ? 'dia ' + (x.day || '—') + ' <small>todo mês</small>' : dBR(x.date) + '/' + x.date.slice(2, 4)}</td>
    <td><select data-c="${i}" aria-label="Categoria de ${esc(x.n)}">${cats.map(c => `<option${c === x.c ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></td></tr>`).join('');
  $('impm').hidden = false;
}
$('imp-tb').addEventListener('change', e => {
  if (e.target.dataset.i !== undefined) IMP[+e.target.dataset.i].on = e.target.checked;
  if (e.target.dataset.c !== undefined) IMP[+e.target.dataset.c].c = e.target.value;
});
$('impm-c').addEventListener('click', () => { $('impm').hidden = true; });
$('impm-ok').addEventListener('click', () => {
  const sel = IMP.filter(x => x.on); if (!sel.length) { $('impm').hidden = true; return; }
  if (!Array.isArray(S.cfix)) S.cfix = []; if (!Array.isArray(S.comp)) S.comp = [];
  sel.forEach(x => {
    if (x.c && !CATS.out.includes(x.c)) CATS.out.push(x.c);
    const id = typeof uid === 'function' ? uid() : Date.now() + Math.random();
    if (x.rep) S.cfix.push({ id, n: x.n, v: x.v, c: x.c, day: x.day || 0, from: x.from });
    else S.comp.push({ id, n: x.n, v: x.v, c: x.c, d: x.date, m: x.date.slice(0, 7), st: 'a', rep: 0 });
  });
  if (S.cats && S.cats.out !== CATS.out) S.cats.out = CATS.out;
  $('impm').hidden = true; save(); try { fillCats(); } catch (e) {} render(); try { renderCpv(); } catch (e) {}
  say(sel.length + ' compromisso(s) criado(s). Eles aparecem em Compromissos e na Previsão.');
});
// redesenha a lista de transferências quando o mês muda
const _render2 = window.render;
window.render = function () { const r = _render2.apply(this, arguments); try { renderTrf(); } catch (e) {} return r; };


// ------------------------------------------------------------------ início
renderPg();
const q = new URLSearchParams(location.search).get('pluggy');
if (q) history.replaceState(null, '', location.pathname + location.hash);
if (q === 'painel') showPanel(); else if (q === 'open') goTab('rec');
const stale = () => !P().lastSync || Date.now() - new Date(P().lastSync) > 2 * 3600e3;
if (ready() && (q === 'sync' || stale())) setTimeout(() => sync({ fromPush: q === 'sync' }), 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready() && stale()) sync(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (e.data && e.data.type === 'pluggy-open') { if (e.data.q === 'painel') showPanel(); else if (e.data.q === 'open') goTab('rec'); if (e.data.q === 'sync' && ready()) sync({ fromPush: true }); }
});
window.caixaPluggy = { sync, connectBank, addItem, enablePush, forecast, mapCat };
})();
