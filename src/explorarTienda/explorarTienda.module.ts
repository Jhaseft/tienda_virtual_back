import { Module } from '@nestjs/common';
import { ExplorarTiendaController } from './explorarTienda.controller';
import { ExplorarTiendaService } from './explorarTienda.service';

@Module({
    controllers: [ExplorarTiendaController],
    providers: [ExplorarTiendaService],
})
export class ExplorarTiendaModule { }
