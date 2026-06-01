import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('admin')
  @ApiOperation({ summary: 'Listar clientes de la tienda autenticada' })
  getAdminCustomers(@CurrentUser() user: JwtUser, @Query() query: CustomerQueryDto) {
    return this.customersService.getAdminCustomers(user.userId, query);
  }
}
