import { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Package, ShoppingCart, Truck, CreditCard,
  Users, Building2, BarChart3, FileText, LogOut, Menu, X,
  Shield, ClipboardList, ChevronDown, ChevronRight, Boxes
} from 'lucide-react';

type Page =
  | 'dashboard'
  | 'users' | 'roles'
  | 'relations' | 'customers' | 'producers'
  | 'products'
  | 'stock'
  | 'orders'
  | 'distribution'
  | 'payments' | 'capital' | 'costs'
  | 'report-inventory' | 'report-receivable' | 'report-capital'
  | 'report-pl' | 'report-sales' | 'report-delivery'
  | 'audit'
  | 'profile';

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Utama',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> }],
  },
  {
    group: 'Master Data',
    items: [
      { id: 'users', label: 'Manajemen User', icon: <Users size={16} /> },
      { id: 'roles', label: 'Role & Permission', icon: <Shield size={16} /> },
      {
        id: 'relations', label: 'Relasi Bisnis', icon: <Building2 size={16} />,
        children: [
          { id: 'customers', label: 'Pelanggan', icon: <Users size={14} /> },
          { id: 'producers', label: 'Produsen', icon: <Building2 size={14} /> },
        ]
      },
      { id: 'products', label: 'Produk', icon: <Package size={16} /> },
    ],
  },
  {
    group: 'Operasional',
    items: [
      { id: 'stock', label: 'Manajemen Stok', icon: <Boxes size={16} /> },
      { id: 'orders', label: 'Pesanan', icon: <ShoppingCart size={16} /> },
      { id: 'distribution', label: 'Distribusi', icon: <Truck size={16} /> },
    ],
  },
  {
    group: 'Keuangan',
    items: [
      { id: 'payments', label: 'Pembayaran', icon: <CreditCard size={16} /> },
      { id: 'capital', label: 'Modal & Biaya', icon: <FileText size={16} /> },
    ],
  },
  {
    group: 'Laporan',
    items: [
      { id: 'report-inventory', label: 'Persediaan', icon: <BarChart3 size={16} /> },
      { id: 'report-receivable', label: 'Piutang', icon: <BarChart3 size={16} /> },
      { id: 'report-capital', label: 'Modal', icon: <BarChart3 size={16} /> },
      { id: 'report-pl', label: 'Laba Rugi', icon: <BarChart3 size={16} /> },
      { id: 'report-sales', label: 'Penjualan', icon: <BarChart3 size={16} /> },
      { id: 'report-delivery', label: 'Pengiriman', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    group: 'Sistem',
    items: [{ id: 'audit', label: 'Audit Log', icon: <ClipboardList size={16} /> }],
  },
];

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  children: React.ReactNode;
}

export default function Layout({ currentPage, onNavigate, children }: Props) {
  const { profile, signOut, hasAccess } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['relations']));

  const filteredNav = useMemo(() => {
    return NAV.map(({ group, items }) => {
      const filtered = items
        .map(item => {
          if (item.children) {
            const visibleChildren = item.children.filter(c => hasAccess(c.id));
            if (visibleChildren.length === 0) return null;
            return { ...item, children: visibleChildren };
          }
          return hasAccess(item.id) ? item : null;
        })
        .filter(Boolean) as NavItem[];
      return { group, items: filtered };
    }).filter(g => g.items.length > 0);
  }, [hasAccess]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const sidebar = (
    <aside className="flex flex-col h-full bg-gradient-to-b from-[#1a3a6b] to-[#0f2447] w-64 flex-shrink-0">
      <div className="flex items-center gap-3 p-5 border-b border-white/10">
        <img src="/logo.png" alt="NEW_GR" className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400" />
        <div>
          <div className="text-white font-bold text-base leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>NEW_GR-ERP</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3">
        {filteredNav.map(({ group, items }) => (
          <div key={group}>
            <div className="sidebar-group">{group}</div>
            {items.map(item => (
              <div key={item.id}>
                {item.children ? (
                  <>
                    <button
                      className={`sidebar-item w-full justify-between ${item.children.some(c => c.id === currentPage) ? 'active' : ''}`}
                      onClick={() => toggleExpand(item.id)}
                    >
                      <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                      {expanded.has(item.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {expanded.has(item.id) && (
                      <div className="ml-4 mt-0.5 space-y-0.5">
                        {item.children.map(child => (
                          <button
                            key={child.id}
                            className={`sidebar-item w-full ${currentPage === child.id ? 'active' : ''}`}
                            onClick={() => { onNavigate(child.id); setSidebarOpen(false); }}
                          >
                            {child.icon}{child.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    className={`sidebar-item w-full ${currentPage === item.id ? 'active' : ''}`}
                    onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                  >
                    {item.icon}{item.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          className="flex items-center gap-3 mb-3 w-full rounded-lg p-1.5 -m-1.5 hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => { onNavigate('profile'); setSidebarOpen(false); }}
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-400" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-sm font-bold text-blue-900">
              {profile?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <div className="flex-1 min-w-0 text-left">
            <div className="text-white text-sm font-medium truncate">{profile?.name || 'User'}</div>
            <div className="text-blue-300 text-xs">{profile?.role_name || 'Staff'}</div>
          </div>
        </button>
        <button onClick={signOut} className="sidebar-item w-full text-red-300 hover:text-red-200 hover:bg-red-900/30">
          <LogOut size={14} />Keluar
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex flex-shrink-0">{sidebar}</div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1a3a6b] text-white flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <img src="/logo.png" alt="NEW_GR" className="w-8 h-8 rounded-full" />
          <button onClick={signOut}><LogOut size={18} /></button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}

export type { Page };
