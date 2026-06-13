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

  async uploadProductPhoto(userId: string, file: Express.Multer.File | undefined, productId: string) {
    if (!file) throw new BadRequestException('Debes enviar un archivo');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('El archivo debe ser una imagen');

    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado o no te pertenece');

    const photoCount = await this.prisma.productPhoto.count({ where: { productId } });

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
    if (!cloudinaryUrl?.startsWith('cloudinary://')) {
      throw new BadRequestException('Cloudinary no configurado.');
    }

    const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(cloudinaryUrl);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `stores/${store.id}/products/${productId}`;
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

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
      throw new BadRequestException(`Error al subir imagen: ${errorBody}`);
    }

    const body = (await response.json()) as { secure_url: string; public_id: string };

    const photo = await this.prisma.productPhoto.create({
      data: {
        productId,
        url: body.secure_url,
        publicId: body.public_id,
        order: photoCount + 1,
      },
    });

    return {
      id: photo.id,
      url: photo.url,
      publicId: photo.publicId,
      order: photo.order,
    };
  }

  async deleteProductPhoto(userId: string, photoId: string) {
    const store = await this.prisma.store.findUnique({
      where: { ownerId: userId },
      select: { id: true },
    });
    if (!store) throw new NotFoundException('No tienes una tienda asociada');

    const photo = await this.prisma.productPhoto.findFirst({
      where: { id: photoId, product: { storeId: store.id } },
      select: { id: true, publicId: true, productId: true },
    });
    if (!photo) throw new NotFoundException('Foto no encontrada o no te pertenece');

    // Intentar eliminar de Cloudinary (no bloqueante si falla)
    try {
      const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
      if (cloudinaryUrl?.startsWith('cloudinary://')) {
        const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(cloudinaryUrl);
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = createHash('sha1')
          .update(`public_id=${photo.publicId}&timestamp=${timestamp}${apiSecret}`)
          .digest('hex');
        const fd = new FormData();
        fd.append('public_id', photo.publicId);
        fd.append('api_key', apiKey);
        fd.append('timestamp', String(timestamp));
        fd.append('signature', signature);
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: fd });
      }
    } catch {
      /* ignorar error de Cloudinary */
    }

    await this.prisma.productPhoto.delete({ where: { id: photo.id } });

    // Reordenar fotos restantes
    const remaining = await this.prisma.productPhoto.findMany({
      where: { productId: photo.productId },
      orderBy: { order: 'asc' },
    });
    await Promise.all(
      remaining.map((p, i) => this.prisma.productPhoto.update({ where: { id: p.id }, data: { order: i + 1 } })),
    );

    return { message: 'Foto eliminada correctamente' };
  }

  // METODO PARA SUBIR COMPROBANTE DE PAGO DE UN PEDIDO, CON VALIDACIONES DE USUARIO, PEDIDO Y ESTADO, Y MANEJO DE CLOUDINARY
  async uploadVoucher(userId: string, orderId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Debes enviar un archivo');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('El archivo debe ser una imagen');

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, clientId: true, status: true, voucherPublicId: true },
    });
    if (!order || order.clientId !== userId) throw new NotFoundException('Pedido no encontrado');
    if (order.status !== 'PENDING') throw new BadRequestException('Solo puedes subir comprobante en pedidos pendientes');

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
    if (!cloudinaryUrl?.startsWith('cloudinary://')) throw new BadRequestException('Cloudinary no configurado.');

    const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(cloudinaryUrl);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `vouchers/${orderId}`;
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
      throw new BadRequestException(`Error al subir comprobante: ${errorBody}`);
    }

    const body = (await response.json()) as { secure_url: string; public_id: string };

    // Eliminar voucher anterior de Cloudinary si existe
    if (order.voucherPublicId) {
      try {
        const ts = Math.floor(Date.now() / 1000);
        const sig = createHash('sha1').update(`public_id=${order.voucherPublicId}&timestamp=${ts}${apiSecret}`).digest('hex');
        const fd = new FormData();
        fd.append('public_id', order.voucherPublicId);
        fd.append('api_key', apiKey);
        fd.append('timestamp', String(ts));
        fd.append('signature', sig);
        await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: fd });
      } catch { /* ignorar */ }
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { voucherUrl: body.secure_url, voucherPublicId: body.public_id },
    });

    return { voucherUrl: body.secure_url };
  }

  async uploadFile(file: Express.Multer.File | undefined, folder: string): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('Debes enviar un archivo');

    const cloudinaryUrl = this.config.get<string>('CLOUDINARY_URL');
    if (!cloudinaryUrl?.startsWith('cloudinary://')) {
      throw new BadRequestException('Cloudinary no configurado.');
    }

    const { cloudName, apiKey, apiSecret } = this.parseCloudinaryUrl(cloudinaryUrl);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');

    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);

    const resourceType = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new BadRequestException(`Error al subir archivo: ${errorBody}`);
    }

    const body = (await response.json()) as { secure_url: string; public_id: string };
    return { url: body.secure_url, publicId: body.public_id };
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
