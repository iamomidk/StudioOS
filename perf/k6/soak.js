import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.PERF_BASE_URL || 'http://localhost:3000';

export const options = {
  vus: Number(__ENV.PERF_VUS || 15),
  duration: __ENV.PERF_DURATION || '900s'
};

export default function () {
  const res = http.get(`${baseUrl}/metrics`);
  check(res, { 'soak metrics 200': (r) => r.status === 200 });
  sleep(1);
}
