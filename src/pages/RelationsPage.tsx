import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Customer, Producer, Region } from '../lib/types';
import { formatDate } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, Search, Pencil, X, Loader2, ChevronRight, Users, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'customers' | 'producers';

interface Props {
  initialTab?: Tab;
}

export default function RelationsPage({ initialTab = 'customers' }: Props) {
  const { hasAccess } = useAuth();
  const canCreateCust = hasAccess('customers', 'can_create');
  const canUpdateCust = hasAccess('customers', 'can_update');
  const canCreateProd = hasAccess('producers', 'can_create');
  const canUpdateProd = hasAccess('producers', 'can_update');
  const [tab, setTab] = useState<Tab>(initialTab);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'customer' | 'producer' | null>(null);
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [selectedProd, setSelectedProd] = useState<Producer | null>(null);
  const [custForm, setCustForm] = useState({ name: '', region_id: '', region_name: '', address: '', phone: '', status: 'Aktif' });
  const [prodForm, setProdForm] = useState({ name: '', address: '', phone: '', status: 'Aktif' });
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { load(); }, []);
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  async function load() {
    setLoading(true);
    const [{ data: c }, { data: p }, { data: r }] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('producers').select('*').order('name'),
      supabase.from('regions').select('*').order('sort_order'),
    ]);
    setCustomers(c || []);
    setProducers(p || []);
    setRegions(r || []);
    setLoading(false);
  }

  function openCust(c?: Customer) {
    setSelectedCust(c || null);
    setCustForm(c ? { name: c.name, region_id: c.region_id || '', region_name: c.region_name, address: c.address, phone: c.phone, status: c.status } : { name: '', region_id: '', region_name: '', address: '', phone: '', status: 'Aktif' });
    setModal('customer');
  }

  function openProd(p?: Producer) {
    setSelectedProd(p || null);
    setProdForm(p ? { name: p.name, address: p.address, phone: p.phone, status: p.status } : { name: '', address: '', phone: '', status: 'Aktif' });
    setModal('producer');
  }

  async function saveCust() {
    if (!custForm.name) return;
    setSaving(true);
    const region = regions.find(r => r.id === custForm.region_id);
    const payload = { ...custForm, region_name: region?.name || custForm.region_name };
    if (selectedCust) {
      await supabase.from('customers').update(payload).eq('id', selectedCust.id);
      await logAudit('Pelanggan', 'UPDATE', selectedCust.id, selectedCust as unknown as Record<string, unknown>, payload as unknown as Record<string, unknown>);
    } else {
      const { data } = await supabase.from('customers').insert(payload).select().single();
      if (data) await logAudit('Pelanggan', 'CREATE', data.id, null, payload as unknown as Record<string, unknown>);
    }
    await load(); setModal(null); setSaving(false);
  }

  async function saveProd() {
    if (!prodForm.name) return;
    setSaving(true);
    if (selectedProd) {
      await supabase.from('producers').update(prodForm).eq('id', selectedProd.id);
      await logAudit('Produsen', 'UPDATE', selectedProd.id, selectedProd as unknown as Record<string, unknown>, prodForm as unknown as Record<string, unknown>);
    } else {
      const { data } = await supabase.from('producers').insert(prodForm).select().single();
      if (data) await logAudit('Produsen', 'CREATE', data.id, null, prodForm as unknown as Record<string, unknown>);
    }
    await load(); setModal(null); setSaving(false);
  }

  const filteredC = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.region_name.toLowerCase().includes(search.toLowerCase()));
  const filteredP = producers.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const displayC = showAll ? filteredC : filteredC.slice(0, 5);
  const displayP = showAll ? filteredP : filteredP.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Relasi Bisnis</h1>
          <p className="page-subtitle">Kelola pelanggan dan produsen/pemasok</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ id: 'customers', label: 'Pelanggan', icon: <Users size={14} /> }, { id: 'producers', label: 'Produsen', icon: <Building2 size={14} /> }].map(t => (
          <button key={t.id} onClick={() => { setTab(t.id as Tab); setSearch(''); setShowAll(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === 'customers' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="section-title mb-0">Daftar Pelanggan</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9 w-48" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {canCreateCust && <button className="btn-primary" onClick={() => openCust()}><Plus size={15} />Tambah</button>}
            </div>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Nama</th><th>Wilayah</th><th>Alamat</th><th>No Telepon</th><th>Status</th><th>Terakhir Pesan</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {displayC.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada pelanggan</td></tr> : displayC.map(c => (
                      <tr key={c.id}>
                        <td className="font-medium">{c.name}</td>
                        <td>{c.region_name}</td>
                        <td className="max-w-xs truncate text-slate-500">{c.address || '-'}</td>
                        <td>{c.phone || '-'}</td>
                        <td><span className={c.status === 'Aktif' ? 'badge-green' : 'badge-red'}>{c.status}</span></td>
                        <td className="text-slate-400 text-xs">{formatDate(c.last_order_at)}</td>
                        <td>{canUpdateCust && <button className="btn-secondary btn-sm" onClick={() => openCust(c)}><Pencil size={13} />Edit</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredC.length > 5 && (
                <button onClick={() => setShowAll(!showAll)} className="mt-3 text-blue-600 hover:underline text-sm flex items-center gap-1">
                  {showAll ? 'Tampilkan Lebih Sedikit' : `Lihat Semua (${filteredC.length})`}<ChevronRight size={14} />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'producers' && (
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="section-title mb-0">Daftar Produsen / Pemasok</h2>
            <div className="flex gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="input pl-9 w-48" placeholder="Cari..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              {canCreateProd && <button className="btn-primary" onClick={() => openProd()}><Plus size={15} />Tambah</button>}
            </div>
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Nama Produsen</th><th>Alamat</th><th>No Telepon</th><th>Status</th><th>Jumlah Produk</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {displayP.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada produsen</td></tr> : displayP.map(p => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="text-slate-500">{p.address || '-'}</td>
                        <td>{p.phone || '-'}</td>
                        <td><span className={p.status === 'Aktif' ? 'badge-green' : 'badge-red'}>{p.status}</span></td>
                        <td><span className="badge-blue">{p.total_products}</span></td>
                        <td>{canUpdateProd && <button className="btn-secondary btn-sm" onClick={() => openProd(p)}><Pencil size={13} />Edit</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredP.length > 5 && (
                <button onClick={() => setShowAll(!showAll)} className="mt-3 text-blue-600 hover:underline text-sm flex items-center gap-1">
                  {showAll ? 'Tampilkan Lebih Sedikit' : `Lihat Semua (${filteredP.length})`}<ChevronRight size={14} />
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Customer Modal */}
      {modal === 'customer' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selectedCust ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Nama Pelanggan</label><input className="input" value={custForm.name} onChange={e => setCustForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Wilayah</label>
                <select className="select" value={custForm.region_id} onChange={e => { const r = regions.find(x => x.id === e.target.value); setCustForm(f => ({ ...f, region_id: e.target.value, region_name: r?.name || '' })); }}>
                  <option value="">Pilih Wilayah</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div><label className="label">Alamat</label><input className="input" value={custForm.address} onChange={e => setCustForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">No Telepon</label><input className="input" value={custForm.phone} onChange={e => setCustForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="label">Status</label>
                <select className="select" value={custForm.status} onChange={e => setCustForm(f => ({ ...f, status: e.target.value }))}>
                  <option>Aktif</option><option>Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveCust} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Producer Modal */}
      {modal === 'producer' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selectedProd ? 'Edit Produsen' : 'Tambah Produsen'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Nama Produsen</label><input className="input" value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Alamat</label><input className="input" value={prodForm.address} onChange={e => setProdForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">No Telepon</label><input className="input" value={prodForm.phone} onChange={e => setProdForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div><label className="label">Status</label>
                <select className="select" value={prodForm.status} onChange={e => setProdForm(f => ({ ...f, status: e.target.value }))}>
                  <option>Aktif</option><option>Nonaktif</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveProd} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
