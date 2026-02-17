import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.PERF_BASE_URL || 'http://localhost:3000';
const payload = JSON.stringify({
  email: __ENV.PERF_USER_EMAIL || 'perf@example.com',
  password: __ENV.PERF_USER_PASSWORD || 'Password123!'
});

export const options = {
  vus: Number(__ENV.PERF_VUS || 20),
  duration: __ENV.PERF_DURATION || '120s'
};

export default function () {
  const res = http.post(`${baseUrl}/auth/login`, payload, {
    headers: { 'Content-Type': 'application/json' }
  });
  check(res, { 'login status allowed': (r) => [200, 401, 403].includes(r.status) });
  sleep(0.5);
}
