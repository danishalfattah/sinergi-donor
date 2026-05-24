import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class LegacyAdapterService {
  private readonly logger = new Logger(LegacyAdapterService.name);
  private readonly legacyBaseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.legacyBaseUrl = this.config.get<string>(
      'LEGACY_API_URL',
      'http://localhost:3001',
    );
  }

  async syncFromLegacy(unitId: string): Promise<any> {
    try {
      const url = `${this.legacyBaseUrl}/api/units/${unitId}/stock`;
      this.logger.log(`Syncing stock from legacy system for unit ${unitId}`);
      const response = await firstValueFrom(this.http.get(url));
      this.logger.log(`Successfully synced ${response.data?.length ?? 0} items from legacy for unit ${unitId}`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to sync from legacy for unit ${unitId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  scheduleSync(): void {
    this.logger.log(
      'Legacy sync scheduling is a placeholder — implement cron or interval-based sync here',
    );
    // TODO: Implement interval/cron-based sync using @nestjs/schedule
    // Example: sync all active units every N minutes
  }
}
