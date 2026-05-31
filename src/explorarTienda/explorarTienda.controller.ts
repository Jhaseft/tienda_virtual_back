import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExplorarTiendaService } from './explorarTienda.service';
import { PublicExplorarTiendaService } from './public-explorarTienda.service';
import { SearchExplorerDto } from './dto/search-explorer.dto';
import { GetStoreProductsDto } from './dto/get-store-products.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';

@ApiTags('Explorar')
@Controller('explorar')
export class ExplorarTiendaController {
    constructor(
        private readonly explorarService: ExplorarTiendaService,
        private readonly publicService: PublicExplorarTiendaService,
    ) { }

    // OBTENER DATOS PARA LA PÁGINA DE INICIO: CATEGORÍAS Y TIENDAS RECOMENDADAS
    @Get()
    @ApiOperation({ summary: 'Home: categorías y tiendas recomendadas' })
    getHomeData() {
        return this.explorarService.getHomeData();
    }

    // OBTENER CATEGORÍAS ORDENADAS ALFABÉTICAMENTE
    @Get('categorias')
    @ApiOperation({ summary: 'Listar todas las categorías' })
    getCategories() {
        return this.explorarService.getCategories();
    }

    // OBTENER TIENDAS RECOMENDADAS ORDENADAS POR RATING
    @Get('tiendas-recomendadas')
    @ApiOperation({ summary: 'Tiendas recomendadas ordenadas por rating' })
    getRecommendedStores() {
        return this.explorarService.getRecommendedStores();
    }

    // OBTENER TIENDAS POR CATEGORÍA
    @Get('categorias/:id/tiendas')
    @ApiOperation({ summary: 'Tiendas con productos en una categoría' })
    getStoresByCategory(@Param('id') id: string) {
        return this.explorarService.getStoresByCategory(id);
    }

    // OBTENER DETALLE DE UNA TIENDA
    @Get('tiendas/:id')
    @ApiOperation({ summary: 'Detalle completo de una tienda' })
    getStoreById(@Param('id') id: string) {
        return this.explorarService.getStoreById(id);
    }

    // OBTENER PRODUCTOS DE UNA TIENDA
    @Get('tiendas/:id/productos')
    @ApiOperation({ summary: 'Productos de una tienda con paginación' })
    getStoreProducts(@Param('id') id: string, @Query() dto: GetStoreProductsDto) {
        return this.explorarService.getStoreProducts(id, dto);
    }

    // OBTENER MÉTODOS DE PAGO DE UNA TIENDA
    @Get('tiendas/:id/metodos-pago')
    @ApiOperation({ summary: 'Métodos de pago de una tienda' })
    getStorePaymentMethods(@Param('id') id: string) {
        return this.explorarService.getStorePaymentMethods(id);
    }

    // VERIFICAR SI EL USUARIO SIGUE UNA TIENDA
    @Get('tiendas/:id/seguir')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Verificar si el usuario sigue una tienda' })
    isFollowing(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.isFollowing(id, user.userId);
    }

    // SEGUIR UNA TIENDA
    @Post('tiendas/:id/seguir')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Seguir una tienda' })
    followStore(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.followStore(id, user.userId);
    }

    // DEJAR DE SEGUIR UNA TIENDA
    @Delete('tiendas/:id/seguir')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Dejar de seguir una tienda' })
    unfollowStore(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.unfollowStore(id, user.userId);
    }

    // OBTENER DETALLE DE UN PRODUCTO
    @Get('productos/:id')
    @ApiOperation({ summary: 'Detalle completo de un producto' })
    getProductById(@Param('id') id: string) {
        return this.explorarService.getProductById(id);
    }

    // VERIFICAR SI UN PRODUCTO ESTÁ EN FAVORITOS
    @Get('productos/:id/favorito')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Verificar si el producto está en favoritos' })
    isFavorite(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.isFavorite(id, user.userId);
    }

    // AGREGAR PRODUCTO A FAVORITOS
    @Post('productos/:id/favorito')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Agregar producto a favoritos' })
    addFavorite(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.addFavorite(id, user.userId);
    }

    // QUITAR PRODUCTO DE FAVORITOS
    @Delete('productos/:id/favorito')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Quitar producto de favoritos' })
    removeFavorite(@Param('id') id: string, @CurrentUser() user: JwtUser) {
        return this.publicService.removeFavorite(id, user.userId);
    }

    // BUSCAR PRODUCTOS Y TIENDAS POR TÉRMINO DE BÚSQUEDA CON PAGINACIÓN
    @Get('buscar')
    @ApiOperation({ summary: 'Buscar productos y tiendas' })
    search(@Query() dto: SearchExplorerDto) {
        return this.explorarService.search(dto);
    }
}
