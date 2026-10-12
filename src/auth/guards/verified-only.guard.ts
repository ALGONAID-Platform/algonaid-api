import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { MESSAGES } from '../../utils/messages';
import { CURRENT_USER_KEY } from '../../utils/conistants';

@Injectable()
export class VerifiedOnlyGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user ?? request[CURRENT_USER_KEY]; // Ensure this guard is applied AFTER AuthRollGuard / JwtAuthGuard

    if (!user) {
      return false; // If there's no user, let the AuthGuard handle the 401
    }

    if (!user.emailVerified) {
      throw new ForbiddenException({
        statusCode: 403,
        message: MESSAGES.AUTH.EMAIL_VERIFICATION_REQUIRED,
        action: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    return true;
  }
}
