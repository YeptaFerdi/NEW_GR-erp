import { formatDateTime } from '../lib/format';

interface Props {
  title: string;
  subtitle?: string;
  brand?: string;
}

export default function PrintHeader({ title, subtitle, brand = 'NEW_GR-ERP' }: Props) {
  return (
    <div className="print-header hidden print:block mb-4 pb-3 border-b-2 border-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div className="text-left">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Dicetak</div>
          <div className="text-xs font-semibold text-slate-800">{formatDateTime(new Date().toISOString())}</div>
        </div>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="w-12 h-12 rounded-full object-cover" />
          <div className="text-right">
            <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{brand}</div>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h1>
        {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
