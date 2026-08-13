/* ============================================================
   HISBA — CHARTS (Pure Canvas, no deps)
   ============================================================ */
import { formatCurrency, getLanguage, t } from '../utils.js?v=security-audit-v1';

function getStyle(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// ── Bar Chart ──────────────────────────────────────────────
export function drawBarChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  // Reserve two separate rows at the bottom: one for months and one for the legend.
  const pad = { top: 24, right: 16, bottom: 76, left: 60 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const primaryClr = '#0a0a0a';
  const inkClr = getStyle('--clr-ink') || '#0a0a0a';
  const borderClr = getStyle('--clr-border') || '#e5e5e5';
  const bodyClr = getStyle('--clr-body-mid') || '#6a6a6a';
  const successClr = '#22c55e';
  const canvasBg = getStyle('--clr-canvas-soft') || '#faf5e8';

  ctx.clearRect(0, 0, W, H);

  const maxVal = Math.max(...data.map(d => Math.max(d.income || 0, d.expenses || 0)), 1);
  const yStep = Math.ceil(maxVal / 4);

  // Grid lines
  ctx.strokeStyle = borderClr;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH - (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = bodyClr;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(abbreviate(i * yStep), pad.left - 6, y + 4);
  }

  const n = data.length;
  const groupW = chartW / n;
  const barW = Math.min(groupW * 0.3, 20);

  data.forEach((d, i) => {
    const gx = pad.left + i * groupW + groupW / 2;

    // Income bar
    const incomeH = ((d.income || 0) / maxVal) * chartH;
    ctx.fillStyle = successClr;
    ctx.beginPath();
    ctx.roundRect(gx - barW - 2, pad.top + chartH - incomeH, barW, incomeH, [3, 3, 0, 0]);
    ctx.fill();

    // Expense bar
    const expenseH = ((d.expenses || 0) / maxVal) * chartH;
    ctx.fillStyle = primaryClr;
    ctx.beginPath();
    ctx.roundRect(gx + 2, pad.top + chartH - expenseH, barW, expenseH, [3, 3, 0, 0]);
    ctx.fill();

    // Month label
    ctx.fillStyle = bodyClr;
    ctx.font = '11px Arial, sans-serif';
    ctx.textAlign = 'center';
    // Month labels stay above the dedicated legend row.
    ctx.fillText(localizeMonth(d.month), gx, H - 38);
  });

  // Legend — centered, collision-free, and RTL-aware.
  // Legend gets its own row below the month labels.
  const ly = H - 10;
  const ar = getLanguage().startsWith('ar');
  const incomeLabel = t('income') || (ar ? 'الدخل' : 'Income');
  const expenseLabel = t('expense') || (ar ? 'المصروف' : 'Expenses');
  ctx.font = '600 11px Cairo, Arial, sans-serif';
  const items = ar
    ? [{ label: expenseLabel, color: primaryClr }, { label: incomeLabel, color: successClr }]
    : [{ label: incomeLabel, color: successClr }, { label: expenseLabel, color: primaryClr }];
  const itemGap = 28;
  const itemWidths = items.map(item => Math.max(62, ctx.measureText(item.label).width + 24));
  const legendWidth = itemWidths.reduce((sum, width) => sum + width, 0) + itemGap;
  let x = Math.max(12, (W - legendWidth) / 2);

  items.forEach((item, index) => {
    const itemWidth = itemWidths[index];
    const swatchX = x;
    const textX = x + 20;
    ctx.fillStyle = item.color;
    ctx.fillRect(swatchX, ly - 9, 12, 9);
    ctx.fillStyle = bodyClr;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, textX, ly);
    x += itemWidth + (index === items.length - 1 ? 0 : itemGap);
  });
}

// ── Donut Chart ────────────────────────────────────────────
export function drawDonutChart(canvasId, data, centerLabel = '') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  ctx.clearRect(0, 0, W, H);

  if (!data.length) {
    ctx.fillStyle = getStyle('--clr-border') || '#e0d9cf';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getStyle('--clr-canvas') || '#fffefb';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.min(W, H) / 2 - 48, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = W / 2;
  const cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 12;
  const innerR = outerR * 0.62;
  const gap = 0.025;

  let startAngle = -Math.PI / 2;

  data.forEach(item => {
    const slice = (item.value / total) * (Math.PI * 2) - gap;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    startAngle += slice + gap;
  });

  // Inner circle (hole)
  const canvasBg = getStyle('--clr-canvas') || '#fffefb';
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = canvasBg;
  ctx.fill();

  // Center label — compact two-line layout to avoid currency collisions
  if (centerLabel) {
    const maxWidth = Math.max(54, innerR * 1.55);
    let amountText = String(centerLabel);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px Arial, sans-serif';
    while (ctx.measureText(amountText).width > maxWidth && amountText.length > 6) amountText = `${amountText.slice(0, -2)}…`;
    ctx.fillStyle = getStyle('--clr-ink') || '#201515';
    ctx.fillText(amountText, cx, cy - 7);
    ctx.font = '500 10px Arial, sans-serif';
    ctx.fillStyle = getStyle('--clr-body-mid') || '#939084';
    ctx.fillText(getLanguage().startsWith('ar') ? 'الإجمالي' : 'Total', cx, cy + 11);
  }
}

// ── Line Chart ─────────────────────────────────────────────
export function drawLineChart(canvasId, data, color = '#ff4f00') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 16, right: 16, bottom: 32, left: 52 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const values = data.map(d => d.value);
  const maxVal = Math.max(...values, 1);
  const borderClr = getStyle('--clr-border') || '#e5e5e5';
  const bodyClr = getStyle('--clr-body-mid') || '#6a6a6a';

  // Grid
  ctx.strokeStyle = borderClr;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (i / 4) * chartH;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y);
    ctx.stroke();
    ctx.fillStyle = bodyClr;
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(abbreviate(((4 - i) / 4) * maxVal), pad.left - 4, y + 3);
  }

  if (data.length < 2) return;

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * chartW,
    y: pad.top + (1 - d.value / maxVal) * chartH,
  }));

  // Fill gradient
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
  grad.addColorStop(0, color + '30');
  grad.addColorStop(1, color + '00');
  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.top + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, pad.top + chartH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const cp1x = (points[i - 1].x + points[i].x) / 2;
    ctx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Dots
  points.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = getStyle('--clr-canvas') || '#fff';
    ctx.fill();
  });

  // Labels
  data.forEach((d, i) => {
    ctx.fillStyle = bodyClr;
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(d.label || '', points[i].x, H - 6);
  });
}

function localizeMonth(value) {
  if (!getLanguage().startsWith('ar')) return value;
  const months = { Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل', May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس', Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر' };
  return months[value] || value;
}

function abbreviate(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return Math.round(n).toString();
}
