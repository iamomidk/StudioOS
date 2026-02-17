import './globals.css';
import type { ReactNode } from 'react';

import { ObservabilityProvider } from './observability-provider';

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        <ObservabilityProvider />
        {children}
      </body>
    </html>
  );
}
