'use client';

import AppShell from '@/components/layout/AppShell';
import AdminPage from '@/components/pages/AdminPage';

export default function Page() {
  return (
    <AppShell hideNav>
      <AdminPage />
    </AppShell>
  );
}
