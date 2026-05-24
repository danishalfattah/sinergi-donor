import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CancelTransferDto } from './dto/cancel-transfer.dto.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { FilterTransfersDto } from './dto/filter-transfers.dto.js';
import { StockTransfersService } from './stock-transfers.service.js';

@ApiTags('Stock Transfers')
@Controller({ path: 'stock-transfers', version: '1' })
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Create transfer and lock bags atomically' })
  @ApiResponse({ status: 201, description: 'Transfer created' })
  create(@Body() dto: CreateTransferDto) {
    return this.stockTransfersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List stock transfers' })
  @ApiResponse({ status: 200, description: 'Transfers list' })
  findAll(@Query() query: FilterTransfersDto) {
    return this.stockTransfersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer by id' })
  @ApiResponse({ status: 200, description: 'Transfer detail' })
  findOne(@Param('id') id: string) {
    return this.stockTransfersService.findOne(id);
  }

  @Patch(':id/dispatch')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Mark pending transfer as in transit' })
  @ApiResponse({ status: 200, description: 'Transfer dispatched' })
  dispatch(@Param('id') id: string) {
    return this.stockTransfersService.dispatch(id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Complete transfer and move bags to target unit' })
  @ApiResponse({ status: 200, description: 'Transfer completed' })
  complete(@Param('id') id: string) {
    return this.stockTransfersService.complete(id);
  }

  @Patch(':id/cancel')
  @ApiExcludeEndpoint()
  @ApiOperation({ summary: 'Cancel pending transfer and release bags' })
  @ApiResponse({ status: 200, description: 'Transfer cancelled' })
  cancel(@Param('id') id: string, @Body() dto: CancelTransferDto) {
    return this.stockTransfersService.cancel(id, dto);
  }
}
