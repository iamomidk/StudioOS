import type { ReactNode } from 'react';
import Link from 'next/link';

import { DASHBOARD_NAV_ITEMS } from '@/lib/navigation';

export default function DashboardLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 20,
        padding: 20
      }}
    >
      <aside
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 18
        }}
      >
        <h2 style={{ marginTop: 0 }}>StudioOS</h2>
        <nav style={{ display: 'grid', gap: 8 }}>
          {DASHBOARD_NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                background: '#f1f5ef'
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: 20
        }}
      >
        {children}
      </section>
    </div>
  );
}
