import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OtpType, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

type UserSafe = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /* ── Registro con email ── */
  async register(dto: RegisterDto) {
    const [emailExists, phoneExists] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({ where: { phoneNumber: dto.phoneNumber } }),
    ]);

    if (emailExists) throw new ConflictException('El correo ya está registrado');
    if (phoneExists) throw new ConflictException('El teléfono ya está registrado');

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        password: hashedPassword,
      },
    });

    const code = await this.createOtp(dto.email, OtpType.EMAIL);
    await this.mail.send6DigitCode(dto.email, code);

    return { message: 'Código de verificación enviado al correo', userId: user.id };
  }

  /* ── Login con credenciales ── */
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.password) throw new UnauthorizedException('Credenciales inválidas');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) throw new UnauthorizedException('Credenciales inválidas');

    return { token: this.generateToken(user), user: this.sanitize(user) };
  }

  /* ── Sync usuario de Google ── */
  async googleAuth(dto: GoogleAuthDto) {
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: dto.googleId }, { email: dto.email }] },
    });

    if (!user) {
      const [firstName, ...rest] = (dto.name ?? '').split(' ');
      user = await this.prisma.user.create({
        data: {
          googleId: dto.googleId,
          email: dto.email,
          firstName: firstName || null,
          lastName: rest.join(' ') || null,
          avatarUrl: dto.picture ?? null,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: dto.googleId, avatarUrl: dto.picture ?? user.avatarUrl },
      });
    }

    return {
      token: this.generateToken(user),
      user: this.sanitize(user),
      profileComplete: user.isProfileComplete,
    };
  }

  /* ── Completar perfil (usuario Google sin teléfono) ── */
  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const phoneExists = await this.prisma.user.findFirst({
      where: { phoneNumber: dto.phoneNumber, NOT: { id: userId } },
    });
    if (phoneExists) throw new ConflictException('El teléfono ya está registrado');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
      },
    });

    const code = await this.createOtp(dto.phoneNumber, OtpType.WHATSAPP);
    await this.whatsapp.sendText(
      dto.phoneNumber,
      `Tu código de verificación de MiTienda es: *${code}*\nVence en 10 minutos.`,
    );

    return { message: 'Código de verificación enviado por WhatsApp' };
  }

  /* ── Verificar OTP ── */
  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        target: dto.target,
        code: dto.code,
        type: dto.type,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) throw new BadRequestException('Código inválido o expirado');

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });

    const field = dto.type === OtpType.EMAIL ? { email: dto.target } : { phoneNumber: dto.target };
    const user = await this.prisma.user.findFirst({ where: field });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { isProfileComplete: true },
    });

    return { token: this.generateToken(updated), user: this.sanitize(updated) };
  }

  /* ── Recuperar contraseña: enviar código ── */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('No existe una cuenta con ese correo');

    const code = await this.createOtp(email, OtpType.EMAIL);
    await this.mail.send6DigitCode(email, code);

    return { message: 'Código de recuperación enviado al correo' };
  }

  /* ── Recuperar contraseña: solo verificar código (sin cambiar nada) ── */
  async verifyForgotPasswordOtp(email: string, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        target: email,
        code,
        type: OtpType.EMAIL,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp) throw new BadRequestException('Código inválido o expirado');
    return { message: 'Código válido' };
  }

  /* ── Recuperar contraseña: verificar código y cambiar contraseña ── */
  async resetPassword(email: string, code: string, newPassword: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        target: email,
        code,
        type: OtpType.EMAIL,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });
    if (!otp) throw new BadRequestException('Código inválido o expirado');

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await Promise.all([
      this.prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } }),
      this.prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
    ]);

    return { message: 'Contraseña actualizada correctamente' };
  }

  /* ── Reenviar OTP ── */
  async resendOtp(dto: ResendOtpDto) {
    const code = await this.createOtp(dto.target, dto.type);

    if (dto.type === OtpType.EMAIL) {
      await this.mail.send6DigitCode(dto.target, code);
    } else {
      await this.whatsapp.sendText(
        dto.target,
        `Tu código de verificación de MiTienda es: *${code}*\nVence en 10 minutos.`,
      );
    }

    return { message: 'Código reenviado correctamente' };
  }

  /* ── Helpers privados ── */

  private generateToken(user: User): string {
    return this.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      profileComplete: user.isProfileComplete,
    });
  }

  private sanitize(user: User): UserSafe {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  private async createOtp(target: string, type: OtpType): Promise<string> {
    await this.prisma.otpCode.updateMany({
      where: { target, type, used: false },
      data: { used: true },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpCode.create({ data: { target, code, type, expiresAt } });

    return code;
  }
}
