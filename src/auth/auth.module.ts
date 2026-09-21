import { Module, Global } from "@nestjs/common";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.services";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { GoogleStrategy } from "./strategies/google.strategy";
import { PrismaModule } from "src/prisma/prisma.module";
import { MailService } from "src/utils/mail.service";
import { CleanupService } from "./services/cleanup.service";
import { ThrottlerModule } from "@nestjs/throttler";

@Global()
@Module({
    imports: [
       PrismaModule,
       ThrottlerModule.forRoot([{
         ttl: 60000,
         limit: 5,
       }]),
       
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy, MailService, CleanupService],
    exports: [AuthService, ThrottlerModule],
})
export class AuthModule { }
