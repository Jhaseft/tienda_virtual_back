import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // metodos para obtener y actualizar la configuración del sistema
  async getConfig() {
    return this.prisma.systemConfig.findUniqueOrThrow({ where: { id: '1' } });
  }

  // solo actualiza los campos que se envían en el DTO
  async updateConfig(dto: UpdateSystemConfigDto) {
    return this.prisma.systemConfig.update({
      where: { id: '1' },
      data: {
        ...(dto.trialDays !== undefined && { trialDays: dto.trialDays }),
        ...(dto.trialMaxProducts !== undefined && { trialMaxProducts: dto.trialMaxProducts }),
        ...(dto.exchangeRateBob !== undefined && { exchangeRateBob: dto.exchangeRateBob }),
      },
    });
  }

  // métodos para obtener valores específicos de la configuración
  async getTrialDays(): Promise<number> {
    const config = await this.getConfig();
    return config.trialDays;
  }

  // este método se usará para limitar la cantidad de productos que un usuario en periodo de prueba puede crear
  async getTrialMaxProducts(): Promise<number> {
    const config = await this.getConfig();
    return config.trialMaxProducts;
  }

  // este método se usará para convertir precios de USD a BOB al generar el QR de pago con Baneco
  async getExchangeRate(): Promise<number> {
    const config = await this.getConfig();
    return config.exchangeRateBob;
  }
}
