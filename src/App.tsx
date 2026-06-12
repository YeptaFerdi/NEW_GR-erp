import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Layout, { Page } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import RelationsPage from './pages/RelationsPage';
import ProductsPage from './pages/ProductsPage';
import StockPage from './pages/StockPage';
import OrdersPage from './pages/OrdersPage';
import DistributionPage from './pages/DistributionPage';
import PaymentsPage from './pages/PaymentsPage';
import CapitalPage from './pages/CapitalPage';
import ReportInventory from './pages/reports/ReportInventory';
import ReportReceivable from './pages/reports/ReportReceivable';
import ReportCapital from './pages/reports/ReportCapital';
import ReportPL from './pages/reports/ReportPL';
import ReportSales from './pages/reports/ReportSales';
import ReportDelivery from './pages/reports/ReportDelivery';
import AuditPage from './pages/AuditPage';
import ProfilePage from './pages/ProfilePage';
import SyncStatus from './components/SyncStatus';
import { initOfflineSync } from './lib/offline-sync';
import { ShieldX, UserX } from 'lucide-react';

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
      <ShieldX size={48} className="mb-4 text-red-400" />
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Akses Ditolak</h2>
      <p className="text-sm">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
    </div>
  );
}

function PageContent({ page, hasAccess }: { page: Page; hasAccess: (p: string, a?: 'can_create' | 'can_read' | 'can_update' | 'can_delete') => boolean }) {
  if (page === 'profile') return <ProfilePage />;

  if (page !== 'dashboard' && !hasAccess(page)) {
    return <AccessDenied />;
  }

  switch (page) {
    case 'dashboard': return <DashboardPage />;
    case 'users': return <UsersPage />;
    case 'roles': return <RolesPage />;
    case 'relations': return <RelationsPage />;
    case 'customers': return <RelationsPage initialTab="customers" />;
    case 'producers': return <RelationsPage initialTab="producers" />;
    case 'products': return <ProductsPage />;
    case 'stock': return <StockPage />;
    case 'orders': return <OrdersPage />;
    case 'distribution': return <DistributionPage />;
    case 'payments': return <PaymentsPage />;
    case 'capital': return <CapitalPage />;
    case 'costs': return <CapitalPage />;
    case 'report-inventory': return <ReportInventory />;
    case 'report-receivable': return <ReportReceivable />;
    case 'report-capital': return <ReportCapital />;
    case 'report-pl': return <ReportPL />;
    case 'report-sales': return <ReportSales />;
    case 'report-delivery': return <ReportDelivery />;
    case 'audit': return <AuditPage />;
    default: return <DashboardPage />;
  }
}

export default function App() {
  const { session, loading, hasAccess, profile, signOut } = useAuth();
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => null);
    }
    initOfflineSync();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2447] to-[#1a3a6b]">
        <div className="text-center">
          <img src="/logo.png" alt="NEW_GR" className="w-20 h-20 rounded-full mx-auto mb-4 ring-4 ring-amber-400" />
          <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!session) return <LoginPage />;

  if (profile && profile.status === 'Nonaktif') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f2447] to-[#1a3a6b] p-4">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 max-w-sm text-center">
          <UserX size={48} className="mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-semibold text-white mb-2">Akun Nonaktif</h2>
          <p className="text-blue-200 text-sm mb-6">
            Akun Anda telah dinonaktifkan oleh administrator. Hubungi admin untuk mengaktifkan kembali.
          </p>
          <button onClick={signOut} className="btn-gold w-full justify-center">Keluar</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout currentPage={page} onNavigate={setPage}>
        <PageContent page={page} hasAccess={hasAccess} />
      </Layout>
      <SyncStatus />
    </>
  );
}
