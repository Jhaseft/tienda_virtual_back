import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const USER_SELECT = {
  id: true,
  email: true,
  phoneNumber: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  role: true,
  isProfileComplete: true,
  notificationsEnabled: true,
  createdAt: true,
  store: { select: { id: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async getFavorites(userId: string) {
    const [favoriteRecords, followedStoreRecords] = await Promise.all([
      this.prisma.favorite.findMany({
        where: {
          userId,
          NOT: { productId: null },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              photos: {
                take: 1,
                orderBy: { order: 'asc' },
                select: { url: true },
              },
              store: {
                select: { name: true, logoUrl: true },
              },
            },
          },
        },
      }),
      this.prisma.storeFollower.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          store: {
            select: {
              id: true,
              name: true,
              storeType: true,
              logoUrl: true,
              city: true,
              rating: true,
            },
          },
        },
      }),
    ]);

    const products = favoriteRecords.map((r) => r.product).filter((p): p is NonNullable<typeof p> => p !== null);

    const stores = followedStoreRecords.map((r) => r.store);

    return { products, stores };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: { firstName?: string; lastName?: string; phoneNumber?: string } = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });
  }
}
