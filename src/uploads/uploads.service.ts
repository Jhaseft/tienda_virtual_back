import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma.service';

type UploadType = 'logo' | 'qr';

@Injectable()
export class UploadsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async uploadStoreImage(userId: string, file: Express.Multer.File | undefined, type: UploadType = 'logo') {
    if (!file) {
      throw new BadRequestException('Debes enviar un archivo');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('El archivo debe ser una imagen');
    }

    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (!store) {
      throw new NotFoundException('No tienes una tienda asociada para administrar');
    }

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
    if (!cloudinaryUrl || !cloudinaryUrl.startsWith('cloudinary://')) {
      throw new BadRequestException('Cloudinary no configurado. Define CLOUDINARY_URL en variables de entorno.');
    }

    const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(cloudinaryUrl);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `stores/${store.id}/${type}`;
    const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(`Error al subir imagen a Cloudinary: ${errorBody}`);
    }

    const body = (await response.json()) as {
      secure_url: string;
      public_id: string;
    };

    return {
      type,
      url: body.secure_url,
      publicId: body.public_id,
    };
  }

  private parseCloudinaryUrl(cloudinaryUrl: string) {
    const stripped = cloudinaryUrl.replace('cloudinary://', '');
    const [credentials, cloudName] = stripped.split('@');
    const [apiKey, apiSecret] = credentials.split(':');

    if (!apiKey || !apiSecret || !cloudName) {
      throw new BadRequestException(
        'CLOUDINARY_URL invalido. Formato esperado: cloudinary://api_key:api_secret@cloud_name',
      );
    }

    return { apiKey, apiSecret, cloudName };
  }
}
