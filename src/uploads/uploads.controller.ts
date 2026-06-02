import { Body, Controller, Delete, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';

class UploadProductPhotoBodyDto {
  @IsString()
  productId!: string;
}

class UploadStoreImageBodyDto {
  @IsOptional()
  @IsIn(['logo', 'qr'])
  type?: 'logo' | 'qr';
}

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('product-photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        productId: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['productId', 'file'],
    },
  })
  @ApiOperation({ summary: 'Subir foto de producto (máx. 5)' })
  uploadProductPhoto(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadProductPhotoBodyDto,
  ) {
    return this.uploadsService.uploadProductPhoto(user.userId, file, body.productId);
  }

  @Delete('product-photo/:photoId')
  @ApiOperation({ summary: 'Eliminar foto de producto' })
  deleteProductPhoto(
    @CurrentUser() user: JwtUser,
    @Param('photoId') photoId: string,
  ) {
    return this.uploadsService.deleteProductPhoto(user.userId, photoId);
  }

  @Post('store-image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['logo', 'qr'] },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Subir imagen de tienda (logo o qr)' })
  uploadStoreImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadStoreImageBodyDto,
  ) {
    return this.uploadsService.uploadStoreImage(user.userId, file, body.type ?? 'logo');
  }
}
