/*
  # Cleanup duplicate permission modules

  1. Changes
    - Remove old lowercase English module entries from permissions table
    - Keep only the Indonesian capitalized module names which are actively used by the app's RolesPage
    - Standard module names: Dashboard, User, Role, Pelanggan, Produsen, Produk, Stok, Pesanan, Distribusi, Pembayaran, Modal, Laporan, Audit
  
  2. Important Notes
    - RolesPage.tsx saves permissions using Indonesian capitalized names
    - Old lowercase entries (dashboard, users, roles, customers, producers, products, stock, orders, distribution, payments, capital, reports, audit) are remnants from an earlier schema
    - No data loss: we only remove duplicate/unused permission records
*/

DELETE FROM permissions 
WHERE module IN ('dashboard', 'users', 'roles', 'customers', 'producers', 'products', 'stock', 'orders', 'distribution', 'payments', 'capital', 'reports', 'audit');
