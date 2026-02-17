import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;

  recordRequest(statusCode: number): void {
    this.httpRequestsTotal += 1;
    if (statusCode >= 400) {
      this.httpErrorsTotal += 1;
    }
  }

  snapshot() {
    return {
      httpRequestsTotal: this.httpRequestsTotal,
      httpErrorsTotal: this.httpErrorsTotal
    };
  }
}
