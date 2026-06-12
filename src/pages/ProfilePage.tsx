import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, User, Mail, Phone, MapPin, Lock, Camera, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { profile, user } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [address, setAddress] = useState(profile?.address || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('uploads').upload(path, file, { cacheControl: '3600', upsert: false });
    if (!error) {
      const { data } = supabase.storage.from('uploads').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    }
    setUploading(false);
  }

  async function handleSaveProfile() {
    if (!name.trim()) return;
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from('users_profile').update({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      avatar_url: avatarUrl,
    }).eq('id', user?.id);

    if (error) {
      setMessage({ type: 'error', text: 'Gagal menyimpan profil.' });
    } else {
      setMessage({ type: 'success', text: 'Profil berhasil diperbarui.' });
    }
    setSaving(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMessage({ type: 'error', text: 'Password baru tidak cocok.' });
      return;
    }
    if (newPw.length < 8) {
      setPwMessage({ type: 'error', text: 'Password minimal 8 karakter.' });
      return;
    }
    setSavingPw(true);
    setPwMessage(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: profile?.email || '',
      password: currentPw,
    });
    if (signInError) {
      setPwMessage({ type: 'error', text: 'Password saat ini salah.' });
      setSavingPw(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setPwMessage({ type: 'error', text: error.message });
    } else {
      setPwMessage({ type: 'success', text: 'Password berhasil diperbarui.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    }
    setSavingPw(false);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="page-title">Profil Saya</h1>
        <p className="page-subtitle">Kelola informasi pribadi Anda</p>
      </div>

      <div className="card">
        {/* Avatar upload area */}
        <div className="flex flex-col items-center mb-6">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleAvatarUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="relative group cursor-pointer"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-28 h-28 rounded-full object-cover ring-4 ring-blue-100" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center ring-4 ring-blue-100">
                <span className="text-4xl font-bold text-white">{profile?.name?.[0]?.toUpperCase() || 'U'}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              {uploading ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : (
                <Camera size={24} className="text-white" />
              )}
            </div>
          </button>
          <p className="text-xs text-slate-400 mt-2">Klik foto untuk mengganti</p>
          <div className="mt-3 text-center">
            <h2 className="text-lg font-semibold text-slate-800">{profile?.name}</h2>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="badge-blue">{profile?.role_name}</span>
              <span className={profile?.status === 'Aktif' ? 'badge-green' : 'badge-red'}>{profile?.status}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label flex items-center gap-1.5"><User size={13} />Nama Lengkap</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Mail size={13} />Email</label>
            <input className="input bg-slate-50 text-slate-500 cursor-not-allowed" value={profile?.email || ''} readOnly />
            <p className="text-xs text-slate-400 mt-1">Email tidak dapat diubah</p>
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><MapPin size={13} />Alamat</label>
            <textarea className="input min-h-[80px]" value={address} onChange={e => setAddress(e.target.value)} placeholder="Masukkan alamat..." />
          </div>
          <div>
            <label className="label flex items-center gap-1.5"><Phone size={13} />No. Telepon / WhatsApp</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="08xx-xxxx-xxxx" />
          </div>

          {message && (
            <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          <button className="btn-primary w-full justify-center" onClick={handleSaveProfile} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            Simpan Profil
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Lock size={16} />Ubah Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label">Password Saat Ini</label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                className="input pr-10"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Password Baru</label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                className="input pr-10"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 karakter"
              />
              <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Konfirmasi Password Baru</label>
            <div className="relative">
              <input
                type={showConfirmPw ? 'text' : 'password'}
                className="input pr-10"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
              />
              <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {pwMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg ${pwMessage.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {pwMessage.text}
            </div>
          )}

          <button type="submit" className="btn-secondary w-full justify-center" disabled={savingPw}>
            {savingPw ? <Loader2 size={14} className="animate-spin" /> : null}
            Ubah Password
          </button>
        </form>
      </div>
    </div>
  );
}
