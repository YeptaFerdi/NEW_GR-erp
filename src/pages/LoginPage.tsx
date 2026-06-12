import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader as Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage({ type: 'error', text: error.message });
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2447] via-[#1a3a6b] to-[#1e4d8c] p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full ring-4 ring-amber-400 ring-offset-4 ring-offset-transparent overflow-hidden mb-4 shadow-2xl">
            <img src="/logo.png" alt="NEW_GR" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>NEW_GR-ERP</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-5">Masuk ke Sistem</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label text-blue-100">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input bg-white/10 border-white/20 text-white placeholder-blue-300 focus:ring-amber-400"
                placeholder="email@example.com" required />
            </div>
            <div>
              <label className="label text-blue-100">Password</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  className="input bg-white/10 border-white/20 text-white placeholder-blue-300 focus:ring-amber-400 pr-10"
                  placeholder="••••••••" required />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {message && (
              <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'error' ? 'bg-red-900/50 text-red-200' : 'bg-green-900/50 text-green-200'}`}>
                {message.text}
              </div>
            )}
            <button type="submit" disabled={loading} className="btn-gold w-full justify-center py-2.5">
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Masuk
            </button>
          </form>
          <p className="mt-4 text-blue-300/70 text-xs text-center">
            Lupa password? Hubungi Admin untuk reset.
          </p>
        </div>

        <p className="text-center text-blue-400 text-xs mt-6">
          &copy; {new Date().getFullYear()} NEW_GR
        </p>
      </div>
    </div>
  );
}
