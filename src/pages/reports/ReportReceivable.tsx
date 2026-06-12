import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, MONTHS } from '../../lib/format';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Printer } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(ArcElement, Tooltip, Legend);

interface InvRow { invoice_number: string; customer_name: string; order_items_count: number; total_amount: number; remaining_amount: number; payment_status: string; }

export default function ReportReceivable() {
  const [rows, setRows] = useState<InvRow[]>([]);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const monthStr = String(filterMonth).padStart(2,'0');
    const { data } = await supabase.from('invoices')
      .select('invoice_number, total_amount, remaining_amount, payment_status, customers(name), orders(id)')
      .neq('payment_status', 'BATAL')
      .gte('created_at', `${filterYear}-${monthStr}-01`)
      .lt('created_at', new Date(filterYear, filterMonth, 1).toISOString().slice(0,10));

    const result: InvRow[] = await Promise.all((data || []).map(async (inv: any) => {
      const { count } = await supabase.from('order_items').select('*', { count: 'exact', head: true }).eq('order_id', inv.orders?.id);
      return {
        invoice_number: inv.invoice_number,
        customer_name: inv.customers?.name || '-',
        order_items_count: count || 0,
        total_amount: inv.total_amount,
        remaining_amount: inv.remaining_amount,
        payment_status: inv.payment_status,
      };
    }));
    setRows(result);
    setLoading(false);
  }

  const filtered = rows.filter(r => r.invoice_number.toLowerCase().includes(search.toLowerCase()) || r.customer_name.toLowerCase().includes(search.toLowerCase()));
  const totalPiutang = filtered.reduce((s, r) => s + r.remaining_amount, 0);
  const totalLunas = filtered.filter(r => r.payment_status === 'LUNAS').reduce((s, r) => s + r.total_amount, 0);
  const totalHutang = filtered.filter(r => r.payment_status === 'HUTANG').reduce((s, r) => s + r.remaining_amount, 0);

  const chartData = {
    labels: ['Lunas', 'Hutang'],
    datasets: [{ data: [totalLunas, totalHutang], backgroundColor: ['#22c55e', '#f59e0b'] }],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Piutang" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Piutang</h1><p className="page-subtitle">Status pembayaran pelanggan</p></div>
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
        <h2 className="section-title">Komposisi Piutang (Lunas vs Hutang)</h2>
        <div className="h-56 flex justify-center">
          <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>No Nota</th><th>Pelanggan</th><th>Jumlah Item</th><th>Total Hutang (Rp)</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.invoice_number}>
                  <td className="font-mono text-xs text-blue-700">{r.invoice_number}</td>
                  <td>{r.customer_name}</td>
                  <td>{r.order_items_count}</td>
                  <td className={r.remaining_amount > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}>{formatRupiah(r.remaining_amount)}</td>
                  <td><span className={r.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{r.payment_status}</span></td>
                </tr>
              ))}
              <tr className="bg-red-50 font-bold">
                <td colSpan={3} className="text-right">TOTAL PIUTANG</td>
                <td className="text-red-600">{formatRupiah(totalPiutang)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
