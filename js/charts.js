// Schlanke SVG Diagramme mit Fadenkreuz und Antippen für Werte

import { fmtNum, fmtShort } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';

function niceTicks(min, max, count = 4) {
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    min -= pad; max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  parent?.appendChild(n);
  return n;
}

function tooltip(container) {
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.innerHTML = '<strong></strong><span></span>';
  container.appendChild(tip);
  return {
    show(x, y, value, label) {
      tip.firstChild.textContent = value;
      tip.lastChild.textContent = label;
      tip.classList.add('on');
      const w = tip.offsetWidth;
      const cw = container.clientWidth;
      tip.style.left = Math.min(cw - w, Math.max(0, x - w / 2)) + 'px';
      tip.style.top = Math.max(0, y - tip.offsetHeight - 12) + 'px';
    },
    hide() { tip.classList.remove('on'); },
  };
}

// Liniendiagramm über die Zeit. points: [{t, v}]
export function lineChart(container, points, { unit = '', height = 190, fmt = fmtNum } = {}) {
  container.innerHTML = '';
  container.classList.add('chart');
  const W = container.clientWidth || 320;
  const H = height;
  const m = { l: 40, r: 18, t: 16, b: 26 };
  if (!points.length) {
    container.innerHTML = '<p class="muted center pad">Noch keine Daten.</p>';
    return;
  }
  const vals = points.map((p) => p.v);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks.at(-1);
  const t0 = points[0].t, t1 = points.at(-1).t;
  const X = (t) => (t1 === t0 ? m.l + (W - m.l - m.r) / 2 : m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r));
  const Y = (v) => m.t + (1 - (v - y0) / (y1 - y0 || 1)) * (H - m.t - m.b);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
  for (const v of ticks) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    const tx = el('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    tx.textContent = fmtNum(v);
  }
  // Datumsbeschriftung: Anfang und Ende
  const labels = points.length > 1 ? [points[0], points.at(-1)] : [points[0]];
  labels.forEach((p, i) => {
    const tx = el('text', { x: X(p.t), y: H - 6, class: 'tick', 'text-anchor': points.length > 1 ? (i ? 'end' : 'start') : 'middle' }, svg);
    tx.textContent = fmtShort(p.t);
  });

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  if (points.length > 1) {
    el('path', { d: `${d}L${X(t1)},${H - m.b}L${X(t0)},${H - m.b}Z`, class: 'area' }, svg);
    el('path', { d, class: 'line' }, svg);
  }
  for (const p of points) el('circle', { cx: X(p.t), cy: Y(p.v), r: 4, class: 'dot' }, svg);
  const last = points.at(-1);
  const endLabel = el('text', { x: X(last.t), y: Y(last.v) - 10, class: 'end-label', 'text-anchor': points.length > 1 ? 'end' : 'middle' }, svg);
  endLabel.textContent = `${fmt(last.v)}${unit ? ' ' + unit : ''}`;

  const cross = el('line', { y1: m.t, y2: H - m.b, class: 'cross' }, svg);
  const hi = el('circle', { r: 6, class: 'dot hi' }, svg);
  container.appendChild(svg);
  const tip = tooltip(container);

  const move = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = points[0];
    for (const p of points) if (Math.abs(X(p.t) - x) < Math.abs(X(best.t) - x)) best = p;
    const px = X(best.t), py = Y(best.v);
    cross.setAttribute('x1', px); cross.setAttribute('x2', px);
    hi.setAttribute('cx', px); hi.setAttribute('cy', py);
    svg.classList.add('active');
    tip.show(px, py, `${fmt(best.v)}${unit ? ' ' + unit : ''}`, best.label ?? fmtShort(best.t));
  };
  const leave = () => { svg.classList.remove('active'); tip.hide(); };
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerleave', leave);
  svg.addEventListener('pointercancel', leave);
}

// Säulendiagramm, z. B. Trainings pro Woche. bars: [{label, v, tip}]
export function columnChart(container, bars, { height = 160, unit = '' } = {}) {
  container.innerHTML = '';
  container.classList.add('chart');
  const W = container.clientWidth || 320;
  const H = height;
  const m = { l: 28, r: 8, t: 14, b: 24 };
  const max = Math.max(2, ...bars.map((b) => b.v));
  const ticks = [];
  for (let v = 0; v <= max; v += Math.max(1, Math.ceil(max / 4))) ticks.push(v);
  const top = Math.max(max, ticks.at(-1));
  const Y = (v) => m.t + (1 - v / top) * (H - m.t - m.b);
  const slot = (W - m.l - m.r) / bars.length;
  const bw = Math.min(24, slot - 2);

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img' });
  for (const v of ticks) {
    el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }, svg);
    const tx = el('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    tx.textContent = fmtNum(v);
  }
  const tip = tooltip(container);
  bars.forEach((b, i) => {
    const cx = m.l + slot * i + slot / 2;
    const x = cx - bw / 2;
    const yTop = Y(b.v), yBase = Y(0);
    const g = el('g', { class: 'bar-g' }, svg);
    el('rect', { x: m.l + slot * i, y: m.t, width: slot, height: H - m.t - m.b, class: 'hit' }, g);
    if (b.v > 0) {
      const r = Math.min(4, yBase - yTop);
      el('path', { d: `M${x},${yBase}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + bw - r}Q${x + bw},${yTop} ${x + bw},${yTop + r}V${yBase}Z`, class: 'bar' + (b.current ? ' current' : '') }, g);
    }
    if (b.label && (bars.length - 1 - i) % Math.ceil(bars.length / 5) === 0) {
      const tx = el('text', { x: cx, y: H - 6, class: 'tick', 'text-anchor': 'middle' }, svg);
      tx.textContent = b.label;
    }
    const show = () => {
      svg.querySelectorAll('.bar-g.on').forEach((n) => n.classList.remove('on'));
      g.classList.add('on');
      tip.show(cx, yTop, `${fmtNum(b.v)}${unit ? ' ' + unit : ''}`, b.tip ?? b.label);
    };
    g.addEventListener('pointerdown', show);
    g.addEventListener('pointerenter', show);
  });
  svg.addEventListener('pointerleave', () => { svg.querySelectorAll('.bar-g.on').forEach((n) => n.classList.remove('on')); tip.hide(); });
  container.appendChild(svg);
}

// Waagerechte Balken mit Zielbereich, z. B. Sätze je Muskelgruppe
export function rangeBars(rows, { scaleMax } = {}) {
  const max = scaleMax ?? Math.max(22, ...rows.map((r) => r.value + 2));
  const pct = (v) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;
  return `<div class="rbars">${rows
    .map(
      (r) => `<div class="rbar">
        <div class="rbar-label">${r.label}</div>
        <div class="rbar-track">
          <div class="rbar-band" style="left:${pct(r.min)};width:calc(${pct(r.max)} - ${pct(r.min)})"></div>
          <div class="rbar-fill" style="width:${pct(r.value)}"></div>
        </div>
        <div class="rbar-val">${fmtNum(Math.round(r.value * 2) / 2)}${r.flag ? ` <span class="flag ${r.flag}">${r.flag === 'low' ? '↓' : '↑'}</span>` : ''}</div>
      </div>`,
    )
    .join('')}</div>`;
}
