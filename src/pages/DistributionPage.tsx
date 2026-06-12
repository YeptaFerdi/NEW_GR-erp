import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Distribution, Order, Customer, Region } from '../lib/types';
import { formatDate, formatRupiah } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, X, Loader as Loader2, Truck, CircleCheck as CheckCircle, Ban, TriangleAlert as AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type DistTab = 'active' | 'cancelled';

export default function DistributionPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('distribution', 'can_create');
  const canUpdate = hasAccess('distribution', 'can_update');
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [cancelledDistributions, setCancelledDistributions] = useState<Distribution[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0,10));
  const [filterRegion, setFilterRegion] = useState('');
  const [distTab, setDistTab] = useState<DistTab>('active');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'cancel' | null>(null);
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0,10));
  const [fOrderId, setFOrderId] = useState('');
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Distribution | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { load(); }, [filterDate, filterRegion]);

  async function load() {
    setLoading(true);
    let q = supabase.from('distributions').select('*, orders(order_number, total_amount), customers(name, region_name)')
      .eq('delivery_date', filterDate).neq('status', 'BATAL').order('sort_order');
    if (filterRegion) q = q.eq('region_name', filterRegion);

    const [{ data: d }, { data: cancelled }, { data: o }, { data: c }, { data: r }] = await Promise.all([
      q,
      supabase.from('distributions').select('*, orders(order_number, total_amount), customers(name, region_name)')
        .eq('status', 'BATAL').order('cancelled_at', { ascending: false }).limit(50),
      supabase.from('orders').select('*, customers(name, region_name)').in('status', ['BARU','DIPROSES']).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('name'),
      supabase.from('regions').select('*').order('sort_order'),
    ]);
    setDistributions(d || []);
    setCancelledDistributions(cancelled || []);
    setOrders(o || []);
    setCustomers(c || []);
    setRegions(r || []);
    setLoading(false);
  }

  async function addDistribution() {
    if (!fOrderId) return;
    setSaving(true);
    const order = orders.find(o => o.id === fOrderId);
    const customer = customers.find(c => c.id === order?.customer_id);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('distributions').insert({
      delivery_date: fDate, order_id: fOrderId,
      customer_id: order?.customer_id || '',
      region_name: customer?.region_name || '',
      sort_order: distributions.length + 1,
      created_by: user?.id,
    }).select().single();
    if (data) await logAudit('Distribusi', 'CREATE', data.id, null, { order_id: fOrderId });
    setModal(null);
    await load();
    setSaving(false);
  }

  async function updateStatus(dist: Distribution, status: 'DIKIRIM' | 'TERKIRIM') {
    const old = { status: dist.status };
    await supabase.from('distributions').update({ status, updated_at: new Date().toISOString() }).eq('id', dist.id);

    // Auto-create invoice when delivered (TERKIRIM)
    if (status === 'TERKIRIM') {
      const existing = await supabase.from('invoices').select('id').eq('order_id', dist.order_id).maybeSingle();
      if (!existing.data) {
        const { data: order } = await supabase.from('orders').select('order_number, customer_id, total_amount').eq('id', dist.order_id).single();
        if (order) {
          const { data: { user } } = await supabase.auth.getUser();
          const invNum = `INV-${order.order_number.replace('ORD-', '')}`;
          await supabase.from('invoices').insert({
            invoice_number: invNum, order_id: dist.order_id,
            customer_id: order.customer_id, total_amount: order.total_amount,
            remaining_amount: order.total_amount, created_by: user?.id,
          });
        }
      }
    }

    await logAudit('Distribusi', 'UPDATE', dist.id, old as Record<string, unknown>, { status });
    await load();
  }

  function openCancelModal(dist: Distribution) {
    setCancelTarget(dist);
    setCancelReason('');
    setModal('cancel');
  }

  async function cancelDistribution() {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);

    const { error } = await supabase.from('distributions').update({
      status: 'BATAL',
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason.trim(),
    }).eq('id', cancelTarget.id);

    if (!error) {
      // Cascade: cancel the associated order
      await supabase.from('orders').update({
        status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Distribusi dibatalkan: ${cancelReason.trim()}`,
      }).eq('id', cancelTarget.order_id);

      // Cascade: cancel associated invoice
      await supabase.from('invoices').update({
        payment_status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Distribusi dibatalkan: ${cancelReason.trim()}`,
      }).eq('order_id', cancelTarget.order_id);

      await logAudit('Distribusi', 'UPDATE', cancelTarget.id, { status: cancelTarget.status } as Record<string, unknown>, { status: 'BATAL', reason: cancelReason });
    }

    await load();
    setModal(null);
    setCancelling(false);
  }

  const grouped = distributions.reduce<Record<string, Distribution[]>>((acc, d) => {
    const region = d.customers?.region_name || d.region_name || 'Lainnya';
    if (!acc[region]) acc[region] = [];
    acc[region].push(d);
    return acc;
  }, {});

  const availableOrders = orders.filter(o => !distributions.some(d => d.order_id === o.id));

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Distribusi Barang</h1>
          <p className="page-subtitle">Kelola pengiriman dan update status</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={() => { setFOrderId(''); setModal('add'); }}><Plus size={16} />Tambah Distribusi</button>}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setDistTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            distTab === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Truck size={16} />Distribusi Aktif
        </button>
        <button
          onClick={() => setDistTab('cancelled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            distTab === 'cancelled' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Ban size={16} />Dibatalkan
          {cancelledDistributions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              distTab === 'cancelled' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {cancelledDistributions.length}
            </span>
          )}
        </button>
      </div>

      {/* Active Distributions View */}
      {distTab === 'active' && (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="label">Tanggal Kirim</label>
                <input className="input w-40" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Wilayah</label>
                <select className="select w-44" value={filterRegion} onChange={e => setFilterRegion(e.target.value)}>
                  <option value="">Semua Wilayah</option>
                  {regions.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
          ) : distributions.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <Truck size={40} className="mx-auto mb-3 opacity-30" />
              <p>Tidak ada distribusi untuk tanggal ini</p>
            </div>
          ) : (
            Object.entries(grouped).map(([region, dists]) => (
              <div key={region} className="card">
                <h2 className="section-title flex items-center gap-2">
                  <Truck size={16} className="text-amber-600" />Wilayah: {region}
                </h2>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Urut</th><th>Pelanggan</th><th>No Pesanan</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {dists.map((d, i) => (
                        <tr key={d.id}>
                          <td className="font-bold text-slate-400">{i + 1}</td>
                          <td className="font-medium">{d.customers?.name}</td>
                          <td className="font-mono text-xs text-blue-700">{d.orders?.order_number}</td>
                          <td>{formatRupiah(d.orders?.total_amount || 0)}</td>
                          <td>
                            <span className={d.status === 'TERKIRIM' ? 'badge-green' : d.status === 'DIKIRIM' ? 'badge-blue' : 'badge-slate'}>
                              {d.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-1">
                              {canUpdate && d.status === 'BELUM DIKIRIM' && (
                                <>
                                  <button className="btn-secondary btn-sm" onClick={() => updateStatus(d, 'DIKIRIM')}>
                                    <Truck size={12} />Kirim
                                  </button>
                                  <button
                                    className="btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors"
                                    onClick={() => openCancelModal(d)}
                                  >
                                    <Ban size={12} />Batal
                                  </button>
                                </>
                              )}
                              {canUpdate && d.status === 'DIKIRIM' && (
                                <>
                                  <button className="btn-gold btn-sm" onClick={() => updateStatus(d, 'TERKIRIM')}>
                                    <CheckCircle size={12} />Terkirim
                                  </button>
                                  <button
                                    className="btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors"
                                    onClick={() => openCancelModal(d)}
                                  >
                                    <Ban size={12} />Batal
                                  </button>
                                </>
                              )}
                              {d.status === 'TERKIRIM' && (
                                <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle size={12} />Selesai</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  * Saat status diubah ke TERKIRIM: stok otomatis berkurang &amp; pesanan menjadi SELESAI
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* Cancelled Distributions View */}
      {distTab === 'cancelled' && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <Ban size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Distribusi Dibatalkan</h2>
              <p className="text-xs text-slate-500">Daftar pengiriman yang telah dibatalkan manual atau otomatis</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div>
          ) : cancelledDistributions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p>Tidak ada distribusi yang dibatalkan</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tgl Dibatalkan</th>
                    <th>No Pesanan</th>
                    <th>Pelanggan</th>
                    <th>Total</th>
                    <th>Alasan</th>
                    <th>Tipe</th>
                  </tr>
                </thead>
                <tbody>
                  {cancelledDistributions.map(d => (
                    <tr key={d.id} className="opacity-75">
                      <td className="text-xs text-slate-500">{formatDate(d.cancelled_at)}</td>
                      <td className="font-mono text-xs text-slate-600">{d.orders?.order_number}</td>
                      <td className="font-medium text-slate-700">{d.customers?.name}</td>
                      <td className="text-slate-600">{formatRupiah(d.orders?.total_amount || 0)}</td>
                      <td className="text-xs text-red-600 max-w-[200px] truncate" title={d.cancel_reason}>
                        {d.cancel_reason || '-'}
                      </td>
                      <td>
                        {d.cancel_reason?.includes('otomatis') || d.cancel_reason?.includes('3 bulan') ? (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            <Clock size={10} />Otomatis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                            <AlertTriangle size={10} />Manual
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Distribution Modal */}
      {modal === 'add' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">Tambah Distribusi</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Tanggal Kirim</label><input className="input" type="date" value={fDate} onChange={e => setFDate(e.target.value)} /></div>
              <div><label className="label">Pilih Pesanan</label>
                <select className="select" value={fOrderId} onChange={e => setFOrderId(e.target.value)}>
                  <option value="">Pilih Pesanan</option>
                  {availableOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.order_number} — {o.customers?.name} ({formatRupiah(o.total_amount)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={addDistribution} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Tambah</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Distribution Modal */}
      {modal === 'cancel' && cancelTarget && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <Ban size={18} />Batalkan Distribusi
              </h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Batalkan pengiriman untuk pesanan <span className="font-bold">{cancelTarget.orders?.order_number}</span> - <span className="font-bold">{cancelTarget.customers?.name}</span>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Total: {formatRupiah(cancelTarget.orders?.total_amount || 0)}
                </p>
              </div>
              <div>
                <label className="label">Alasan Pembatalan <span className="text-red-500">*</span></label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  placeholder="Masukkan alasan pembatalan distribusi..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                Distribusi dan pesanan terkait akan dibatalkan. Tindakan ini tidak dapat dikembalikan.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Kembali</button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                onClick={cancelDistribution}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
