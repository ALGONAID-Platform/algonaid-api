import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';


@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    let connectionString = process.env.DATABASE_URL;
    if (connectionString) {
      try {
        const url = new URL(connectionString);
        if (url.searchParams.get('sslmode') === 'require' || url.searchParams.get('ssl') === 'true' || url.searchParams.has('sslmode')) {
          url.searchParams.set('uselibpqcompat', 'true');
          url.searchParams.set('sslmode', 'require');
          connectionString = url.toString();
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
 