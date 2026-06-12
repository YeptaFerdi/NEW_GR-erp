import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Invoice, Payment } from '../lib/types';
import { formatRupiah, formatDate } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Search, X, Loader as Loader2, Eye, CreditCard, Ban } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type PayTab = 'active' | 'cancelled';

export default function PaymentsPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('payments', 'can_create');
  const canUpdate = hasAccess('payments', 'can_update');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cancelledInvoices, setCancelledInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [payTab, setPayTab] = useState<PayTab>('active');
  const [modal, setModal] = useState<'pay' | 'history' | 'cancel' | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Tunai');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0,10));
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);

    // Sync: auto-cancel invoices whose orders are already cancelled
    const { data: cancelledOrders } = await supabase.from('orders').select('id').eq('status', 'BATAL');
    if (cancelledOrders && cancelledOrders.length > 0) {
      const cancelledOrderIds = cancelledOrders.map(o => o.id);
      await supabase.from('invoices').update({
        payment_status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: 'Pesanan terkait telah dibatalkan',
      }).in('order_id', cancelledOrderIds).neq('payment_status', 'BATAL');
    }

    const [{ data: active }, { data: cancelled }] = await Promise.all([
      supabase.from('invoices')
        .select('*, customers(name), orders(order_number, delivery_date)')
        .neq('payment_status', 'BATAL')
        .order('created_at', { ascending: false }),
      supabase.from('invoices')
        .select('*, customers(name), orders(order_number, delivery_date)')
        .eq('payment_status', 'BATAL')
        .order('cancelled_at', { ascending: false })
        .limit(50),
    ]);
    setInvoices(active || []);
    setCancelledInvoices(cancelled || []);
    setLoading(false);
  }

  async function openHistory(inv: Invoice) {
    setSelected(inv);
    const { data } = await supabase.from('payments').select('*').eq('invoice_id', inv.id).order('payment_date');
    setPayments(data || []);
    setModal('history');
  }

  async function openPay(inv: Invoice) {
    setSelected(inv);
    setPayAmount(String(inv.remaining_amount));
    setPayMethod('Tunai');
    setPayDate(new Date().toISOString().slice(0,10));
    setModal('pay');
  }

  function openCancelModal(inv: Invoice) {
    setSelected(inv);
    setCancelReason('');
    setModal('cancel');
  }

  async function handlePayment() {
    if (!selected || !payAmount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('payments').insert({
      invoice_id: selected.id,
      amount: Number(payAmount),
      payment_method: payMethod,
      payment_date: payDate,
      created_by: user?.id,
    });
    await logAudit('Pembayaran', 'CREATE', selected.id, null, { amount: payAmount, method: payMethod });
    await load();
    setModal(null);
    setSaving(false);
  }

  async function cancelInvoice() {
    if (!selected || !cancelReason.trim()) return;
    setSaving(true);

    const { error } = await supabase.from('invoices').update({
      payment_status: 'BATAL',
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason.trim(),
    }).eq('id', selected.id);

    if (!error) {
      // Cascade: cancel associated order
      await supabase.from('orders').update({
        status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Pembayaran dibatalkan: ${cancelReason.trim()}`,
      }).eq('id', selected.order_id);

      // Cascade: cancel associated distribution
      await supabase.from('distributions').update({
        status: 'BATAL',
        cancelled_at: new Date().toISOString(),
        cancel_reason: `Pembayaran dibatalkan: ${cancelReason.trim()}`,
      }).eq('order_id', selected.order_id).in('status', ['BELUM DIKIRIM', 'DIKIRIM']);

      await logAudit('Pembayaran', 'UPDATE', selected.id, { payment_status: selected.payment_status } as Record<string, unknown>, { payment_status: 'BATAL', reason: cancelReason });
    }

    await load();
    setModal(null);
    setSaving(false);
  }

  const filtered = invoices.filter(i =>
    (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.customers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredCancelled = cancelledInvoices.filter(i =>
    (i.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.customers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pembayaran Penjualan</h1>
          <p className="page-subtitle">Kelola pembayaran nota / invoice</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setPayTab('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            payTab === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CreditCard size={16} />Invoice Aktif
        </button>
        <button
          onClick={() => setPayTab('cancelled')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            payTab === 'cancelled' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Ban size={16} />Dibatalkan
          {cancelledInvoices.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              payTab === 'cancelled' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
            }`}>
              {cancelledInvoices.length}
            </span>
          )}
        </button>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari nota / pelanggan..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : payTab === 'active' ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>No Nota</th><th>Pelanggan</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada invoice</td></tr> : filtered.map(inv => (
                  <tr key={inv.id}>
                    <td className="font-mono text-xs font-semibold text-blue-700">{inv.invoice_number}</td>
                    <td>{inv.customers?.name}</td>
                    <td className="font-medium">{formatRupiah(inv.total_amount)}</td>
                    <td className="text-green-700">{formatRupiah(inv.paid_amount)}</td>
                    <td className={inv.remaining_amount > 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>{formatRupiah(inv.remaining_amount)}</td>
                    <td><span className={inv.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{inv.payment_status}</span></td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn-secondary btn-sm" onClick={() => openHistory(inv)}><Eye size={12} /></button>
                        {canCreate && inv.payment_status !== 'LUNAS' && (
                          <button className="btn-primary btn-sm" onClick={() => openPay(inv)}><CreditCard size={12} />Bayar</button>
                        )}
                        {canUpdate && inv.payment_status !== 'LUNAS' && (
                          <button className="btn-sm bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1 transition-colors" onClick={() => openCancelModal(inv)}>
                            <Ban size={12} />Batal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>No Nota</th><th>Pelanggan</th><th>Total</th><th>Alasan</th><th>Tgl Dibatalkan</th></tr></thead>
              <tbody>
                {filteredCancelled.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada invoice dibatalkan</td></tr> : filteredCancelled.map(inv => (
                  <tr key={inv.id} className="opacity-75">
                    <td className="font-mono text-xs text-slate-600">{inv.invoice_number}</td>
                    <td>{inv.customers?.name}</td>
                    <td className="text-slate-600">{formatRupiah(inv.total_amount)}</td>
                    <td className="text-xs text-red-600 max-w-[200px] truncate" title={(inv as any).cancel_reason}>{(inv as any).cancel_reason || '-'}</td>
                    <td className="text-xs text-slate-500">{formatDate((inv as any).cancelled_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Form Modal */}
      {modal === 'pay' && selected && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">Input Pembayaran</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">No Nota</span><span className="font-mono font-semibold">{selected.invoice_number}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Total Nota</span><span className="font-medium">{formatRupiah(selected.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Sudah Dibayar</span><span className="text-green-700">{formatRupiah(selected.paid_amount)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-semibold">Sisa Hutang</span><span className="font-bold text-red-600">{formatRupiah(selected.remaining_amount)}</span></div>
              </div>
              <div><label className="label">Jumlah Bayar (Rp)</label><input className="input" type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} max={selected.remaining_amount} /></div>
              <div><label className="label">Metode Bayar</label>
                <select className="select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option>Tunai</option><option>Transfer</option><option>QRIS</option>
                </select>
              </div>
              <div><label className="label">Tgl Bayar</label><input className="input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                <span className="text-slate-500">Sisa setelah bayar: </span>
                <span className="font-bold text-blue-700">{formatRupiah(Math.max(0, selected.remaining_amount - Number(payAmount || 0)))}</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handlePayment} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan Pembayaran</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {modal === 'cancel' && selected && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <Ban size={18} />Batalkan Pembayaran
              </h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  Batalkan invoice <span className="font-bold">{selected.invoice_number}</span> - <span className="font-bold">{selected.customers?.name}</span>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  Total: {formatRupiah(selected.total_amount)}
                </p>
              </div>
              <div>
                <label className="label">Alasan Pembatalan <span className="text-red-500">*</span></label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  placeholder="Masukkan alasan pembatalan..."
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                Pesanan dan distribusi terkait juga akan dibatalkan. Tindakan ini tidak dapat dikembalikan.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Kembali</button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                onClick={cancelInvoice}
                disabled={saving || !cancelReason.trim()}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                Konfirmasi Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {modal === 'history' && selected && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-semibold">Riwayat Pembayaran — {selected.invoice_number}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body">
              <div className="bg-slate-50 rounded-lg p-3 text-sm mb-4 space-y-1">
                <div className="flex justify-between"><span>Total Nota</span><span className="font-medium">{formatRupiah(selected.total_amount)}</span></div>
                <div className="flex justify-between"><span>Dibayar</span><span className="text-green-700">{formatRupiah(selected.paid_amount)}</span></div>
                <div className="flex justify-between"><span>Status</span><span className={selected.payment_status === 'LUNAS' ? 'badge-green' : 'badge-amber'}>{selected.payment_status}</span></div>
              </div>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Tanggal</th><th>Metode</th><th>Jumlah</th></tr></thead>
                  <tbody>
                    {payments.length === 0 ? <tr><td colSpan={3} className="text-center py-6 text-slate-400">Belum ada pembayaran</td></tr> :
                    payments.map(p => (
                      <tr key={p.id}>
                        <td>{formatDate(p.payment_date)}</td>
                        <td>{p.payment_method}</td>
                        <td className="font-medium text-green-700">{formatRupiah(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
              {selected.payment_status !== 'LUNAS' && (
                <button className="btn-primary" onClick={() => { setModal(null); openPay(selected); }}><CreditCard size={14} />Input Pembayaran</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
