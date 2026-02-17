const apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3000',
);

const defaultOrganizationId = String.fromEnvironment(
  'API_DEFAULT_ORGANIZATION_ID',
  defaultValue: '',
);

const defaultLoginEmail = String.fromEnvironment(
  'API_EMAIL',
  defaultValue: 'owner@studioos.dev',
);

const defaultLoginPassword = String.fromEnvironment(
  'API_PASSWORD',
  defaultValue: 'Password123!',
);

const sentryDsn = String.fromEnvironment('SENTRY_DSN', defaultValue: '');
