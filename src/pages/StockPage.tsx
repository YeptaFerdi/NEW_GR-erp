import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Producer, StockMovement } from '../lib/types';
import { formatRupiah, formatDate } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, Search, X, Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface StockInItem { product_id: string; qty: string; buy_price: string; }

export default function StockPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('stock', 'can_create');
  const [products, setProducts] = useState<Product[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'in' | 'return' | null>(null);

  // Stock in form
  const [inDate, setInDate] = useState(new Date().toISOString().slice(0,10));
  const [inProducer, setInProducer] = useState('');
  const [inMethod, setInMethod] = useState('Cash');
  const [inItems, setInItems] = useState<StockInItem[]>([{ product_id: '', qty: '', buy_price: '' }]);

  // Return form
  const [retDate, setRetDate] = useState(new Date().toISOString().slice(0,10));
  const [retProduct, setRetProduct] = useState('');
  const [retQty, setRetQty] = useState('');
  const [retReason, setRetReason] = useState('Rusak');
  const [retDesc, setRetDesc] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: pr }, { data: m }] = await Promise.all([
      supabase.from('products').select('*, producers(name)').order('name'),
      supabase.from('producers').select('*').eq('status', 'Aktif').order('name'),
      supabase.from('stock_movements').select('*, products(name, unit), producers(name)').order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts(p || []);
    setProducers(pr || []);
    setMovements(m || []);
    setLoading(false);
  }

  function filteredProducts(producerId: string) {
    if (!producerId) return products;
    return products.filter(p => p.producer_id === producerId);
  }

  function addInItem() { setInItems(i => [...i, { product_id: '', qty: '', buy_price: '' }]); }
  function removeInItem(idx: number) { setInItems(i => i.filter((_, ii) => ii !== idx)); }
  function updateInItem(idx: number, field: keyof StockInItem, val: string) {
    setInItems(items => {
      const next = [...items];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'product_id' && val) {
        const prod = products.find(p => p.id === val);
        if (prod) next[idx].buy_price = String(prod.buy_price);
      }
      return next;
    });
  }

  async function saveStockIn() {
    if (!inItems.some(i => i.product_id && i.qty)) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    for (const item of inItems) {
      if (!item.product_id || !item.qty) continue;
      const qty = Number(item.qty);
      const bp = Number(item.buy_price);
      await supabase.from('stock_movements').insert({
        type: 'IN', move_date: inDate, producer_id: inProducer || null,
        product_id: item.product_id, quantity: qty, buy_price: bp,
        payment_method: inMethod, created_by: user?.id,
      });
      await supabase.from('products').update({ current_stock: (products.find(p => p.id === item.product_id)?.current_stock || 0) + qty }).eq('id', item.product_id);
      await logAudit('Stok', 'CREATE', item.product_id, null, { type: 'IN', qty, buy_price: bp });
    }
    await load(); setModal(null); setSaving(false);
  }

  async function saveReturn() {
    if (!retProduct || !retQty) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const qty = Number(retQty);
    const prod = products.find(p => p.id === retProduct);
    await supabase.from('stock_movements').insert({
      type: 'RETURN', move_date: retDate, product_id: retProduct,
      quantity: qty, reason: `${retReason}: ${retDesc}`, created_by: user?.id,
    });
    await supabase.from('products').update({ current_stock: Math.max(0, (prod?.current_stock || 0) - qty) }).eq('id', retProduct);
    await logAudit('Stok', 'UPDATE', retProduct, { stock: prod?.current_stock }, { stock: (prod?.current_stock || 0) - qty, reason: retReason });
    await load(); setModal(null); setSaving(false);
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.producers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Stok</h1>
          <p className="page-subtitle">Kelola stok masuk dan keluar</p>
        </div>
        {canCreate && (
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => { setInItems([{ product_id: '', qty: '', buy_price: '' }]); setInProducer(''); setModal('in'); }}>
              <ArrowDownCircle size={16} />Stok Masuk
            </button>
            <button className="btn-secondary" onClick={() => setModal('return')}>
              <ArrowUpCircle size={16} />Stok Retur
            </button>
          </div>
        )}
      </div>

      {/* Current Stock */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="section-title mb-0">Saldo Stok Saat Ini</h2>
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9 w-48" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Produk</th><th>Stok</th><th>Satuan</th><th>Produsen</th><th>Nilai Stok</th></tr></thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td><span className={p.current_stock < 10 ? 'badge-red' : p.current_stock < 50 ? 'badge-amber' : 'badge-green'}>{p.current_stock}</span></td>
                    <td>{p.unit}</td>
                    <td className="text-slate-500">{p.producers?.name || '-'}</td>
                    <td className="font-medium">{formatRupiah(p.current_stock * p.buy_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movement History */}
      <div className="card">
        <h2 className="section-title">Riwayat Pergerakan Stok (50 Terakhir)</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Tanggal</th><th>Tipe</th><th>Produk</th><th>Qty</th><th>Harga</th><th>Keterangan</th></tr></thead>
            <tbody>
              {movements.length === 0 ? <tr><td colSpan={6} className="text-center py-6 text-slate-400">Belum ada pergerakan</td></tr> : movements.map(m => (
                <tr key={m.id}>
                  <td className="text-xs text-slate-500">{formatDate(m.move_date)}</td>
                  <td>
                    <span className={m.type === 'IN' ? 'badge-green' : m.type === 'RETURN' ? 'badge-amber' : 'badge-red'}>
                      {m.type === 'IN' ? 'Masuk' : m.type === 'RETURN' ? 'Retur' : m.type === 'DISTRIBUTION' ? 'Distribusi' : 'Keluar'}
                    </span>
                  </td>
                  <td className="font-medium">{m.products?.name || '-'}</td>
                  <td>{m.quantity} {m.products?.unit}</td>
                  <td>{m.buy_price ? formatRupiah(m.buy_price) : '-'}</td>
                  <td className="text-slate-400 text-xs">{m.reason || m.payment_method || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock In Modal */}
      {modal === 'in' && (
        <div className="modal-backdrop">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="font-semibold">Form Stok Masuk</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Tanggal</label><input className="input" type="date" value={inDate} onChange={e => setInDate(e.target.value)} /></div>
                <div><label className="label">Produsen</label>
                  <select className="select" value={inProducer} onChange={e => setInProducer(e.target.value)}>
                    <option value="">Pilih Produsen</option>
                    {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Produk</label>
                  <button className="btn-secondary btn-sm" onClick={addInItem}><Plus size={12} />Tambah Produk</button>
                </div>
                {inItems.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <select className="select flex-1" value={item.product_id} onChange={e => updateInItem(i, 'product_id', e.target.value)}>
                      <option value="">Pilih Produk</option>
                      {filteredProducts(inProducer).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="input w-24" type="number" placeholder="Qty" value={item.qty} onChange={e => updateInItem(i, 'qty', e.target.value)} />
                    <input className="input w-28" type="number" placeholder="Harga Beli" value={item.buy_price} onChange={e => updateInItem(i, 'buy_price', e.target.value)} />
                    {inItems.length > 1 && <button onClick={() => removeInItem(i)} className="text-red-500 hover:text-red-700"><X size={16} /></button>}
                  </div>
                ))}
              </div>

              <div><label className="label">Metode Pembayaran</label>
                <select className="select" value={inMethod} onChange={e => setInMethod(e.target.value)}>
                  <option>Cash</option><option>Transfer</option><option>Kredit</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveStockIn} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {modal === 'return' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">Form Stok Retur</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Tanggal</label><input className="input" type="date" value={retDate} onChange={e => setRetDate(e.target.value)} /></div>
              <div><label className="label">Produk</label>
                <select className="select" value={retProduct} onChange={e => setRetProduct(e.target.value)}>
                  <option value="">Pilih Produk</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stok: {p.current_stock})</option>)}
                </select>
              </div>
              <div><label className="label">Jumlah</label><input className="input" type="number" value={retQty} onChange={e => setRetQty(e.target.value)} /></div>
              <div><label className="label">Tujuan / Alasan</label>
                <select className="select" value={retReason} onChange={e => setRetReason(e.target.value)}>
                  <option>Rusak</option><option>Quality Issue</option><option>Retur ke Produsen</option><option>Kadaluarsa</option>
                </select>
              </div>
              <div><label className="label">Keterangan (opsional)</label><input className="input" value={retDesc} onChange={e => setRetDesc(e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveReturn} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
