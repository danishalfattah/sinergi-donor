import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BloodBagsService } from './blood-bags.service';
import { CreateBloodBagDto } from './dto/create-blood-bag.dto';
import { FilterBloodBagsDto } from './dto/filter-blood-bags.dto';
import { UpdateBloodBagStatusDto } from './dto/update-blood-bag-status.dto';

@ApiTags('Blood Bags')
@Controller({ path: 'blood-bags', version: '1' })
export class BloodBagsController {
  constructor(private readonly bloodBagsService: BloodBagsService) {}

  @Post()
  @ApiOperation({ summary: 'Register new blood bag from donation' })
  @ApiResponse({ status: 201, description: 'Blood bag created' })
  create(@Body() dto: CreateBloodBagDto) {
    return this.bloodBagsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List blood bags with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Blood bags list' })
  findAll(@Query() query: FilterBloodBagsDto) {
    return this.bloodBagsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get blood bag by id' })
  @ApiResponse({ status: 200, description: 'Blood bag detail' })
  findOne(@Param('id') id: string) {
    return this.bloodBagsService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update blood bag status using state machine rules' })
  @ApiResponse({ status: 200, description: 'Blood bag status updated' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBloodBagStatusDto) {
    return this.bloodBagsService.updateStatus(id, dto);
  }
}
