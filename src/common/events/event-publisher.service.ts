import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class EventPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisherService.name);
  private readonly redis: Redis;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'));
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('EventPublisher connected to Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
    this.logger.log('EventPublisher disconnected from Redis');
  }

  async publishStockUpdated(bag: any): Promise<void> {
    const payload = JSON.stringify({
      event: 'stock.updated',
      data: bag,
      timestamp: new Date().toISOString(),
    });
    await this.redis.publish('stock.updated', payload);
    this.logger.debug(`Published stock.updated for bag ${bag?.id ?? 'unknown'}`);
  }

  async publishStockCritical(unitId: string, bloodType: string): Promise<void> {
    const payload = JSON.stringify({
      event: 'stock.critical',
      data: { unitId, bloodType },
      timestamp: new Date().toISOString(),
    });
    await this.redis.publish('stock.critical', payload);
    this.logger.warn(`Published stock.critical for unit=${unitId}, bloodType=${bloodType}`);
  }

  async publishBagExpired(bag: any): Promise<void> {
    const payload = JSON.stringify({
      event: 'bag.expired',
      data: bag,
      timestamp: new Date().toISOString(),
    });
    await this.redis.publish('bag.expired', payload);
    this.logger.debug(`Published bag.expired for bag ${bag?.id ?? 'unknown'}`);
  }
}
