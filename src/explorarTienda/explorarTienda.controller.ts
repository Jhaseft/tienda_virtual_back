import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ExplorarTiendaService } from './explorarTienda.service';
import { SearchExplorerDto } from './dto/search-explorer.dto';

@ApiTags('Explorar')
@Controller('explorar')
export class ExplorarTiendaController {
    constructor(private readonly explorarService: ExplorarTiendaService) { }

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

    // BUSCAR PRODUCTOS Y TIENDAS POR TÉRMINO DE BÚSQUEDA CON PAGINACIÓN
    @Get('buscar')
    @ApiOperation({ summary: 'Buscar productos y tiendas' })
    search(@Query() dto: SearchExplorerDto) {
        return this.explorarService.search(dto);
    }
}
