import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, MONTHS } from '../../lib/format';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Printer } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportSales() {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ totalSales: 0, lunas: 0, hutang: 0, rows: [] as any[] });

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    const monthStr = String(filterMonth).padStart(2,'0');
    const start = `${filterYear}-${monthStr}-01`;
    const end = new Date(filterYear, filterMonth, 1).toISOString().slice(0,10);

    const { data: invs } = await supabase.from('invoices')
      .select('*, customers(name), orders(order_number)')
      .neq('payment_status', 'BATAL')
      .gte('created_at', start).lt('created_at', end);

    const totalSales = (invs || []).reduce((s, i) => s + i.total_amount, 0);
    const lunas = (invs || []).filter(i => i.payment_status === 'LUNAS').reduce((s, i) => s + i.total_amount, 0);
    const hutang = (invs || []).filter(i => i.payment_status === 'HUTANG').reduce((s, i) => s + i.remaining_amount, 0);

    setData({ totalSales, lunas, hutang, rows: invs || [] });
  }

  const filtered = data.rows.filter(r =>
    (r.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.customers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const chartData = {
    labels: ['Total Penjualan', 'Lunas', 'Hutang'],
    datasets: [{ data: [data.totalSales, data.lunas, data.hutang], backgroundColor: ['#3b82f6','#22c55e','#f59e0b'], borderRadius: 6 }],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Penjualan Bulanan" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Penjualan Bulanan</h1><p className="page-subtitle">Ringkasan penjualan periode</p></div>
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
          <div className="ml-auto"><label className="label">Cari</label><input className="input w-48" placeholder="Cari nota / pelanggan..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Penjualan: Lunas vs Hutang</h2>
        <div className="h-48">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => `Rp ${(Number(v)/1000).toFixed(0)}k` } } } }} />
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {[['Total Penjualan', data.totalSales, 'text-blue-700'], ['Penjualan Lunas', data.lunas, 'text-green-700'], ['Penjualan Hutang', data.hutang, 'text-amber-600']].map(([label, value, color]) => (
            <div key={label as string} className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500">{label}</div>
              <div className={`font-bold text-base ${color}`}>{formatRupiah(Number(value))}</div>
            </div>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>No Nota</th><th>Pelanggan</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.invoice_number}</td>
                  <td>{r.customers?.name}</td>
                  <td>{formatRupiah(r.total_amount)}</td>
                  <td><span className={r.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{r.payment_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
