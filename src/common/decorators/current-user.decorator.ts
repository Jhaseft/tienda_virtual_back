import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  userId: string;
  email?: string;
  role: string;
  profileComplete: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
