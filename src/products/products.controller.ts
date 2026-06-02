import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetProductOptionsDto } from './dto/set-product-options.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('admin')
  @ApiOperation({ summary: 'Crear un nuevo producto en la tienda autenticada' })
  createProduct(@CurrentUser() user: JwtUser, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(user.userId, dto);
  }

  @Get('admin/inventory')
  @ApiOperation({ summary: 'Listar inventario de la tienda autenticada' })
  getAdminInventory(@CurrentUser() user: JwtUser, @Query() query: ProductQueryDto) {
    return this.productsService.getAdminInventory(user.userId, query);
  }

  @Get('admin/:id')
  @ApiOperation({ summary: 'Obtener detalle de un producto propio (incluye no visibles)' })
  getAdminProductById(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.productsService.getAdminProductById(user.userId, id);
  }

  @Patch('admin/:id')
  @ApiOperation({ summary: 'Actualizar datos de un producto propio' })
  updateProduct(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(user.userId, id, dto);
  }

  @Post('admin/:id/options')
  @ApiOperation({ summary: 'Guardar tallas y colores de un producto' })
  setProductOptions(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: SetProductOptionsDto) {
    return this.productsService.setProductOptions(user.userId, id, dto);
  }

  @Delete('admin/:id')
  @ApiOperation({ summary: 'Eliminar un producto propio' })
  deleteProduct(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.productsService.deleteProduct(user.userId, id);
  }

  @Patch('admin/:id/stock')
  @ApiOperation({ summary: 'Actualizar stock de un producto propio' })
  updateProductStock(@CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.productsService.updateProductStock(user.userId, id, dto.stock);
  }
}
