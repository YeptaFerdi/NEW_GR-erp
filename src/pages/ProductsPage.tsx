import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Product, Producer } from '../lib/types';
import { formatRupiah } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, Search, Pencil, X, Loader2, Image as ImageIcon, Power } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import { useAuth } from '../contexts/AuthContext';

export default function ProductsPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('products', 'can_create');
  const canUpdate = hasAccess('products', 'can_update');
  const [products, setProducts] = useState<Product[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', unit: 'Kg', buy_price: '', sell_price: '', producer_id: '', image_url: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: pr }] = await Promise.all([
      supabase.from('products').select('*, producers(name)').order('name'),
      supabase.from('producers').select('*').eq('status', 'Aktif').order('name'),
    ]);
    setProducts(p || []);
    setProducers(pr || []);
    setLoading(false);
  }

  function openAdd() {
    setSelected(null);
    setForm({ name: '', unit: 'Kg', buy_price: '', sell_price: '', producer_id: '', image_url: '' });
    setModal(true);
  }

  function openEdit(p: Product) {
    setSelected(p);
    setForm({ name: p.name, unit: p.unit, buy_price: String(p.buy_price), sell_price: String(p.sell_price), producer_id: p.producer_id, image_url: p.image_url });
    setModal(true);
  }

  async function toggleStatus(p: Product) {
    const newStatus = p.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    if (p.status === 'Aktif' && p.current_stock > 0) {
      const confirmed = window.confirm(
        `Produk "${p.name}" masih memiliki stok ${p.current_stock} ${p.unit}. ` +
        `Produk akan dinonaktifkan tetapi masih bisa habiskan stok yang ada. Lanjutkan?`
      );
      if (!confirmed) return;
    }
    await supabase.from('products').update({ status: newStatus }).eq('id', p.id);
    await logAudit('Produk', 'UPDATE', p.id, { status: p.status } as unknown as Record<string, unknown>, { status: newStatus } as unknown as Record<string, unknown>);
    await load();
  }

  async function handleSave() {
    if (!form.name || !form.producer_id) return;
    setSaving(true);
    const payload = {
      name: form.name, unit: form.unit,
      buy_price: Number(form.buy_price), sell_price: Number(form.sell_price),
      producer_id: form.producer_id, image_url: form.image_url,
    };
    if (selected) {
      await supabase.from('products').update(payload).eq('id', selected.id);
      await logAudit('Produk', 'UPDATE', selected.id, selected as unknown as Record<string, unknown>, payload as unknown as Record<string, unknown>);
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single();
      if (data) {
        const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('producer_id', form.producer_id);
        await supabase.from('producers').update({ total_products: count || 0 }).eq('id', form.producer_id);
        await logAudit('Produk', 'CREATE', data.id, null, payload as unknown as Record<string, unknown>);
      }
    }
    await load(); setModal(false); setSaving(false);
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.producers?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Produk</h1>
          <p className="page-subtitle">Master data produk krupuk</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={openAdd}><Plus size={16} />Tambah Produk</button>}
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari produk..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Produk</th><th>Satuan</th><th>Harga Beli</th><th>Harga Jual</th><th>Stok</th><th>Produsen</th><th>Status</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">Belum ada produk</td></tr> : filtered.map(p => (
                  <tr key={p.id} className={p.status === 'Nonaktif' && p.current_stock === 0 ? 'opacity-50' : ''}>
                    <td>
                      <div className="flex items-center gap-2">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover" />
                        ) : (
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                            <ImageIcon size={14} className="text-slate-400" />
                          </div>
                        )}
                        <div>
                          <span className="font-medium">{p.name}</span>
                          {p.status === 'Nonaktif' && p.current_stock > 0 && (
                            <span className="block text-xs text-amber-600">Habiskan stok sebelum nonaktif penuh</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{p.unit}</td>
                    <td>{formatRupiah(p.buy_price)}</td>
                    <td className="text-green-700 font-medium">{formatRupiah(p.sell_price)}</td>
                    <td>
                      <span className={p.current_stock < 10 ? 'badge-red' : 'badge-blue'}>
                        {p.current_stock} {p.unit}
                      </span>
                    </td>
                    <td className="text-slate-500">{p.producers?.name || '-'}</td>
                    <td>
                      <span className={p.status === 'Aktif' ? 'badge-green' : 'badge-red'}>{p.status}</span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        {canUpdate && <button className="btn-secondary btn-sm" onClick={() => openEdit(p)}><Pencil size={13} />Edit</button>}
                        {canUpdate && (
                          <button
                            className={`btn-sm ${p.status === 'Aktif' ? 'btn-danger' : 'btn-primary'}`}
                            onClick={() => toggleStatus(p)}
                            title={p.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <Power size={13} />
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

      {modal && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selected ? 'Edit Produk' : 'Tambah Produk'}</h3>
              <button onClick={() => setModal(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Nama Produk</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Satuan</label>
                  <select className="select" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option>Kg</option><option>bal</option><option>sak</option><option>Pcs</option><option>Pak</option><option>Karton</option>
                  </select>
                </div>
                <div><label className="label">Produsen</label>
                  <select className="select" value={form.producer_id} onChange={e => setForm(f => ({ ...f, producer_id: e.target.value }))}>
                    <option value="">Pilih Produsen</option>
                    {producers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Harga Beli (Rp)</label><input className="input" type="number" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} /></div>
                <div><label className="label">Harga Jual (Rp)</label><input className="input" type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} /></div>
              </div>
              <ImageUpload value={form.image_url} onChange={url => setForm(f => ({ ...f, image_url: url }))} folder="products" label="Gambar Produk (opsional)" />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(false)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
