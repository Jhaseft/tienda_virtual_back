import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SearchExplorerDto } from './dto/search-explorer.dto';

@Injectable()
export class ExplorarTiendaService {
    constructor(private readonly prisma: PrismaService) { }

    //OBTENER CATEGORÍAS ORDENADAS ALFABÉTICAMENTE
    async getCategories() {
        return this.prisma.category.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                iconUrl: true,
            },
        });
    }

    // OBTENER TIENDAS RECOMENDADAS ORDENADAS POR RATING
    async getRecommendedStores() {
        return this.prisma.store.findMany({
            where: {
                isOpen: true,
                subscription: { status: 'ACTIVE' },
            },
            orderBy: { rating: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                storeType: true,
                logoUrl: true,
                city: true,
                rating: true,
                totalSales: true,
                totalReviews: true,
            },
        });
    }

    // BUSCAR PRODUCTOS Y TIENDAS POR TÉRMINO DE BÚSQUEDA CON PAGINACIÓN
    async search(dto: SearchExplorerDto) {
        const { q, page = 1, limit = 20 } = dto;
        const skip = (page - 1) * limit;

        if (!q || q.trim() === '') {
            return { stores: [], products: [] };
        }

        const term = q.trim();

        const [stores, products] = await Promise.all([
            this.prisma.store.findMany({
                where: {
                    isOpen: true,
                    OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { storeType: { contains: term, mode: 'insensitive' } },
                        { description: { contains: term, mode: 'insensitive' } },
                    ],
                },
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    storeType: true,
                    logoUrl: true,
                    city: true,
                    rating: true,
                },
            }),
            this.prisma.product.findMany({
                where: {
                    isVisible: true,
                    isAvailable: true,
                    OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { description: { contains: term, mode: 'insensitive' } },
                    ],
                },
                skip,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    photos: {
                        take: 1,
                        orderBy: { order: 'asc' },
                        select: { url: true },
                    },
                    store: {
                        select: {
                            id: true,
                            name: true,
                            logoUrl: true,
                        },
                    },
                },
            }),
        ]);

        return { stores, products };
    }

    // OBTENER DATOS PARA LA PÁGINA DE INICIO: CATEGORÍAS Y TIENDAS RECOMENDADAS
    async getHomeData() {
        const [categories, recommendedStores] = await Promise.all([
            this.getCategories(),
            this.getRecommendedStores(),
        ]);

        return { categories, recommendedStores };
    }
}
