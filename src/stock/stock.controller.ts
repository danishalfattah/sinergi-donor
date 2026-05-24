import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpiringSoonQueryDto } from './dto/expiring-soon-query.dto.js';
import { FefoEngine } from './fefo-engine.service.js';
import { StockAggregator } from './stock-aggregator.service.js';

@ApiTags('Stock')
@Controller({ path: 'stock', version: '1' })
export class StockController {
  constructor(
    private readonly stockAggregator: StockAggregator,
    private readonly fefoEngine: FefoEngine,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get available stock summary per unit, blood type, and component' })
  @ApiResponse({ status: 200, description: 'Stock summary' })
  summary() {
    return this.stockAggregator.summary();
  }

  @Get('critical')
  @ApiOperation({ summary: 'Detect critical stock below threshold' })
  @ApiResponse({ status: 200, description: 'Critical stock items' })
  critical() {
    return this.stockAggregator.critical();
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: 'List available blood bags expiring soon using FEFO order' })
  @ApiResponse({ status: 200, description: 'Expiring blood bags' })
  expiringSoon(@Query() query: ExpiringSoonQueryDto) {
    return this.fefoEngine.expiringSoon(query);
  }

  @Get('by-unit/:unitId')
  @ApiOperation({ summary: 'Get stock summary for a specific unit' })
  @ApiResponse({ status: 200, description: 'Stock by unit' })
  getByUnit(@Param('unitId') unitId: string) {
    return this.stockAggregator.getByUnit(unitId);
  }
}
