import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatRupiah, formatDate } from '../lib/format';
import { AlertTriangle, ShoppingCart, TrendingUp, Truck } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface DashSummary {
  lowStockCount: number;
  activeOrdersCount: number;
  monthSales: number;
  todayDeliveries: { order_number: string; customer_name: string; region: string; status: string }[];
  chartLabels: string[];
  chartRevenue: number[];
  chartCost: number[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const today = now.toISOString().slice(0, 10);

    const [lowStock, activeOrders, payments, todayDist] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact' }).lt('current_stock', 10),
      supabase.from('orders').select('id', { count: 'exact' }).in('status', ['BARU', 'DIPROSES']),
      supabase.from('invoices').select('total_amount, paid_amount').eq('payment_status', 'LUNAS')
        .gte('created_at', `${y}-${String(m).padStart(2, '0')}-01`),
      supabase.from('distributions').select('*, orders(order_number), customers(name, region_name)')
        .eq('delivery_date', today),
    ]);

    const monthSales = (payments.data || []).reduce((s, i) => s + i.total_amount, 0);

    // Build 6-month chart data
    const labels: string[] = [];
    const revenue: number[] = [];
    const cost: number[] = [];
    const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const cm = d.getMonth() + 1;
      const cy = d.getFullYear();
      labels.push(monthNames[d.getMonth()]);
      const { data: inv } = await supabase.from('invoices').select('total_amount')
        .gte('created_at', `${cy}-${String(cm).padStart(2,'0')}-01`)
        .lt('created_at', new Date(cy, cm, 1).toISOString().slice(0,10));
      const { data: sm } = await supabase.from('stock_movements').select('quantity, buy_price')
        .eq('type', 'IN')
        .gte('move_date', `${cy}-${String(cm).padStart(2,'0')}-01`)
        .lt('move_date', new Date(cy, cm, 1).toISOString().slice(0,10));
      revenue.push((inv || []).reduce((s, r) => s + r.total_amount, 0));
      cost.push((sm || []).reduce((s, r) => s + r.quantity * r.buy_price, 0));
    }

    setData({
      lowStockCount: lowStock.count || 0,
      activeOrdersCount: activeOrders.count || 0,
      monthSales,
      todayDeliveries: (todayDist.data || []).map((d: any) => ({
        order_number: d.orders?.order_number || '-',
        customer_name: d.customers?.name || '-',
        region: d.customers?.region_name || '-',
        status: d.status,
      })),
      chartLabels: labels,
      chartRevenue: revenue,
      chartCost: cost,
    });
    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const chartData = {
    labels: data?.chartLabels || [],
    datasets: [
      { label: 'Pendapatan', data: data?.chartRevenue || [], backgroundColor: '#3b82f6', borderRadius: 6 },
      { label: 'Pembelian', data: data?.chartCost || [], backgroundColor: '#f59e0b', borderRadius: 6 },
    ],
  };

  const stats = [
    {
      label: 'Stok Menipis',
      value: `${data?.lowStockCount} Item`,
      icon: <AlertTriangle size={20} />,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-100',
    },
    {
      label: 'Pesanan Aktif',
      value: `${data?.activeOrdersCount} Pesanan`,
      icon: <ShoppingCart size={20} />,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      label: 'Penjualan Bulan Ini',
      value: formatRupiah(data?.monthSales || 0),
      icon: <TrendingUp size={20} />,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">{formatDate(new Date().toISOString())}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`card border ${s.border}`}>
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>
                {s.icon}
              </div>
              <div>
                <div className="text-sm text-slate-500">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-600" />
          Laba Rugi 6 Bulan Terakhir
        </h2>
        <div className="h-60">
          <Bar data={chartData} options={{
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
              y: { ticks: { callback: (v) => `Rp ${(Number(v)/1000).toFixed(0)}k` } }
            }
          }} />
        </div>
      </div>

      {/* Today's deliveries */}
      <div className="card">
        <h2 className="section-title flex items-center gap-2">
          <Truck size={18} className="text-amber-600" />
          Pesanan Dikirim Hari Ini
        </h2>
        {data?.todayDeliveries.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-6">Tidak ada pengiriman hari ini</p>
        ) : (
          <div className="table-wrap mt-2">
            <table className="data-table">
              <thead><tr>
                <th>No Pesanan</th><th>Pelanggan</th><th>Wilayah</th><th>Status</th>
              </tr></thead>
              <tbody>
                {data?.todayDeliveries.map((d, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">{d.order_number}</td>
                    <td>{d.customer_name}</td>
                    <td>{d.region}</td>
                    <td>
                      <span className={d.status === 'TERKIRIM' ? 'badge-green' : 'badge-amber'}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
