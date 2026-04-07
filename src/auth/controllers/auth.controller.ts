import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, UseGuards } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";
import { SwaggerGoogleAuth, SwaggerGoogleCallback, SwaggerLogin, SwaggerRegister } from "../decorators/swagger.decorators";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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

    @Get(":id")
    async getCureentUser(@Param("id", ParseIntPipe) id: number) {
        return await this.authService.getCurrentUser(id);
    }

}