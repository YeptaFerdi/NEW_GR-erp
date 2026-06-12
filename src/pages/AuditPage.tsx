import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuditLog } from '../lib/types';
import { formatDateTime } from '../lib/format';
import { Search, Eye, Loader2 } from 'lucide-react';

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('audit_logs').select('*').order('log_timestamp', { ascending: false }).limit(200);
    setLogs(data || []);
    setLoading(false);
  }

  const filtered = logs.filter(l =>
    l.user_name.toLowerCase().includes(search.toLowerCase()) ||
    l.module.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  const actionColor: Record<string, string> = {
    CREATE: 'badge-green',
    UPDATE: 'badge-blue',
    DELETE: 'badge-red',
    READ: 'badge-slate',
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Audit Log</h1><p className="page-subtitle">Riwayat aktivitas CRUD sistem (200 terakhir)</p></div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Cari user / modul / aksi..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin text-blue-600" /></div> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Tanggal</th><th>User</th><th>Role</th><th>Modul</th><th>ID Data</th><th>Aksi</th><th>Detail</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada log</td></tr> : filtered.map(l => (
                  <tr key={l.id}>
                    <td className="text-xs text-slate-500">{formatDateTime(l.log_timestamp)}</td>
                    <td className="font-medium">{l.user_name}</td>
                    <td><span className="badge-blue text-xs">{l.user_role}</span></td>
                    <td>{l.module}</td>
                    <td className="font-mono text-xs text-slate-400">{l.data_id?.slice(0,8)}...</td>
                    <td><span className={actionColor[l.action] || 'badge-slate'}>{l.action}</span></td>
                    <td>
                      {(l.old_data || l.new_data) && (
                        <button className="btn-secondary btn-sm" onClick={() => setSelected(l)}><Eye size={12} />Detail</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="font-semibold">Detail Perubahan — {selected.module} {selected.action}</h3>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700">&#10005;</button>
            </div>
            <div className="modal-body space-y-4">
              {selected.old_data && (
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-2">Data Lama</p>
                  <pre className="bg-red-50 text-red-800 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {selected.new_data && (
                <div>
                  <p className="text-sm font-semibold text-slate-500 mb-2">Data Baru</p>
                  <pre className="bg-green-50 text-green-800 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(selected.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
