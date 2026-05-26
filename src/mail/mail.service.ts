import { Injectable } from '@nestjs/common';
import { CreateMailDto } from './dto/create-mail.dto';
import { UpdateMailDto } from './dto/update-mail.dto';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

  async send6DigitCode(email: string, code: string) {
    await this.mailerService.sendMail({
      to: email,
      subject: 'Código de verificación - HUNBOLI',
      template: 'verification-code',
      context: {
        subject: 'Código de verificación - HUNBOLI',
        code,
        year: new Date().getFullYear(),
      },
    });
  }
}
