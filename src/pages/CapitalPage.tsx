import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CapitalEntry, OperationalCost, AccountMaster } from '../lib/types';
import { formatRupiah, formatDate, MONTHS } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, X, Loader as Loader2, Pencil, Trash2, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Tab = 'capital' | 'costs' | 'master';

export default function CapitalPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('capital', 'can_create');
  const canUpdate = hasAccess('capital', 'can_update');
  const canDelete = hasAccess('capital', 'can_delete');
  const [tab, setTab] = useState<Tab>('capital');
  const [capitals, setCapitals] = useState<CapitalEntry[]>([]);
  const [costs, setCosts] = useState<OperationalCost[]>([]);
  const [accounts, setAccounts] = useState<AccountMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  // Modals
  const [modal, setModal] = useState<'capital' | 'cost' | 'master' | null>(null);
  const [selectedCap, setSelectedCap] = useState<CapitalEntry | null>(null);
  const [selectedCost, setSelectedCost] = useState<OperationalCost | null>(null);
  const [selectedAcc, setSelectedAcc] = useState<AccountMaster | null>(null);

  const [capForm, setCapForm] = useState({ name: '', amount: '', previous_profit: '', notes: '', entry_date: new Date().toISOString().slice(0,10), account_id: '' });
  const [costForm, setCostForm] = useState({ cost_date: new Date().toISOString().slice(0,10), account_id: '', account_name: '', amount: '', description: '' });
  const [accForm, setAccForm] = useState({ name: '', type: 'Modal' as 'Modal' | 'Operasional' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [filterMonth, filterYear]);

  async function load() {
    setLoading(true);
    const [{ data: cap }, { data: cost }, { data: acc }] = await Promise.all([
      supabase.from('capital_entries').select('*').eq('period_month', filterMonth).eq('period_year', filterYear).order('entry_date'),
      supabase.from('operational_costs').select('*').eq('period_month', filterMonth).eq('period_year', filterYear).order('cost_date'),
      supabase.from('account_master').select('*').order('type').order('name'),
    ]);
    setCapitals(cap || []);
    setCosts(cost || []);
    setAccounts(acc || []);
    setLoading(false);
  }

  function openCapital(c?: CapitalEntry) {
    setSelectedCap(c || null);
    setCapForm(c ? { name: c.name, amount: String(c.amount), previous_profit: String(c.previous_profit || 0), notes: c.notes, entry_date: c.entry_date, account_id: c.account_id || '' } : { name: '', amount: '', previous_profit: '', notes: '', entry_date: new Date().toISOString().slice(0,10), account_id: '' });
    setModal('capital');
  }

  function openCost(c?: OperationalCost) {
    setSelectedCost(c || null);
    setCostForm(c ? { cost_date: c.cost_date, account_id: c.account_id || '', account_name: c.account_name, amount: String(c.amount), description: c.description } : { cost_date: new Date().toISOString().slice(0,10), account_id: '', account_name: '', amount: '', description: '' });
    setModal('cost');
  }

  function openMaster(a?: AccountMaster) {
    setSelectedAcc(a || null);
    setAccForm(a ? { name: a.name, type: a.type } : { name: '', type: 'Modal' });
    setModal('master');
  }

  async function saveCapital() {
    setSaving(true);
    const acc = accounts.find(a => a.id === capForm.account_id);
    const payload = {
      name: acc?.name || capForm.name,
      account_id: capForm.account_id || null,
      amount: Number(capForm.amount),
      previous_profit: Number(capForm.previous_profit || 0),
      notes: capForm.notes, entry_date: capForm.entry_date,
      period_month: filterMonth, period_year: filterYear,
    };
    if (selectedCap) {
      await supabase.from('capital_entries').update(payload).eq('id', selectedCap.id);
      await logAudit('Modal', 'UPDATE', selectedCap.id, selectedCap as unknown as Record<string, unknown>, payload as unknown as Record<string, unknown>);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('capital_entries').insert({ ...payload, created_by: user?.id }).select().single();
      if (data) await logAudit('Modal', 'CREATE', data.id, null, payload as unknown as Record<string, unknown>);
    }
    await load(); setModal(null); setSaving(false);
  }

  async function saveCost() {
    setSaving(true);
    const acc = accounts.find(a => a.id === costForm.account_id);
    const payload = {
      cost_date: costForm.cost_date, account_id: costForm.account_id || null,
      account_name: acc?.name || costForm.account_name,
      amount: Number(costForm.amount), description: costForm.description,
      period_month: filterMonth, period_year: filterYear,
    };
    if (selectedCost) {
      await supabase.from('operational_costs').update(payload).eq('id', selectedCost.id);
      await logAudit('Biaya', 'UPDATE', selectedCost.id, selectedCost as unknown as Record<string, unknown>, payload as unknown as Record<string, unknown>);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from('operational_costs').insert({ ...payload, created_by: user?.id }).select().single();
      if (data) await logAudit('Biaya', 'CREATE', data.id, null, payload as unknown as Record<string, unknown>);
    }
    await load(); setModal(null); setSaving(false);
  }

  async function saveAccount() {
    setSaving(true);
    if (selectedAcc) {
      await supabase.from('account_master').update(accForm).eq('id', selectedAcc.id);
    } else {
      await supabase.from('account_master').insert(accForm);
    }
    await load(); setModal(null); setSaving(false);
  }

  async function deleteCapital(id: string) {
    if (!confirm('Hapus data modal ini?')) return;
    await supabase.from('capital_entries').delete().eq('id', id);
    await logAudit('Modal', 'DELETE', id, null, null);
    await load();
  }

  async function deleteCost(id: string) {
    if (!confirm('Hapus biaya ini?')) return;
    await supabase.from('operational_costs').delete().eq('id', id);
    await logAudit('Biaya', 'DELETE', id, null, null);
    await load();
  }

  const totalCapital = capitals.reduce((s, c) => s + c.amount, 0);
  const totalCosts = costs.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Modal & Biaya Operasional</h1>
          <p className="page-subtitle">Kelola modal awal dan biaya operasional</p>
        </div>
        <button className="btn-secondary" onClick={() => openMaster()}><Settings size={15} />Master Akun</button>
      </div>

      {/* Period filter */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-center">
          <div><label className="label">Bulan</label>
            <select className="select w-36" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div><label className="label">Tahun</label>
            <input className="input w-24" type="number" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {[{ id: 'capital', label: 'Modal' }, { id: 'costs', label: 'Biaya Operasional' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'capital' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title mb-0">Daftar Modal</h2>
              <p className="text-sm text-slate-500">Total: <span className="font-bold text-blue-700">{formatRupiah(totalCapital)}</span></p>
            </div>
            {canCreate && <button className="btn-primary" onClick={() => openCapital()}><Plus size={15} />Input Modal</button>}
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tanggal</th><th>Nama Modal</th><th>Jumlah</th><th>Laba Terdahulu</th><th>Catatan</th><th>Aksi</th></tr></thead>
                <tbody>
                  {capitals.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada data modal</td></tr> : capitals.map(c => (
                    <tr key={c.id}>
                      <td className="text-xs text-slate-500">{formatDate(c.entry_date)}</td>
                      <td className="font-medium">{c.name}</td>
                      <td className="font-bold text-blue-700">{formatRupiah(c.amount)}</td>
                      <td>{c.previous_profit ? formatRupiah(c.previous_profit) : '-'}</td>
                      <td className="text-slate-400 text-xs">{c.notes || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          {canUpdate && <button className="btn-secondary btn-sm" onClick={() => openCapital(c)}><Pencil size={12} /></button>}
                          {canDelete && <button className="btn-danger btn-sm" onClick={() => deleteCapital(c.id)}><Trash2 size={12} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {capitals.length > 0 && <tr className="bg-blue-50 font-bold"><td colSpan={2}>TOTAL MODAL</td><td className="text-blue-700">{formatRupiah(totalCapital)}</td><td colSpan={3}></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'costs' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="section-title mb-0">Biaya Operasional</h2>
              <p className="text-sm text-slate-500">Total: <span className="font-bold text-red-600">{formatRupiah(totalCosts)}</span></p>
            </div>
            {canCreate && <button className="btn-primary" onClick={() => openCost()}><Plus size={15} />Input Biaya</button>}
          </div>
          {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Tanggal</th><th>Jenis Biaya</th><th>Jumlah</th><th>Keterangan</th><th>Aksi</th></tr></thead>
                <tbody>
                  {costs.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada biaya operasional</td></tr> : costs.map(c => (
                    <tr key={c.id}>
                      <td className="text-xs text-slate-500">{formatDate(c.cost_date)}</td>
                      <td className="font-medium">{c.account_name}</td>
                      <td className="font-bold text-red-600">{formatRupiah(c.amount)}</td>
                      <td className="text-slate-400 text-xs">{c.description || '-'}</td>
                      <td>
                        <div className="flex gap-1">
                          {canUpdate && <button className="btn-secondary btn-sm" onClick={() => openCost(c)}><Pencil size={12} /></button>}
                          {canDelete && <button className="btn-danger btn-sm" onClick={() => deleteCost(c.id)}><Trash2 size={12} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {costs.length > 0 && <tr className="bg-red-50 font-bold"><td colSpan={2}>TOTAL BIAYA</td><td className="text-red-600">{formatRupiah(totalCosts)}</td><td colSpan={2}></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Capital Modal */}
      {modal === 'capital' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selectedCap ? 'Edit Modal' : 'Input Modal'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Tanggal</label><input className="input" type="date" value={capForm.entry_date} onChange={e => setCapForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
              <div><label className="label">Akun Modal</label>
                <select className="select" value={capForm.account_id} onChange={e => { const acc = accounts.find(a => a.id === e.target.value); setCapForm(f => ({ ...f, account_id: e.target.value, name: acc?.name || '' })); }}>
                  <option value="">Pilih Akun Modal</option>
                  {accounts.filter(a => a.type === 'Modal').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="label">Nama Modal (atau manual)</label><input className="input" value={capForm.name} onChange={e => setCapForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Haryanto" /></div>
              <div><label className="label">Jumlah Modal (Rp)</label><input className="input" type="number" value={capForm.amount} onChange={e => setCapForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><label className="label">Laba Terdahulu (Rp)</label><input className="input" type="number" value={capForm.previous_profit} onChange={e => setCapForm(f => ({ ...f, previous_profit: e.target.value }))} /></div>
              <div><label className="label">Catatan</label><input className="input" value={capForm.notes} onChange={e => setCapForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveCapital} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Cost Modal */}
      {modal === 'cost' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selectedCost ? 'Edit Biaya' : 'Input Biaya Operasional'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Tanggal</label><input className="input" type="date" value={costForm.cost_date} onChange={e => setCostForm(f => ({ ...f, cost_date: e.target.value }))} /></div>
              <div><label className="label">Jenis Biaya</label>
                <select className="select" value={costForm.account_id} onChange={e => { const acc = accounts.find(a => a.id === e.target.value); setCostForm(f => ({ ...f, account_id: e.target.value, account_name: acc?.name || '' })); }}>
                  <option value="">Pilih Jenis Biaya</option>
                  {accounts.filter(a => a.type === 'Operasional').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="label">Jumlah (Rp)</label><input className="input" type="number" value={costForm.amount} onChange={e => setCostForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><label className="label">Keterangan (opsional)</label><input className="input" value={costForm.description} onChange={e => setCostForm(f => ({ ...f, description: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveCost} disabled={saving}>{saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* Master Account Modal */}
      {modal === 'master' && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h3 className="font-semibold">Master Akun</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body">
              <div className="flex justify-end mb-3">
                <button className="btn-primary btn-sm" onClick={() => openMaster()}><Plus size={12} />Tambah Akun</button>
              </div>
              <div className="table-wrap mb-4">
                <table className="data-table">
                  <thead><tr><th>Nama</th><th>Tipe</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {accounts.map(a => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td><span className={a.type === 'Modal' ? 'badge-blue' : 'badge-amber'}>{a.type}</span></td>
                        <td><button className="btn-secondary btn-sm" onClick={() => { setSelectedAcc(a); setAccForm({ name: a.name, type: a.type }); }}><Pencil size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(selectedAcc !== null || accForm.name !== '') && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-semibold">{selectedAcc ? 'Edit Akun' : 'Akun Baru'}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Nama</label><input className="input" value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div><label className="label">Tipe</label>
                      <select className="select" value={accForm.type} onChange={e => setAccForm(f => ({ ...f, type: e.target.value as 'Modal' | 'Operasional' }))}>
                        <option>Modal</option><option>Operasional</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="btn-secondary btn-sm" onClick={() => { setSelectedAcc(null); setAccForm({ name: '', type: 'Modal' }); }}>Batal</button>
                    <button className="btn-primary btn-sm" onClick={saveAccount} disabled={saving}>{saving ? <Loader2 size={12} className="animate-spin" /> : null}Simpan</button>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
