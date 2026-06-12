import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Order, OrderItem, Customer, Product } from '../lib/types';
import { formatRupiah, formatDate } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, Search, X, Loader as Loader2, Eye, Printer, Pencil, Ban, TriangleAlert as AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type OrderTab = 'all' | 'BARU' | 'DIPROSES' | 'SELESAI' | 'BATAL';

interface CartItem { product_id: string; product_name: string; qty: string; unit_price: string; subtotal: number; }

export default function OrdersPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('orders', 'can_create');
  const canUpdate = hasAccess('orders', 'can_update');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<OrderTab>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'form' | 'detail' | 'nota' | 'cancel' | null>(null);
  const [selected, setSelected] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [autoCancelCount, setAutoCancelCount] = useState(0);

  // Form state
  const [fCustomer, setFCustomer] = useState('');
  const [fOrderDate, setFOrderDate] = useState(new Date().toISOString().slice(0,10));
  const [fDelivDate, setFDelivDate] = useState('');
  const [cart, setCart] = useState<CartItem[]>([{ product_id: '', product_name: '', qty: '', unit_price: '', subtotal: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: o }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('orders').select('*, customers(name, region_name)').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('status', 'Aktif').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setOrders(o || []);
    setCustomers(c || []);
    setProducts(p || []);
    setLoading(false);

    // Auto-cancel check
    await checkAutoCancel(o || []);
  }

  async function checkAutoCancel(allOrders: Order[]) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const expiredOrders = allOrders.filter(o =>
      (o.status === 'BARU' || o.status === 'DIPROSES') &&
      o.delivery_status === 'BELUM DIKIRIM' &&
      new Date(o.created_at) < threeMonthsAgo
    );

    if (expiredOrders.length > 0) {
      let cancelledCount = 0;
      for (const order of expiredOrders) {
        const { error } = await supabase.from('orders').update({
          status: 'BATAL',
          cancelled_at: new Date().toISOString(),
          cancel_reason: 'Otomatis dibatalkan - tidak dikirim dalam 3 bulan',
        }).eq('id', order.id);

        if (!error) {
          // Cascade: cancel distributions
          await supabase.from('distributions').update({
            status: 'BATAL',
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'Pesanan dibatalkan otomatis',
          }).eq('order_id', order.id).in('status', ['BELUM DIKIRIM', 'DIKIRIM']);

          // Cascade: cancel invoices
          await supabase.from('invoices').update({
            payment_status: 'BATAL',
            cancelled_at: new Date().toISOString(),
            cancel_reason: 'Pesanan dibatalkan otomatis',
          }).eq('order_id', order.id);

          await logAudit('Pesanan', 'UPDATE', order.id, { status: order.status } as Record<string, unknown>, { status: 'BATAL', reason: 'Auto-cancel 3 bulan' });
          cancelledCount++;
        }
      }
      if (cancelledCount > 0) {
        setAutoCancelCount(cancelledCount);
        // Reload to reflect changes
        const { data: refreshed } = await supabase.from('orders').select('*, customers(name, region_name)').order('created_at', { ascending: false });
        setOrders(refreshed || []);
      }
    }
  }

  async function openDetail(o: Order) {
    setSelected(o);
    const { data } = await supabase.from('order_items').select('*, products(name, unit)').eq('order_id', o.id);
    setOrderItems(data || []);
    setModal('detail');
  }

  async function openNota(o: Order) {
    setSelected(o);
    const { data } = await supabase.from('order_items').select('*, products(name, unit)').eq('order_id', o.id);
    setOrderItems(data || []);
    setModal('nota');
  }

  async function openEdit(o: Order) {
    setSelected(o);
    setFCustomer(o.customer_id);
    setFOrderDate(o.order_date);
    setFDelivDate(o.delivery_date || '');
    const { data } = await supabase.from('order_items').select('*, products(name, unit)').eq('order_id', o.id);
    setCart((data || []).map(i => ({
      product_id: i.product_id,
      product_name: i.products?.name || '',
      qty: String(i.quantity),
      unit_price: String(i.unit_price),
      subtotal: i.subtotal,
    })));
    setModal('form');
  }

  function openCancelModal(o: Order) {
    setSelected(o);
    setCancelReason('');
    setModal('cancel');
  }

  function openNew() {
    setSelected(null);
    setFCustomer('');
    setFOrderDate(new Date().toISOString().slice(0,10));
    setFDelivDate('');
    setCart([{ product_id: '', product_name: '', qty: '', unit_price: '', subtotal: 0 }]);
    setModal('form');
  }

  function updateCart(idx: number, field: string, val: string) {
    setCart(c => {
      const next = [...c];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'product_id' && val) {
        const prod = products.find(p => p.id === val);
        if (prod) { next[idx].unit_price = String(prod.sell_price); next[idx].product_name = prod.name; }
      }
      const qty = Number(next[idx].qty) || 0;
      const price = Number(next[idx].unit_price) || 0;
      next[idx].subtotal = qty * price;
      return next;
    });
  }

  const cartTotal = cart.reduce((s, i) => s + i.subtotal, 0);

  async function saveOrder() {
    if (!fCustomer || !cart.some(i => i.product_id && i.qty)) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const total = cart.reduce((s, i) => s + i.subtotal, 0);

    if (selected) {
      await supabase.from('orders').update({ customer_id: fCustomer, order_date: fOrderDate, delivery_date: fDelivDate || null, total_amount: total }).eq('id', selected.id);
      await supabase.from('order_items').delete().eq('order_id', selected.id);
      for (const item of cart.filter(i => i.product_id && i.qty)) {
        await supabase.from('order_items').insert({ order_id: selected.id, product_id: item.product_id, quantity: Number(item.qty), unit_price: Number(item.unit_price), subtotal: item.subtotal });
      }
      await logAudit('Pesanan', 'UPDATE', selected.id, selected as unknown as Record<string, unknown>, { total });
    } else {
      const seq = Date.now();
      const orderNum = `ORD-${String(seq).slice(-6)}`;
      const { data: newOrder } = await supabase.from('orders').insert({
        order_number: orderNum, customer_id: fCustomer, order_date: fOrderDate,
        delivery_date: fDelivDate || null, total_amount: total, created_by: user?.id,
      }).select().single();
      if (newOrder) {
        for (const item of cart.filter(i => i.product_id && i.qty)) {
          await supabase.from('order_items').insert({ order_id: newOrder.id, product_id: item.product_id, quantity: Number(item.qty), unit_price: Number(item.unit_price), subtotal: item.subtotal });
        }
        await supabase.from('customers').update({ last_order_at: new Date().toISOString() }).eq('id', fCustomer);
        await logAudit('Pesanan', 'CREATE', newOrder.id, null, { order_number: orderNum, total });
      }
    }
    await load(); setModal(null); setSaving(false);
  }

  async function cancelOrder() {
    if (!selected || !cancelReason.trim()) return;
    setCancelling(true);

    const { error } = await supabase.from('orders').update({
      status: 'BATAL',
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason.trim(),
    }).eq('id', selected.id);

    if (!error) {
      // Cascade: cancel any pending distribution for this order
      await supabase.from('distributions').update({
        status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Pesanan dibatalkan: ${cancelReason.trim()}`,
      }).eq('order_id', selected.id).in('status', ['BELUM DIKIRIM', 'DIKIRIM']);

      // Cascade: cancel associated invoice
      await supabase.from('invoices').update({
        payment_status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Pesanan dibatalkan: ${cancelReason.trim()}`,
      }).eq('order_id', selected.id);

      await logAudit('Pesanan', 'UPDATE', selected.id, { status: selected.status } as Record<string, unknown>, { status: 'BATAL', reason: cancelReason });
    }

    await load();
    setModal(null);
    setCancelling(false);
  }

  async function createInvoice(o: Order) {
    const existing = await supabase.from('invoices').select('id').eq('order_id', o.id).maybeSingle();
    if (!existing.data) {
      const invNum = `INV-${o.order_number.replace('ORD-', '')}`;
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('invoices').insert({
        invoice_number: invNum, order_id: o.id, customer_id: o.customer_id,
        total_amount: o.total_amount, remaining_amount: o.total_amount,
        created_by: user?.id,
      });
    }
  }

  async function handlePrintNota(o: Order) {
    await createInvoice(o);
    await openNota(o);
  }

  const filtered = orders.filter(o => {
    const matchTab = tab === 'all' || o.status === tab;
    const matchSearch = !search || (o.order_number.toLowerCase().includes(search.toLowerCase()) || (o.customers?.name || '').toLowerCase().includes(search.toLowerCase()));
    return matchTab && matchSearch;
  });

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'BARU', label: 'Baru' },
    { id: 'DIPROSES', label: 'Diproses' },
    { id: 'SELESAI', label: 'Selesai' },
    { id: 'BATAL', label: 'Dibatalkan' },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case 'SELESAI': return 'badge-green';
      case 'DIPROSES': return 'badge-blue';
      case 'BATAL': return 'badge-red';
      default: return 'badge-slate';
    }
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Pesanan</h1>
          <p className="page-subtitle">Kelola pesanan penjualan</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={openNew}><Plus size={16} />Tambah Pesanan</button>}
      </div>

      {/* Auto-cancel notification */}
      {autoCancelCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {autoCancelCount} pesanan dibatalkan otomatis karena tidak dikirim dalam 3 bulan.
            </p>
            <button className="text-xs text-amber-600 underline mt-1" onClick={() => { setTab('BATAL'); setAutoCancelCount(0); }}>
              Lihat pesanan yang dibatalkan
            </button>
          </div>
          <button className="ml-auto text-amber-400 hover:text-amber-600" onClick={() => setAutoCancelCount(0)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="card">
        {/* Filter tabs */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id as OrderTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
                {t.label}
                {t.id === 'BATAL' && orders.filter(o => o.status === 'BATAL').length > 0 && (
                  <span className="ml-1.5 bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded-full">
                    {orders.filter(o => o.status === 'BATAL').length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 w-48" placeholder="Cari pesanan..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>No Pesanan</th><th>Pelanggan</th><th>Tgl Kirim</th><th>Total</th><th>Status</th><th>Bayar</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada pesanan</td></tr> : filtered.map(o => (
                  <tr key={o.id} className={o.status === 'BATAL' ? 'opacity-60' : ''}>
                    <td className="font-mono text-xs text-blue-700 font-semibold">{o.order_number}</td>
                    <td>{o.customers?.name}</td>
                    <td className="text-xs text-slate-500">{formatDate(o.delivery_date)}</td>
                    <td className="font-medium">{formatRupiah(o.total_amount)}</td>
                    <td>
                      <span className={statusBadge(o.status)}>{o.status === 'BATAL' ? 'BATAL' : o.status}</span>
                    </td>
                    <td>
                      <span className={o.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{o.payment_status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-secondary btn-sm" onClick={() => openDetail(o)}><Eye size={12} /></button>
                        {canUpdate && o.status !== 'SELESAI' && o.status !== 'BATAL' && (
                          <button className="btn-secondary btn-sm" onClick={() => openEdit(o)}><Pencil size={12} /></button>
                        )}
                        {o.status !== 'BATAL' && (
                          <button className="btn-secondary btn-sm" onClick={() => handlePrintNota(o)}><Printer size={12} />Nota</button>
                        )}
                        {canUpdate && o.status !== 'SELESAI' && o.status !== 'BATAL' && (
                          <button className="btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors" onClick={() => openCancelModal(o)}>
                            <Ban size={12} />Batalkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {modal === 'form' && (
        <div className="modal-backdrop">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="font-semibold">{selected ? 'Edit Pesanan' : 'Tambah Pesanan'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="label">Pelanggan</label>
                  <select className="select" value={fCustomer} onChange={e => setFCustomer(e.target.value)}>
                    <option value="">Pilih Pelanggan</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Tgl Pesan</label><input className="input" type="date" value={fOrderDate} onChange={e => setFOrderDate(e.target.value)} /></div>
              </div>
              <div><label className="label">Tgl Kirim (Estimasi)</label><input className="input w-40" type="date" value={fDelivDate} onChange={e => setFDelivDate(e.target.value)} /></div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0 font-semibold">Produk</label>
                  <button className="btn-secondary btn-sm" onClick={() => setCart(c => [...c, { product_id: '', product_name: '', qty: '', unit_price: '', subtotal: 0 }])}><Plus size={12} />Tambah</button>
                </div>
                {cart.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2 items-center">
                    <select className="select flex-1" value={item.product_id} onChange={e => updateCart(i, 'product_id', e.target.value)}>
                      <option value="">Pilih Produk</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="input w-20" type="number" placeholder="Qty" value={item.qty} onChange={e => updateCart(i, 'qty', e.target.value)} />
                    <input className="input w-28" type="number" placeholder="Harga" value={item.unit_price} onChange={e => updateCart(i, 'unit_price', e.target.value)} />
                    <span className="text-sm text-slate-500 w-24 text-right shrink-0">{formatRupiah(item.subtotal)}</span>
                    {cart.length > 1 && <button onClick={() => setCart(c => c.filter((_, ii) => ii !== i))} className="text-red-400"><X size={16} /></button>}
                  </div>
                ))}
                <div className="flex justify-end mt-2 pt-2 border-t">
                  <span className="font-bold text-slate-800">Total: {formatRupiah(cartTotal)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveOrder} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan Pesanan</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {modal === 'cancel' && selected && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <Ban size={18} />Batalkan Pesanan
              </h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Anda akan membatalkan pesanan <span className="font-bold">{selected.order_number}</span> dari <span className="font-bold">{selected.customers?.name}</span>.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Total: {formatRupiah(selected.total_amount)}
                </p>
              </div>
              <div>
                <label className="label">Alasan Pembatalan <span className="text-red-500">*</span></label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  placeholder="Masukkan alasan pembatalan pesanan..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                Pesanan yang sudah dibatalkan tidak dapat dikembalikan. Distribusi terkait juga akan dibatalkan.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Kembali</button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                onClick={cancelOrder}
                disabled={cancelling || !cancelReason.trim()}
              >
                {cancelling ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {modal === 'detail' && selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-semibold">Detail Pesanan — {selected.order_number}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              {selected.status === 'BATAL' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <Ban size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Pesanan ini telah dibatalkan</p>
                    {selected.cancel_reason && <p className="text-xs text-red-600 mt-0.5">Alasan: {selected.cancel_reason}</p>}
                    {selected.cancelled_at && <p className="text-xs text-red-500 mt-0.5">Tanggal: {formatDate(selected.cancelled_at)}</p>}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-slate-500">Pelanggan</span><div className="font-medium">{selected.customers?.name}</div></div>
                <div><span className="text-slate-500">Wilayah</span><div>{selected.customers?.region_name || '-'}</div></div>
                <div><span className="text-slate-500">Tgl Pesan</span><div>{formatDate(selected.order_date)}</div></div>
                <div><span className="text-slate-500">Tgl Kirim</span><div>{formatDate(selected.delivery_date)}</div></div>
                <div><span className="text-slate-500">Status Pesanan</span><div><span className={statusBadge(selected.status)}>{selected.status}</span></div></div>
                <div><span className="text-slate-500">Status Bayar</span><div><span className={selected.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{selected.payment_status}</span></div></div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {orderItems.map(i => (
                      <tr key={i.id}>
                        <td>{i.products?.name}</td><td>{i.quantity} {i.products?.unit}</td>
                        <td>{formatRupiah(i.unit_price)}</td><td className="font-medium">{formatRupiah(i.subtotal)}</td>
                      </tr>
                    ))}
                    <tr className="font-bold"><td colSpan={3} className="text-right">TOTAL</td><td>{formatRupiah(selected.total_amount)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
              {selected.status !== 'BATAL' && (
                <button className="btn-primary" onClick={() => { setModal(null); handlePrintNota(selected); }}><Printer size={14} />Cetak Nota</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nota Modal */}
      {modal === 'nota' && selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header no-print">
              <h3 className="font-semibold">Nota Penjualan</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body" id="nota-print">
              {/* Nota Header */}
              <div className="flex items-start justify-between gap-4 mb-6 pb-3 border-b-2 border-slate-800">
                <div className="text-left">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Tanggal</div>
                  <div className="text-sm font-semibold text-slate-800">{formatDate(new Date().toISOString())}</div>
                  <div className="text-xs text-slate-500 mt-1">No: {selected.order_number}</div>
                </div>
                <div className="flex items-center gap-3">
                  <img src="/logo.png" alt="NEW_GR" className="w-14 h-14 rounded-full object-cover" />
                  <div className="text-right">
                    <h2 className="text-lg font-bold text-[#1a3a6b]" style={{ fontFamily: 'Plus Jakarta Sans' }}>NEW_GR-ERP</h2>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div><span className="text-slate-500">Pelanggan:</span> <span className="font-medium">{selected.customers?.name}</span></div>
                <div><span className="text-slate-500">Tgl Kirim:</span> {formatDate(selected.delivery_date)}</div>
              </div>
              <div className="table-wrap mb-4">
                <table className="data-table">
                  <thead><tr><th>Produk</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead>
                  <tbody>
                    {orderItems.map(i => (
                      <tr key={i.id}>
                        <td>{i.products?.name}</td><td>{i.quantity} {i.products?.unit}</td>
                        <td>{formatRupiah(i.unit_price)}</td><td>{formatRupiah(i.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center py-3 border-t border-b font-bold text-base">
                <span>Total</span><span>{formatRupiah(selected.total_amount)}</span>
              </div>
              <div className="mt-3 flex justify-between items-center text-sm">
                <span className="text-slate-500">Status Bayar</span>
                <span className={selected.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{selected.payment_status}</span>
              </div>
              <div className="mt-8 flex justify-end">
                <div className="text-center">
                  <div className="text-sm text-slate-500 mb-8">Hormat Kami,</div>
                  <div className="border-t border-slate-400 pt-1 text-sm font-medium w-32 text-center">NEW_GR</div>
                </div>
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
              <button className="btn-primary" onClick={() => window.print()}><Printer size={14} />Cetak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
