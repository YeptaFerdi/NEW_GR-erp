import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { MONTHS } from '../../lib/format';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Printer } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportDelivery() {
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<{ name: string; delivered: number; pending: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const monthStr = String(filterMonth).padStart(2,'0');
    const start = `${filterYear}-${monthStr}-01`;
    const end = new Date(filterYear, filterMonth, 1).toISOString().slice(0,10);

    const { data: dists } = await supabase.from('distributions').select('status, orders(order_items(product_id, quantity, products(name)))')
      .gte('delivery_date', start).lt('delivery_date', end).neq('status', 'BATAL');

    const map: Record<string, { delivered: number; pending: number }> = {};
    (dists || []).forEach((d: any) => {
      (d.orders?.order_items || []).forEach((oi: any) => {
        const pname = oi.products?.name || 'Unknown';
        if (!map[pname]) map[pname] = { delivered: 0, pending: 0 };
        if (d.status === 'TERKIRIM') map[pname].delivered += oi.quantity;
        else map[pname].pending += oi.quantity;
      });
    });

    setRows(Object.entries(map).map(([name, v]) => ({ name, ...v })));
    setLoading(false);
  }

  const chartData = {
    labels: rows.map(r => r.name),
    datasets: [
      { label: 'Terkirim', data: rows.map(r => r.delivered), backgroundColor: '#22c55e', borderRadius: 4 },
      { label: 'Belum Dikirim', data: rows.map(r => r.pending), backgroundColor: '#f59e0b', borderRadius: 4 },
    ],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Pengiriman" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Pengiriman</h1><p className="page-subtitle">Statistik distribusi barang</p></div>
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
        <h2 className="section-title">Pengiriman per Produk</h2>
        <div className="h-64">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } } }} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Produk</th><th>Terkirim</th><th>Belum Dikirim</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={3} className="text-center py-8 text-slate-400">Belum ada data pengiriman</td></tr> : rows.map(r => (
                <tr key={r.name}>
                  <td className="font-medium">{r.name}</td>
                  <td><span className="badge-green">{r.delivered}</span></td>
                  <td><span className={r.pending > 0 ? 'badge-amber' : 'badge-slate'}>{r.pending}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
