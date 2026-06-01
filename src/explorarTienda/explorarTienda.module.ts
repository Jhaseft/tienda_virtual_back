import { Module } from '@nestjs/common';
import { ExplorarTiendaController } from './explorarTienda.controller';
import { ExplorarTiendaService } from './explorarTienda.service';
import { PublicExplorarTiendaService } from './public-explorarTienda.service';

@Module({
  controllers: [ExplorarTiendaController],
  providers: [ExplorarTiendaService, PublicExplorarTiendaService],
})
export class ExplorarTiendaModule {}
