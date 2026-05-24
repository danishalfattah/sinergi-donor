import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ExpiringSoonQueryDto } from './dto/expiring-soon-query.dto';
import { StockService } from './stock.service';

@ApiTags('Stock')
@Controller({ path: 'stock', version: '1' })
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get available stock summary per unit, blood type, and component' })
  @ApiResponse({ status: 200, description: 'Stock summary' })
  summary() {
    return this.stockService.summary();
  }

  @Get('critical')
  @ApiOperation({ summary: 'Detect critical stock below threshold' })
  @ApiResponse({ status: 200, description: 'Critical stock items' })
  critical() {
    return this.stockService.critical();
  }

  @Get('expiring-soon')
  @ApiOperation({ summary: 'List available blood bags expiring soon using FEFO order' })
  @ApiResponse({ status: 200, description: 'Expiring blood bags' })
  expiringSoon(@Query() query: ExpiringSoonQueryDto) {
    return this.stockService.expiringSoon(query);
  }
}
