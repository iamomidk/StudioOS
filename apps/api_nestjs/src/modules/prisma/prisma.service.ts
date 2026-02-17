import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { dbProfileStore } from '../../common/perf/db-profile.store.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [{ emit: 'event', level: 'query' }]
    });
  }

  async onModuleInit(): Promise<void> {
    (
      this as unknown as {
        $on: (
          event: 'query',
          callback: (event: { duration: number; query: string }) => void
        ) => void;
      }
    ).$on('query', (event) => {
      dbProfileStore.recordQuery(event.duration, event.query);
    });

    if (process.env.SKIP_PRISMA_CONNECT === 'true') {
      return;
    }
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (process.env.SKIP_PRISMA_CONNECT === 'true') {
      return;
    }
    await this.$disconnect();
  }
}
