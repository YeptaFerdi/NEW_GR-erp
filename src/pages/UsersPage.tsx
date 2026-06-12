import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Role } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { logAudit } from '../lib/audit';
import { Plus, Search, Pencil, X, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function UsersPage() {
  const { hasAccess } = useAuth();
  const canCreate = hasAccess('users', 'can_create');
  const canUpdate = hasAccess('users', 'can_update');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role_id: '', role_name: '', status: 'Aktif', password: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: u }, { data: r }] = await Promise.all([
      supabase.from('users_profile').select('*').order('created_at', { ascending: false }),
      supabase.from('roles').select('*').order('name'),
    ]);
    setUsers(u || []);
    setRoles(r || []);
    setLoading(false);
  }

  function openAdd() {
    setForm({ name: '', email: '', role_id: '', role_name: '', status: 'Aktif', password: '' });
    setMsg('');
    setModal('add');
  }

  function openEdit(u: UserProfile) {
    setSelected(u);
    setForm({ name: u.name, email: u.email, role_id: u.role_id || '', role_name: u.role_name, status: u.status, password: '' });
    setMsg('');
    setModal('edit');
  }

  function handleRoleChange(roleId: string) {
    const role = roles.find(r => r.id === roleId);
    setForm(f => ({ ...f, role_id: roleId, role_name: role?.name || '' }));
  }

  async function handleSave() {
    if (!form.name || !form.email) { setMsg('Nama dan email wajib diisi.'); return; }
    setSaving(true);
    setMsg('');
    if (modal === 'add') {
      if (!form.password) { setMsg('Password wajib diisi untuk user baru.'); setSaving(false); return; }
      const { data: authData, error: authErr } = await supabase.auth.admin
        ? { data: null, error: new Error('not admin') }
        : { data: null, error: new Error('not admin') };
      // Use signUp for creating users (in production use admin API)
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } }
      });
      if (signUpErr) { setMsg(signUpErr.message); setSaving(false); return; }
      if (signUpData.user) {
        const { error: profileErr } = await supabase.from('users_profile').insert({
          id: signUpData.user.id,
          name: form.name,
          email: form.email,
          role_id: form.role_id || null,
          role_name: form.role_name || 'Staff',
          status: form.status,
        });
        if (profileErr) { setMsg(profileErr.message); setSaving(false); return; }
        await logAudit('User', 'CREATE', signUpData.user.id, null, { name: form.name, email: form.email });
      }
    } else if (modal === 'edit' && selected) {
      const { error } = await supabase.from('users_profile').update({
        name: form.name,
        role_id: form.role_id || null,
        role_name: form.role_name || 'Staff',
        status: form.status,
      }).eq('id', selected.id);
      if (error) { setMsg(error.message); setSaving(false); return; }
      await logAudit('User', 'UPDATE', selected.id, selected as unknown as Record<string, unknown>, form as unknown as Record<string, unknown>);
    }
    await load();
    setModal(null);
    setSaving(false);
  }

  async function handleResetPw() {
    if (!selected) return;
    const confirmed = window.confirm(
      `Reset password user "${selected.name}" ke default (newgr2025)?\nUser harus mengganti password setelah login.`
    );
    if (!confirmed) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ user_id: selected.id }),
        }
      );
      const result = await res.json();
      if (result.success) {
        setMsg(`Password berhasil direset ke: ${result.default_password}`);
      } else {
        setMsg(`Gagal reset: ${result.error}`);
      }
    } catch {
      setMsg('Gagal menghubungi server.');
    }
    setSaving(false);
  }

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen User</h1>
          <p className="page-subtitle">Kelola akses pengguna sistem</p>
        </div>
        {canCreate && <button className="btn-primary" onClick={openAdd}><Plus size={16} />Tambah User</button>}
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari nama / email..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-600" /></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Terakhir Login</th><th>Aksi</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-slate-400 py-8">Belum ada data user</td></tr>
                ) : filtered.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.name}</td>
                    <td className="text-slate-500">{u.email}</td>
                    <td><span className="badge-blue">{u.role_name}</span></td>
                    <td><span className={u.status === 'Aktif' ? 'badge-green' : 'badge-red'}>{u.status}</span></td>
                    <td className="text-slate-400 text-xs">{formatDateTime(u.last_login)}</td>
                    <td>
                      {canUpdate && <button className="btn-secondary btn-sm" onClick={() => openEdit(u)}><Pencil size={13} />Edit</button>}
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
              <h3 className="font-semibold text-slate-800">{modal === 'add' ? 'Tambah User' : 'Edit User'}</h3>
              <button onClick={() => setModal(null)}><X size={20} className="text-slate-400" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div><label className="label">Nama</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Email</label>
                <input className="input" type="email" value={form.email} readOnly={modal === 'edit'}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              {modal === 'add' && (
                <div><label className="label">Password</label>
                  <input className="input" type="password" value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              )}
              <div><label className="label">Role</label>
                <select className="select" value={form.role_id} onChange={e => handleRoleChange(e.target.value)}>
                  <option value="">Pilih Role</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div><label className="label">Status</label>
                <select className="select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option>Aktif</option><option>Nonaktif</option>
                </select>
              </div>
              {msg && <p className={`text-sm ${msg.includes('berhasil') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
            </div>
            <div className="modal-footer">
              {modal === 'edit' && (
                <button className="btn-secondary mr-auto" onClick={handleResetPw} disabled={saving}>
                  <KeyRound size={14} />Reset PW
                </button>
              )}
              <button className="btn-secondary" onClick={() => setModal(null)}>Batal</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
