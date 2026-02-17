import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.PERF_BASE_URL || 'http://localhost:3000';

export const options = {
  vus: Number(__ENV.PERF_VUS || 5),
  duration: __ENV.PERF_DURATION || '30s'
};

export default function () {
  const health = http.get(`${baseUrl}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const metrics = http.get(`${baseUrl}/metrics`);
  check(metrics, { 'metrics 200': (r) => r.status === 200 });

  sleep(1);
}
