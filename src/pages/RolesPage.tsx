import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Role, Permission } from '../lib/types';
import { logAudit } from '../lib/audit';
import { Plus, Pencil, X, Loader2, Shield, ChevronRight } from 'lucide-react';

const MODULES = ['Dashboard','User','Role','Pelanggan','Produsen','Produk','Stok','Pesanan','Distribusi','Pembayaran','Modal','Laporan','Audit'];

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'role' | 'permission' | null>(null);
  const [selected, setSelected] = useState<Role | null>(null);
  const [perms, setPerms] = useState<Record<string, { c: boolean; r: boolean; u: boolean; d: boolean }>>({});
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('roles').select('*').order('name');
    setRoles(data || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ name: '', description: '' });
    setSelected(null);
    setMsg('');
    setModal('role');
  }

  function openEdit(r: Role) {
    setSelected(r);
    setForm({ name: r.name, description: r.description });
    setMsg('');
    setModal('role');
  }

  async function openPerms(r: Role) {
    setSelected(r);
    const { data } = await supabase.from('permissions').select('*').eq('role_id', r.id);
    const map: typeof perms = {};
    MODULES.forEach(m => {
      const p = (data || []).find((x: Permission) => x.module === m);
      map[m] = { c: p?.can_create || false, r: p?.can_read || false, u: p?.can_update || false, d: p?.can_delete || false };
    });
    setPerms(map);
    setModal('permission');
  }

  async function saveRole() {
    if (!form.name) { setMsg('Nama role wajib diisi.'); return; }
    setSaving(true);
    if (selected) {
      await supabase.from('roles').update({ name: form.name, description: form.description }).eq('id', selected.id);
      await logAudit('Role', 'UPDATE', selected.id, selected as unknown as Record<string, unknown>, form as unknown as Record<string, unknown>);
    } else {
      const { data } = await supabase.from('roles').insert({ name: form.name, description: form.description }).select().single();
      if (data) await logAudit('Role', 'CREATE', data.id, null, form as unknown as Record<string, unknown>);
    }
    await load();
    setModal(null);
    setSaving(false);
  }

  async function savePerms() {
    if (!selected) return;
    setSaving(true);
    for (const [module, p] of Object.entries(perms)) {
      await supabase.from('permissions').upsert({
        role_id: selected.id, module,
        can_create: p.c, can_read: p.r, can_update: p.u, can_delete: p.d,
      }, { onConflict: 'role_id,module' });
    }
    setModal(null);
    setSaving(false);
  }

  function resetPerms() {
    const map: typeof perms = {};
    MODULES.forEach(m => { map[m] = { c: false, r: false, u: false, d: false }; });
    setPerms(map);
  }

  function togglePerm(mod: string, key: 'c'|'r'|'u'|'d') {
    setPerms(p => ({ ...p, [mod]: { ...p[mod], [key]: !p[mod][key] } }));
  }

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Role & Permission</h1>
          <p className="page-subtitle">Kelola hak akses per role</p>
        </div>
        <button className="btn-primary" onClick={openAdd}><Plus size={16} />Tambah Role</button>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Nama Role</th><th>Deskripsi</th><th>Aksi</th></tr></thead>
              <tbody>
                {roles.map(r => (
                  <tr key={r.id}>
                    <td>
                      <button className="font-semibold text-blue-700 hover:underline flex items-center gap-1"
                        onClick={() => openPerms(r)}>
                        <Shield size={14} />{r.name}<ChevronRight size={13} />
                      </button>
                    </td>
                    <td className="text-slate-500">{r.description}</td>
                    <td>
                      <button className="btn-secondary btn-sm" onClick={() => openEdit(r)}><Pencil size={13} />Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Form Modal */}
      {modal === 'role' && (
        <div className="modal-backdrop">
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3 className="font-semibold">{selected ? 'Edit Role' : 'Tambah Role'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Nama Role</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Deskripsi</label>
                <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              {msg && <p className="text-sm text-red-600">{msg}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={saveRole} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission Modal */}
      {modal === 'permission' && selected && (
        <div className="modal-backdrop">
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="font-semibold">Permission: {selected.name}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body">
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th>Modul</th>
                    <th className="text-center">Create (C)</th>
                    <th className="text-center">Read (R)</th>
                    <th className="text-center">Update (U)</th>
                    <th className="text-center">Delete (D)</th>
                  </tr></thead>
                  <tbody>
                    {MODULES.map(mod => (
                      <tr key={mod}>
                        <td className="font-medium">{mod}</td>
                        {(['c','r','u','d'] as const).map(k => (
                          <td key={k} className="text-center">
                            <input type="checkbox" checked={perms[mod]?.[k] || false}
                              onChange={() => togglePerm(mod, k)}
                              className="w-4 h-4 accent-blue-600 cursor-pointer" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-danger btn-sm mr-auto" onClick={resetPerms}>Reset Permission</button>
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={savePerms} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
