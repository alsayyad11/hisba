/* ============================================================
   HISBA — EXPORT SERVICE
   PDF, CSV, Excel exports
   ============================================================ */
import { formatCurrency, formatDate, t, getLanguage, isRTL } from '../utils.js?v=release-2.3.0';

// ── Export helpers ──────────────────────────────────────────
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

function exportName(item, language = getLanguage()) {
  if (!item) return '';
  return language.startsWith('ar') && item.name_ar ? item.name_ar : (item.name || '');
}

function spreadsheetSafe(value) {
  const text = String(value ?? '');
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function safePrintableTransaction(tx = {}) {
  const safeType = tx.type === 'income' || tx.type === 'expense' ? tx.type : 'expense';
  const safeAmount = Number.isFinite(Number(tx.amount)) ? Number(tx.amount) : 0;
  const safeItem = item => item ? { ...item, name: escapeHtml(item.name || ''), name_ar: escapeHtml(item.name_ar || ''), currency: String(item.currency || '').replace(/[^A-Z]/g, '').slice(0, 3) } : null;
  return {
    ...tx,
    type: safeType,
    amount: safeAmount,
    description: escapeHtml(tx.description || '—'),
    notes: escapeHtml(tx.notes || ''),
    status: escapeHtml(tx.status || ''),
    category: safeItem(tx.category),
    account: safeItem(tx.account),
  };
}

function exportRow(tx) {
  const language = getLanguage();
  return {
    date: tx.date ? formatDate(tx.date, 'medium') : '',
    description: tx.description || '',
    type: tx.type === 'income' ? (language === 'ar' ? 'دخل' : 'Income') : (language === 'ar' ? 'مصروف' : 'Expense'),
    category: exportName(tx.category, language),
    account: exportName(tx.account, language),
    amount: Number(tx.amount || 0),
    currency: tx.account?.currency || 'EGP',
    status: tx.status || '',
    notes: tx.notes || '',
  };
}

// ── CSV Export ─────────────────────────────────────────────
export function exportCSV(transactions, filename = 'Hisbba-transactions') {
  const arabic = getLanguage().startsWith('ar');
  const headers = arabic
    ? ['التاريخ', 'الوصف', 'النوع', 'الفئة', 'الحساب', 'المبلغ', 'الحالة', 'ملاحظات']
    : ['Date', 'Description', 'Type', 'Category', 'Account', 'Amount', 'Status', 'Notes'];
  const quote = value => `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
  const rows = transactions.map(tx => {
    const row = exportRow(tx);
    return [row.date, row.description, row.type, row.category, row.account, row.amount.toFixed(2), row.status, row.notes].map(quote);
  });
  const csv = '\ufeff' + [headers, ...rows].map(row => row.join(',')).join('\r\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

// ── Excel Export ───────────────────────────────────────────
export function exportExcel(transactions, summary, filename = 'Hisbba-report', categories = []) {
  const arabic = getLanguage().startsWith('ar');
  const currency = summary.currency || 'EGP';
  const amount = value => Number(value || 0).toFixed(2);
  const label = (ar, en) => arabic ? ar : en;
  const rows = transactions.map(exportRow);
  const categoryRows = (categories || []).map(cat => `<tr><td>${escapeHtml(spreadsheetSafe(exportName(cat)))}</td><td class="number">${amount(cat.total)}</td><td>${escapeHtml(currency)}</td></tr>`).join('');
  const transactionRows = rows.map(row => `<tr>
    <td>${escapeHtml(spreadsheetSafe(row.date))}</td><td>${escapeHtml(spreadsheetSafe(row.description))}</td><td>${escapeHtml(spreadsheetSafe(row.type))}</td>
    <td>${escapeHtml(spreadsheetSafe(row.category || '—'))}</td><td>${escapeHtml(spreadsheetSafe(row.account || '—'))}</td>
    <td class="number ${row.type === (arabic ? 'دخل' : 'Income') ? 'income' : 'expense'}">${row.type === (arabic ? 'دخل' : 'Income') ? '+' : '-'}${amount(row.amount)}</td>
    <td>${escapeHtml(spreadsheetSafe(row.currency || currency))}</td><td>${escapeHtml(spreadsheetSafe(row.status || '—'))}</td><td>${escapeHtml(spreadsheetSafe(row.notes || '—'))}</td>
  </tr>`).join('');
  const html = `<!doctype html><html lang="${arabic ? 'ar' : 'en'}" dir="${arabic ? 'rtl' : 'ltr'}">
  <head><meta charset="UTF-8"><style>
    *{box-sizing:border-box}body{font-family:Cairo,Tahoma,Arial,sans-serif;color:#201515;background:#fff;padding:28px;direction:${arabic ? 'rtl' : 'ltr'}}
    h1{font-size:22px;margin:0 0 4px;color:#0f766e}h2{font-size:15px;margin:26px 0 8px;color:#201515}.meta{color:#6b625a;font-size:12px;margin-bottom:18px}
    table{border-collapse:collapse;width:100%;margin-bottom:18px}th{background:#0f766e;color:#fff;font-weight:700}th,td{padding:9px 10px;border:1px solid #d9d3cc;text-align:${arabic ? 'right' : 'left'};vertical-align:middle}tbody tr:nth-child(even){background:#faf8f5}.number{mso-number-format:'0.00';direction:ltr;text-align:right}.income{color:#16803c;font-weight:700}.expense{color:#b4233f;font-weight:700}.summary td:first-child{font-weight:700;background:#f3efea}
    @media print{body{padding:14px}table{page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}}
  </style></head><body>
    <h1>حِسبة — يا ترى فلوسي راحت فين؟</h1><div class="meta">${escapeHtml(label('تقرير المصروفات', 'Expense report'))} · ${new Date().toLocaleDateString(arabic ? 'ar-EG' : 'en-US')}</div>
    <table class="summary"><tr><th>${label('المؤشر','Metric')}</th><th>${label('القيمة','Value')}</th><th>${label('العملة','Currency')}</th></tr>
      <tr><td>${label('إجمالي الدخل','Total income')}</td><td class="number income">${amount(summary.income)}</td><td>${escapeHtml(currency)}</td></tr>
      <tr><td>${label('إجمالي المصروفات','Total expenses')}</td><td class="number expense">${amount(summary.expenses)}</td><td>${escapeHtml(currency)}</td></tr>
      <tr><td>${label('صافي الرصيد','Net balance')}</td><td class="number">${amount(summary.net ?? (Number(summary.income || 0) - Number(summary.expenses || 0)))}</td><td>${escapeHtml(currency)}</td></tr>
      <tr><td>${label('عدد المعاملات','Transactions')}</td><td class="number">${rows.length}</td><td>—</td></tr></table>
    <h2>${label('الإنفاق حسب الفئة','Expenses by category')}</h2><table><tr><th>${label('الفئة','Category')}</th><th>${label('الإجمالي','Total')}</th><th>${label('العملة','Currency')}</th></tr>${categoryRows || `<tr><td colspan="3">${label('لا توجد بيانات','No data')}</td></tr>`}</table>
    <h2>${label('تفاصيل المعاملات','Transactions')}</h2><table><thead><tr><th>${label('التاريخ','Date')}</th><th>${label('الوصف','Description')}</th><th>${label('النوع','Type')}</th><th>${label('الفئة','Category')}</th><th>${label('الحساب','Account')}</th><th>${label('المبلغ','Amount')}</th><th>${label('العملة','Currency')}</th><th>${label('الحالة','Status')}</th><th>${label('ملاحظات','Notes')}</th></tr></thead><tbody>${transactionRows}</tbody></table>
  </body></html>`;
  downloadFile(html, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
}

// ── PDF Export ─────────────────────────────────────────────
export function exportPDF(data, template = 'minimal') {
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF'); return; }

  const { transactions = [], summary = {}, period = '', accounts = [] } = data;
  const safeTransactions = transactions.map(safePrintableTransaction);
  const currency = /^[A-Z]{3}$/.test(summary.currency || '') ? summary.currency : 'EGP';
  const safeSummary = {
    ...summary,
    income: Number.isFinite(Number(summary.income)) ? Number(summary.income) : 0,
    expenses: Number.isFinite(Number(summary.expenses)) ? Number(summary.expenses) : 0,
    net: Number.isFinite(Number(summary.net)) ? Number(summary.net) : undefined,
    currency,
  };
  const safePeriod = escapeHtml(period);
  const rtl = isRTL();
  const dir = rtl ? 'rtl' : 'ltr';

  const templates = {
    minimal:   buildMinimalTemplate(safeTransactions, safeSummary, safePeriod, currency, dir),
    corporate: buildCorporateTemplate(safeTransactions, safeSummary, safePeriod, currency, dir),
    modern:    buildModernTemplate(safeTransactions, safeSummary, safePeriod, currency, dir),
    dark:      buildDarkTemplate(safeTransactions, safeSummary, safePeriod, currency, dir),
  };

  const html = (templates[template] || templates.minimal).replace(/<img\s+src="assets\/hisba-logo\.png"[^>]*>/g, '');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function buildMinimalTemplate(transactions, summary, period, currency, dir) {
  return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>Hisbba — Financial Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; color: #201515; background: #fff; padding: 40px; font-size: 13px; direction: ${dir}; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #e0d9cf; }
  .brand { display:flex; align-items:center; gap:10px; font-size:24px; font-weight:700; color:#201515; letter-spacing:-0.5px; }
  .brand img { width:38px; height:38px; object-fit:contain; }
  .brand span { color:#0a0a0a; }
  .report-meta { text-align: right; color: #605d52; font-size: 12px; }
  h2 { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
  .period { color: #605d52; font-size: 12px; margin-bottom: 32px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
  .summary-card { background: #f8f4f0; border-radius: 8px; padding: 16px; }
  .summary-label { font-size: 11px; color: #939084; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .summary-value { font-size: 20px; font-weight: 700; color: #201515; }
  .income-value { color: #22c55e; }
  .expense-value { color: #ff4d8b; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  th { font-size: 11px; font-weight: 600; color: #939084; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 12px; border-bottom: 2px solid #e0d9cf; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
  td { padding: 10px 12px; border-bottom: 1px solid #f2ede5; font-size: 12px; color: #2f2a26; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
  tr:last-child td { border-bottom: none; }
  .type-income { color: #22c55e; font-weight: 600; }
  .type-expense { color: #ff4d8b; font-weight: 600; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e0d9cf; text-align: center; color: #939084; font-size: 11px; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand"><img src="assets/hisba-logo.png" alt="Hisbba"><span>حِسبة</span></div>
      <div style="color:#605d52;font-size:12px;margin-top:4px;">Where did my money go?</div>
    </div>
    <div class="report-meta">
      <div style="font-weight:600;font-size:14px;">Financial Report</div>
      <div>${period}</div>
      <div>Generated: ${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Total Income</div>
      <div class="summary-value income-value">${formatCurrency(summary.income || 0, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Expenses</div>
      <div class="summary-value expense-value">${formatCurrency(summary.expenses || 0, currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Net Savings</div>
      <div class="summary-value">${formatCurrency((summary.income || 0) - (summary.expenses || 0), currency)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Transactions</div>
      <div class="summary-value">${transactions.length}</div>
    </div>
  </div>
  <h2>Transaction Details</h2>
  <p class="period">${period}</p>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${transactions.map(tx => `
        <tr>
          <td>${formatDate(tx.date, 'medium')}</td>
          <td>${tx.description || '—'}</td>
          <td>${tx.category?.name || '—'}</td>
          <td>${tx.account?.name || '—'}</td>
          <td class="type-${tx.type}">${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</td>
          <td class="type-${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">Generated by Hisbba • ${new Date().toLocaleDateString()} • Hisbba.app</div>
</body>
</html>`;
}

function buildCorporateTemplate(transactions, summary, period, currency, dir) {
  return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>Hisbba — Corporate Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; color: #201515; background: #fff; font-size: 13px; direction: ${dir}; }
  .top-bar { background: #201515; color: #fffefb; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
  .brand { display:flex; align-items:center; gap:10px; font-size:22px; font-weight:700; letter-spacing:-0.5px; }
  .brand img { width:36px; height:36px; object-fit:contain; }
  .brand span { color:#0a0a0a; }
  .report-info { text-align: right; font-size: 12px; opacity: 0.8; }
  .content { padding: 40px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #0a0a0a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #0a0a0a; }
  .summary-row { display: flex; gap: 16px; margin-bottom: 40px; }
  .summary-item { flex: 1; background: #f8f4f0; border-radius: 6px; padding: 20px; border-left: 4px solid #201515; }
  .summary-label { font-size: 11px; color: #939084; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .summary-value { font-size: 22px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #201515; color: #f8f4f0; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 14px; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
  td { padding: 10px 14px; border-bottom: 1px solid #f2ede5; font-size: 12px; }
  tr:nth-child(even) { background: #fafafa; }
  .amount-income { color: #22c55e; font-weight: 700; }
  .amount-expense { color: #ff4d8b; font-weight: 700; }
  .footer { margin-top: 40px; padding: 16px 40px; background: #f8f4f0; text-align: center; color: #939084; font-size: 11px; }
  @media print { body { font-size: 12px; } }
</style>
</head>
<body>
  <div class="top-bar">
    <div class="brand"><img src="assets/hisba-logo.png" alt="Hisbba"><span>حِسبة</span></div>
    <div class="report-info">
      <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Corporate Financial Report</div>
      <div>${period}</div>
    </div>
  </div>
  <div class="content">
    <div class="section-title">Financial Summary</div>
    <div class="summary-row">
      <div class="summary-item">
        <div class="summary-label">Total Income</div>
        <div class="summary-value" style="color:#22c55e">${formatCurrency(summary.income || 0, currency)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Expenses</div>
        <div class="summary-value" style="color:#ff4d8b">${formatCurrency(summary.expenses || 0, currency)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Net Balance</div>
        <div class="summary-value">${formatCurrency((summary.income || 0) - (summary.expenses || 0), currency)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Total Transactions</div>
        <div class="summary-value">${transactions.length}</div>
      </div>
    </div>
    <div class="section-title">Transaction Ledger</div>
    <table>
      <thead>
        <tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td>${formatDate(tx.date)}</td>
            <td>${tx.description || '—'}</td>
            <td>${tx.category?.name || '—'}</td>
            <td>${tx.account?.name || '—'}</td>
            <td>${tx.type}</td>
            <td class="amount-${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="footer">Hisbba Financial Report — ${period} — Generated ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
}

function buildModernTemplate(transactions, summary, period, currency, dir) {
  return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>Hisbba — Modern Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; background: #fffefb; color: #201515; font-size: 13px; direction: ${dir}; }
  .hero { background: linear-gradient(135deg, #201515 0%, #2f2a26 100%); color: #fffefb; padding: 48px 40px 40px; }
  .hero-brand { display:flex; align-items:center; gap:10px; font-size:28px; font-weight:800; letter-spacing:-1px; margin-bottom:24px; }
  .hero-brand img { width:46px; height:46px; object-fit:contain; }
  .hero-brand span { color:#0a0a0a; }
  .hero-title { font-size: 16px; opacity: 0.7; margin-bottom: 32px; }
  .hero-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
  .hero-stat-label { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .hero-stat-value { font-size: 24px; font-weight: 700; }
  .body { padding: 40px; }
  .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .section-title { font-size: 16px; font-weight: 700; color: #201515; }
  .pill { background: #0a0a0a; color: #fff; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; font-weight: 700; color: #939084; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 14px; border-bottom: 1px solid #e0d9cf; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
  td { padding: 12px 14px; border-bottom: 1px solid #f8f4f0; font-size: 12px; }
  tr:hover td { background: #f8f4f0; }
  .chip { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .chip-income { background: #eaf7f0; color: #22c55e; }
  .chip-expense { background: #fdecea; color: #ff4d8b; }
  .amount-income { color: #22c55e; font-weight: 700; }
  .amount-expense { color: #ff4d8b; font-weight: 700; }
  .footer { text-align: center; padding: 24px; color: #c5c0b1; font-size: 11px; border-top: 1px solid #e0d9cf; margin-top: 40px; }
  @media print { .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="hero">
    <div class="hero-brand"><img src="assets/hisba-logo.png" alt="Hisbba"><span>حِسبة</span></div>
    <div class="hero-title">Financial Report • ${period}</div>
    <div class="hero-stats">
      <div>
        <div class="hero-stat-label">Income</div>
        <div class="hero-stat-value" style="color:#4ade80">${formatCurrency(summary.income || 0, currency)}</div>
      </div>
      <div>
        <div class="hero-stat-label">Expenses</div>
        <div class="hero-stat-value" style="color:#f87171">${formatCurrency(summary.expenses || 0, currency)}</div>
      </div>
      <div>
        <div class="hero-stat-label">Net</div>
        <div class="hero-stat-value">${formatCurrency((summary.income || 0) - (summary.expenses || 0), currency)}</div>
      </div>
      <div>
        <div class="hero-stat-label">Count</div>
        <div class="hero-stat-value">${transactions.length}</div>
      </div>
    </div>
  </div>
  <div class="body">
    <div class="section-header">
      <div class="section-title">Transactions</div>
      <div class="pill">${transactions.length} records</div>
    </div>
    <table>
      <thead>
        <tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td style="color:#939084">${formatDate(tx.date, 'short')}</td>
            <td style="font-weight:500">${tx.description || '—'}</td>
            <td>${tx.category?.name || '—'}</td>
            <td>${tx.account?.name || '—'}</td>
            <td><span class="chip chip-${tx.type}">${tx.type}</span></td>
            <td class="amount-${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="footer">Hisbba • ${new Date().toLocaleDateString()} • Hisbba.app</div>
</body>
</html>`;
}

function buildDarkTemplate(transactions, summary, period, currency, dir) {
  return `<!DOCTYPE html>
<html dir="${dir}">
<head>
<meta charset="UTF-8">
<title>Hisbba — Dark Premium Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; background: #1a1410; color: #f2ede5; font-size: 13px; direction: ${dir}; min-height: 100vh; }
  .header { padding: 48px 48px 32px; border-bottom: 1px solid #362e26; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: #f2ede5; }
  .brand span { color: #ff6120; }
  .report-meta { text-align: right; }
  .report-label { font-size: 11px; color: #756c5f; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .report-period { font-size: 14px; font-weight: 600; color: #e0d9cf; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #362e26; margin-bottom: 0; }
  .summary-item { background: #231d16; padding: 28px 24px; }
  .summary-item:first-child { border-radius: 0; }
  .s-label { font-size: 11px; color: #756c5f; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .s-value { font-size: 22px; font-weight: 700; color: #f2ede5; }
  .income-c { color: #34d399 !important; }
  .expense-c { color: #f87171 !important; }
  .table-section { padding: 40px 48px; }
  .table-title { font-size: 13px; font-weight: 700; color: #e0d9cf; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; font-weight: 700; color: #756c5f; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px; border-bottom: 1px solid #362e26; text-align: ${dir === 'rtl' ? 'right' : 'left'}; }
  td { padding: 12px; border-bottom: 1px solid #2c2520; font-size: 12px; color: #c8bfb4; }
  tr:last-child td { border-bottom: none; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
  .tag-income  { background: rgba(52,211,153,0.15); color: #34d399; }
  .tag-expense { background: rgba(248,113,113,0.15); color: #f87171; }
  .footer { padding: 24px 48px; border-top: 1px solid #362e26; color: #4a4238; font-size: 11px; text-align: center; }
  @media print {
    body { background: #1a1410 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand"><img src="assets/hisba-logo.png" alt="Hisbba"><span>حِسبة</span></div>
    <div class="report-meta">
      <div class="report-label">Financial Report</div>
      <div class="report-period">${period}</div>
      <div style="color:#4a4238;font-size:11px;margin-top:4px;">${new Date().toLocaleDateString()}</div>
    </div>
  </div>
  <div class="summary">
    <div class="summary-item">
      <div class="s-label">Income</div>
      <div class="s-value income-c">${formatCurrency(summary.income || 0, currency)}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Expenses</div>
      <div class="s-value expense-c">${formatCurrency(summary.expenses || 0, currency)}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Net Balance</div>
      <div class="s-value">${formatCurrency((summary.income || 0) - (summary.expenses || 0), currency)}</div>
    </div>
    <div class="summary-item">
      <div class="s-label">Transactions</div>
      <div class="s-value">${transactions.length}</div>
    </div>
  </div>
  <div class="table-section">
    <div class="table-title">Transaction Ledger</div>
    <table>
      <thead>
        <tr><th>Date</th><th>Description</th><th>Category</th><th>Account</th><th>Type</th><th>Amount</th></tr>
      </thead>
      <tbody>
        ${transactions.map(tx => `
          <tr>
            <td style="color:#756c5f">${formatDate(tx.date, 'short')}</td>
            <td style="color:#e0d9cf;font-weight:500">${tx.description || '—'}</td>
            <td>${tx.category?.name || '—'}</td>
            <td>${tx.account?.name || '—'}</td>
            <td><span class="tag tag-${tx.type}">${tx.type}</span></td>
            <td class="${tx.type === 'income' ? 'income-c' : 'expense-c'}" style="font-weight:700">
              ${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <div class="footer">Generated by Hisbba • ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
}

// ── File download helper ───────────────────────────────────
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
