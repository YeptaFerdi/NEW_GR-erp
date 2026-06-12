import { useEffect, useState } from 'react';
import { CloudOff, UploadCloud, Cloud } from 'lucide-react';
import { onPendingChange, syncPending } from '../lib/offline-sync';

export default function SyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const unsub = onPendingChange(setPending);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (online && pending > 0 && !syncing) {
      setSyncing(true);
      syncPending().finally(() => setSyncing(false));
    }
  }, [online, pending, syncing]);

  if (online && pending === 0) return null;

  const bg = !online ? 'bg-amber-500' : 'bg-blue-600';
  const Icon = !online ? CloudOff : syncing ? UploadCloud : Cloud;
  const label = !online
    ? `Offline${pending > 0 ? ` - ${pending} tertunda` : ''}`
    : syncing
    ? `Menyinkronkan ${pending}...`
    : `${pending} tertunda`;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-white text-xs font-medium ${bg}`}>
      <Icon size={14} className={syncing ? 'animate-pulse' : ''} />
      {label}
    </div>
  );
}
