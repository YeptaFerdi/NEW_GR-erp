import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, MONTHS } from '../../lib/format';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Printer } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportPL() {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [data, setData] = useState({ totalSales: 0, totalPurchase: 0, totalOpCost: 0, profitThisMonth: 0, profitLastMonth: 0, accumulatedProfit: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const monthStr = String(filterMonth).padStart(2,'0');
    const start = `${filterYear}-${monthStr}-01`;
    const end = new Date(filterYear, filterMonth, 1).toISOString().slice(0,10);

    const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
    const prevYear = filterMonth === 1 ? filterYear - 1 : filterYear;
    const prevMonthStr = String(prevMonth).padStart(2,'0');
    const prevStart = `${prevYear}-${prevMonthStr}-01`;
    const prevEnd = new Date(prevYear, prevMonth, 1).toISOString().slice(0,10);

    const [{ data: invs }, { data: purchases }, { data: opCosts }, { data: prevInvs }, { data: prevPurchases }, { data: prevOpCosts }] = await Promise.all([
      supabase.from('invoices').select('total_amount').neq('payment_status', 'BATAL').gte('created_at', start).lt('created_at', end),
      supabase.from('stock_movements').select('quantity, buy_price').eq('type','IN').gte('move_date', start).lt('move_date', end),
      supabase.from('operational_costs').select('amount').eq('period_month', filterMonth).eq('period_year', filterYear),
      supabase.from('invoices').select('total_amount').neq('payment_status', 'BATAL').gte('created_at', prevStart).lt('created_at', prevEnd),
      supabase.from('stock_movements').select('quantity, buy_price').eq('type','IN').gte('move_date', prevStart).lt('move_date', prevEnd),
      supabase.from('operational_costs').select('amount').eq('period_month', prevMonth).eq('period_year', prevYear),
    ]);

    const totalSales = (invs || []).reduce((s, i) => s + i.total_amount, 0);
    const totalPurchase = (purchases || []).reduce((s, p) => s + p.quantity * p.buy_price, 0);
    const totalOpCost = (opCosts || []).reduce((s, c) => s + c.amount, 0);
    const profitThisMonth = totalSales - totalPurchase - totalOpCost;

    const prevSales = (prevInvs || []).reduce((s, i) => s + i.total_amount, 0);
    const prevPurchase = (prevPurchases || []).reduce((s, p) => s + p.quantity * p.buy_price, 0);
    const prevOpCost = (prevOpCosts || []).reduce((s, c) => s + c.amount, 0);
    const profitLastMonth = prevSales - prevPurchase - prevOpCost;

    setData({ totalSales, totalPurchase, totalOpCost, profitThisMonth, profitLastMonth, accumulatedProfit: profitLastMonth + profitThisMonth });
    setLoading(false);
  }

  const chartData = {
    labels: ['Penjualan', 'Pembelian', 'Biaya Ops', 'Laba Bulan Ini'],
    datasets: [{
      label: `${MONTHS[filterMonth-1]} ${filterYear}`,
      data: [data.totalSales, data.totalPurchase, data.totalOpCost, Math.max(0, data.profitThisMonth)],
      backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#22c55e'],
      borderRadius: 6,
    }],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Laba Rugi" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Laba Rugi</h1><p className="page-subtitle">Pendapatan vs Biaya</p></div>
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

      <div className="card">
        <h2 className="section-title">Pendapatan vs Biaya</h2>
        <div className="h-64">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => `Rp ${(Number(v)/1000).toFixed(0)}k` } } } }} />
        </div>
      </div>

      <div className="card">
        <table className="data-table">
          <thead><tr><th>Keterangan</th><th className="text-right">Nilai (Rp)</th></tr></thead>
          <tbody>
            <tr><td>Total Penjualan</td><td className="text-right font-medium text-green-700">{formatRupiah(data.totalSales)}</td></tr>
            <tr><td>Total Pembelian</td><td className="text-right text-red-600">({formatRupiah(data.totalPurchase)})</td></tr>
            <tr><td>Biaya Operasional</td><td className="text-right text-red-600">({formatRupiah(data.totalOpCost)})</td></tr>
            <tr className={`font-bold text-base border-t-2 border-slate-200 ${data.profitThisMonth >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              <td>LABA BULAN INI</td>
              <td className="text-right">{formatRupiah(data.profitThisMonth)}</td>
            </tr>
            <tr className="border-t"><td className="text-slate-500">Laba Bulan Lalu</td><td className="text-right text-slate-500">{formatRupiah(data.profitLastMonth)}</td></tr>
            <tr className="font-bold bg-blue-50">
              <td>AKUMULASI LABA</td>
              <td className="text-right text-blue-700">{formatRupiah(data.accumulatedProfit)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-4 text-right text-xs text-slate-400">
          {new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>
    </div>
  );
}
