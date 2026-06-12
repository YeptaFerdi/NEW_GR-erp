import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, MONTHS } from '../../lib/format';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Printer, CircleCheck as CheckCircle, Circle as XCircle } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CapitalItem {
  name: string;
  amount: number;
  type: 'permanent' | 'addition' | 'profit';
}

export default function ReportCapital() {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({
    totalCapital: 0, totalInventory: 0, totalReceivable: 0, kas: 0,
    capitalItems: [] as CapitalItem[],
    previousProfit: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const monthStr = String(filterMonth).padStart(2,'0');
    const startDate = `${filterYear}-${monthStr}-01`;
    const endDate = new Date(filterYear, filterMonth, 1).toISOString().slice(0,10);

    // Get all capital entries up to and including the current month
    // Permanent capital = entries from the first month they appeared, carried forward
    // Monthly additions = entries specifically for this month
    const [{ data: allCaps }, { data: prods }, { data: invs }, { data: payments }, { data: costs }] = await Promise.all([
      supabase.from('capital_entries').select('name, amount, previous_profit, period_month, period_year')
        .or(`period_year.lt.${filterYear},and(period_year.eq.${filterYear},period_month.lte.${filterMonth})`)
        .order('period_year').order('period_month'),
      supabase.from('products').select('current_stock, buy_price'),
      supabase.from('invoices').select('remaining_amount').eq('payment_status', 'HUTANG').gte('created_at', startDate).lt('created_at', endDate),
      // Get total revenue for previous month to calculate profit
      supabase.from('payments').select('amount').gte('payment_date', getPrevMonthStart(filterMonth, filterYear)).lt('payment_date', startDate),
      // Get total costs for previous month
      supabase.from('operational_costs').select('amount').eq('period_month', getPrevMonth(filterMonth)).eq('period_year', getPrevYear(filterMonth, filterYear)),
    ]);

    // Calculate previous month profit (revenue - costs)
    const prevRevenue = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
    const prevCosts = (costs || []).reduce((s, c) => s + Number(c.amount), 0);
    const previousProfit = prevRevenue - prevCosts;

    // Group capital entries: find unique capital sources and their latest amounts
    const capitalMap = new Map<string, { amount: number; isCurrentMonth: boolean; firstMonth: number; firstYear: number }>();

    for (const cap of (allCaps || [])) {
      const existing = capitalMap.get(cap.name);
      const isCurrentMonth = cap.period_month === filterMonth && cap.period_year === filterYear;

      if (!existing) {
        capitalMap.set(cap.name, {
          amount: cap.amount,
          isCurrentMonth,
          firstMonth: cap.period_month,
          firstYear: cap.period_year,
        });
      } else {
        // Update to latest amount (capital can be updated)
        capitalMap.set(cap.name, {
          amount: cap.amount,
          isCurrentMonth: isCurrentMonth || existing.isCurrentMonth,
          firstMonth: existing.firstMonth,
          firstYear: existing.firstYear,
        });
      }
    }

    // Build capital items list
    const capitalItems: CapitalItem[] = [];

    for (const [name, info] of capitalMap) {
      const isPermanent = info.firstMonth !== filterMonth || info.firstYear !== filterYear;
      capitalItems.push({
        name,
        amount: info.amount,
        type: isPermanent ? 'permanent' : 'addition',
      });
    }

    // Add accumulated profit from previous month
    if (previousProfit > 0) {
      capitalItems.push({
        name: `Akumulasi Laba ${MONTHS[getPrevMonth(filterMonth) - 1]} ${getPrevYear(filterMonth, filterYear)}`,
        amount: previousProfit,
        type: 'profit',
      });
    }

    const totalCapital = capitalItems.reduce((s, c) => s + c.amount, 0);
    const totalInventory = (prods || []).reduce((s, p) => s + p.current_stock * p.buy_price, 0);
    const totalReceivable = (invs || []).reduce((s, i) => s + Number(i.remaining_amount), 0);
    const kas = totalCapital - (totalInventory + totalReceivable);

    setData({
      totalCapital, totalInventory, totalReceivable, kas,
      capitalItems,
      previousProfit,
    });
    setLoading(false);
  }

  function getPrevMonth(month: number): number {
    return month === 1 ? 12 : month - 1;
  }

  function getPrevYear(month: number, year: number): number {
    return month === 1 ? year - 1 : year;
  }

  function getPrevMonthStart(month: number, year: number): string {
    const prevMonth = getPrevMonth(month);
    const prevYear = getPrevYear(month, year);
    return `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
  }

  const isBalance = Math.abs(data.kas + data.totalInventory + data.totalReceivable - data.totalCapital) < 1;

  const chartData = {
    labels: ['Persediaan', 'Piutang', 'Kas'],
    datasets: [{
      data: [data.totalInventory, data.totalReceivable, Math.max(0, data.kas)],
      backgroundColor: ['#3b82f6', '#f59e0b', '#22c55e'],
    }],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Modal" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Modal</h1><p className="page-subtitle">Neraca modal vs aset</p></div>
        <button className="btn-secondary" onClick={() => window.print()}><Printer size={15} />Export PDF</button>
      </div>

      <div className="card no-print">
        <div className="flex flex-wrap gap-3">
          <div><label className="label">Bulan</label>
            <select className="select w-36" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Tahun</label><input className="input w-24" type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} /></div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="card">
              <h2 className="section-title">Komposisi Aset (Persediaan / Piutang / Kas)</h2>
              <div className="h-56 flex justify-center">
                <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>

            <div className="card space-y-1">
              <h2 className="section-title">Ringkasan Modal</h2>

              {/* Permanent Capital */}
              {data.capitalItems.filter(c => c.type === 'permanent').length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Modal Tetap</p>
                  {data.capitalItems.filter(c => c.type === 'permanent').map(c => (
                    <div key={c.name} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                      <span className="text-slate-700">{c.name}</span>
                      <span className="font-medium text-slate-800">{formatRupiah(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Monthly Additions */}
              {data.capitalItems.filter(c => c.type === 'addition').length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Modal Tambahan Bulan Ini</p>
                  {data.capitalItems.filter(c => c.type === 'addition').map(c => (
                    <div key={c.name} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                      <span className="text-slate-700">{c.name}</span>
                      <span className="font-medium text-green-700">{formatRupiah(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Accumulated Profit */}
              {data.capitalItems.filter(c => c.type === 'profit').length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Akumulasi Laba</p>
                  {data.capitalItems.filter(c => c.type === 'profit').map(c => (
                    <div key={c.name} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
                      <span className="text-slate-700">{c.name}</span>
                      <span className="font-medium text-amber-700">{formatRupiah(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-bold text-base pt-3 border-t-2 border-slate-200">
                <span>TOTAL MODAL</span><span className="text-blue-700">{formatRupiah(data.totalCapital)}</span>
              </div>
            </div>
          </div>

          {/* Balance Sheet */}
          <div className="card">
            <h2 className="section-title">Neraca Keuangan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Aset (Debit)</h3>
                <div className="flex justify-between py-2 border-b"><span>Total Persediaan</span><span className="font-medium">{formatRupiah(data.totalInventory)}</span></div>
                <div className="flex justify-between py-2 border-b"><span>Total Piutang</span><span className="font-medium">{formatRupiah(data.totalReceivable)}</span></div>
                <div className="flex justify-between py-2 border-b"><span>Kas</span><span className="font-medium text-green-700">{formatRupiah(Math.max(0, data.kas))}</span></div>
                <div className="flex justify-between py-2 font-bold text-base border-t-2 border-slate-200">
                  <span>TOTAL DEBIT</span><span>{formatRupiah(data.totalInventory + data.totalReceivable + Math.max(0, data.kas))}</span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Modal (Kredit)</h3>
                {data.capitalItems.map(c => (
                  <div key={c.name} className="flex justify-between py-2 border-b text-sm">
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-medium">{formatRupiah(c.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-bold text-base border-t-2 border-slate-200">
                  <span>TOTAL MODAL</span><span className="text-blue-700">{formatRupiah(data.totalCapital)}</span>
                </div>
              </div>
            </div>
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 font-semibold ${isBalance ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {isBalance ? <CheckCircle size={18} /> : <XCircle size={18} />}
              STATUS: {isBalance ? 'BALANCE' : 'TIDAK BALANCE'}
            </div>
            <p className="text-xs text-slate-400 mt-2">Rumus: Kas = Modal - (Persediaan + Piutang)</p>
          </div>
        </>
      )}
    </div>
  );
}
