import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateUnitDto } from './dto/create-unit.dto';
import { FilterUnitsDto } from './dto/filter-units.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitsService } from './units.service';

@ApiTags('Units')
@Controller({ path: 'units', version: '1' })
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post()
  @ApiOperation({ summary: 'Create UDD or BDRS unit' })
  @ApiResponse({ status: 201, description: 'Unit created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Unit code already exists' })
  create(@Body() dto: CreateUnitDto) {
    return this.unitsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List units with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Units list' })
  findAll(@Query() query: FilterUnitsDto) {
    return this.unitsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get unit by id' })
  @ApiResponse({ status: 200, description: 'Unit detail' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  findOne(@Param('id') id: string) {
    return this.unitsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update unit metadata except code' })
  @ApiResponse({ status: 200, description: 'Unit updated' })
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto) {
    return this.unitsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate unit' })
  @ApiResponse({ status: 200, description: 'Unit deactivated' })
  deactivate(@Param('id') id: string) {
    return this.unitsService.deactivate(id);
  }
}
