'use client';

import { useEffect } from 'react';

const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? '';

export function ObservabilityProvider(): null {
  useEffect(() => {
    if (!sentryDsn) {
      return;
    }

    const onError = (event: ErrorEvent): void => {
      console.error('web_observability_error', {
        sentryDsnConfigured: true,
        message: event.message,
        file: event.filename,
        line: event.lineno,
        column: event.colno
      });
    };

    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
