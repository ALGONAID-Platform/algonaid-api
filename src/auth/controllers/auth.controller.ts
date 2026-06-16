import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";
import { ForgotPasswordDto } from "../dtos/forgot-password.dto";
import { ResetPasswordDto } from "../dtos/reset-password.dto";
import { GoogleMobileLoginDto } from "../dtos/google-mobile-login.dto";
import { SwaggerGoogleAuth, SwaggerGoogleCallback, SwaggerGoogleMobileAuth, SwaggerLogin, SwaggerRegister } from "../decorators/swagger.decorators";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";


@ApiTags("auth")
@Controller("auth")
export class AuthController {

    constructor(
        private readonly authService: AuthService
    ) {

    }


    @SwaggerRegister()
    @Post('signup')
    async register(@Body() userDto: UserRegisterDto) {
        return await this.authService.register(userDto);

    }


    @HttpCode(HttpStatus.OK)
    @Post('signin')
    @SwaggerLogin()
    async signin(@Body() userDto: UserLoginDto) {
        return await this.authService.login(userDto);
    }

    @Post('forgot-password')
    @ApiOperation({ summary: 'Request password reset token' })
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        return await this.authService.forgotPassword(forgotPasswordDto);
    }

    @Post('reset-password')
    @ApiOperation({ summary: 'Reset password using token' })
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        return await this.authService.resetPassword(resetPasswordDto);
    }

    @Get('google')
    @SwaggerGoogleAuth()
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req: any) {
        // Redirection handled by Google Strategy
    }

    @Get('google/callback')
    @SwaggerGoogleCallback()
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req: any) {
        return this.authService.validateGoogleUser(req.user);
    }

    @Post('google/mobile')
    @SwaggerGoogleMobileAuth()
    async googleMobileAuth(@Body() googleMobileLoginDto: GoogleMobileLoginDto) {
        return await this.authService.loginWithGoogleMobile(googleMobileLoginDto.idToken);
    }

    @Get(":id")
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Get current user data by ID' })
    async getCurrentUser(@Param("id", ParseIntPipe) id: number) {
        return await this.authService.getCurrentUser(id);
    }

    @Post('logout')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Logout user and invalidate token' })
    async logout(@Req() req: any) {
        const [type, token] = req.headers.authorization?.split(" ") ?? [];
        if (token && type === 'Bearer') {
            return await this.authService.logout(token);
        }
        return { message: 'Already logged out' };
    }

    }