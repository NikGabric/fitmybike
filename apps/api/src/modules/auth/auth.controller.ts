import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CurrentUser as CurrentUserPayload } from '@fitmybike/shared';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import type { RequestUser } from '../../common/types/request-user';
import { AuthService } from './auth.service';
import { CurrentUserDto, LoginDto } from './auth.dto';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  // Only this route is throttled. A global guard would also cover the fit wizard, which
  // autosaves on a debounce and on blur, and would refuse ordinary use.
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts from this address' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CurrentUserPayload> {
    const { id } = await this.auth.validateCredentials(dto.email, dto.password);

    await this.sessions.issue(id, response, {
      userAgent: request.get('user-agent') ?? undefined,
      ip: request.ip,
    });

    return this.auth.getCurrentUser(id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.sessions.revoke(user.sessionId, response);
  }

  @Get('me')
  @ApiOkResponse({ type: CurrentUserDto })
  me(@CurrentUser() user: RequestUser): CurrentUserPayload {
    return this.auth.toCurrentUser(user);
  }
}
