import { useRef, useState } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  value: string;
  onChange: (url: string) => void;
  folder?: string;
  label?: string;
}

export default function ImageUpload({ value, onChange, folder = 'products', label = 'Gambar' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setError('');
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (jpg, png, webp)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran maksimal 5 MB');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (upErr) {
      setError(upErr.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('uploads').getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }

  function clear() {
    onChange('');
    setError('');
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" className="w-28 h-28 rounded-lg object-cover border border-slate-200" />
          <button
            type="button"
            onClick={clear}
            className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow"
          >
            <X size={12} />
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ml-2 btn-secondary btn-sm"
          >
            Ganti
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 w-28 h-28 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          <span className="text-xs font-medium">{uploading ? 'Mengunggah...' : 'Pilih dari Device'}</span>
        </button>
      )}
      {!value && !uploading && (
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <ImageIcon size={11} /> JPG, PNG, WEBP — maks 5 MB
        </p>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
