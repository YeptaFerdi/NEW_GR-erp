import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatRupiah, MONTHS } from '../../lib/format';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Printer } from 'lucide-react';
import PrintHeader from '../../components/PrintHeader';

ChartJS.register(ArcElement, Tooltip, Legend);

interface StockItem { id: string; name: string; unit: string; current_stock: number; buy_price: number; producers: { name: string } | null; }

export default function ReportInventory() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('products').select('id, name, unit, current_stock, buy_price, producers(name)').order('name');
    setItems((data || []) as StockItem[]);
    setLoading(false);
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));
  const totalValue = filtered.reduce((s, i) => s + i.current_stock * i.buy_price, 0);

  const chartData = {
    labels: filtered.slice(0, 8).map(i => i.name),
    datasets: [{
      data: filtered.slice(0, 8).map(i => i.current_stock * i.buy_price),
      backgroundColor: ['#3b82f6','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'],
    }],
  };

  return (
    <div className="space-y-5">
      <PrintHeader title="Laporan Persediaan" subtitle={`Periode ${MONTHS[filterMonth-1]} ${filterYear}`} />
      <div className="page-header no-print">
        <div><h1 className="page-title">Laporan Persediaan</h1><p className="page-subtitle">Nilai stok barang saat ini</p></div>
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
          <div className="ml-auto"><label className="label">Cari Produk</label>
            <input className="input w-48" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="section-title">Komposisi Persediaan</h2>
        <div className="h-64 flex justify-center">
          <Pie data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>No</th><th>Produk</th><th>Satuan</th><th>Jumlah</th><th>Harga Beli</th><th>Nilai (Rp)</th></tr></thead>
            <tbody>
              {filtered.map((i, idx) => (
                <tr key={i.id}>
                  <td className="text-slate-400">{idx+1}</td>
                  <td className="font-medium">{i.name}</td>
                  <td>{i.unit}</td>
                  <td><span className={i.current_stock < 10 ? 'badge-red' : 'badge-blue'}>{i.current_stock}</span></td>
                  <td>{formatRupiah(i.buy_price)}</td>
                  <td className="font-bold">{formatRupiah(i.current_stock * i.buy_price)}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td colSpan={5} className="text-right">TOTAL NILAI PERSEDIAAN</td>
                <td className="text-blue-700 text-base">{formatRupiah(totalValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
