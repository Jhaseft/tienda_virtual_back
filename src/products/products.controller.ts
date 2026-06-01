import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('admin/inventory')
  @ApiOperation({ summary: 'Listar inventario de la tienda autenticada' })
  getAdminInventory(@CurrentUser() user: JwtUser, @Query() query: ProductQueryDto) {
    return this.productsService.getAdminInventory(user.userId, query);
  }

  @Patch('admin/:id/stock')
  @ApiOperation({ summary: 'Actualizar stock de un producto propio' })
  updateProductStock(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.productsService.updateProductStock(user.userId, id, dto.stock);
  }
}
