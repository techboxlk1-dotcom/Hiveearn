'use client';

import AppShell from '@/components/layout/AppShell';
import TasksPage from '@/components/pages/TasksPage';

export default function Page() {
  return (
    <AppShell>
      <TasksPage />
    </AppShell>
  );
}
