import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";
import { SwaggerLogin, SwaggerRegister } from "../decorators/swagger.decorators";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HttpStatusCode } from "axios";

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

  
    @HttpCode(HttpStatus.OK) // Because the default status code is 201 ,
    @Post('signin')
    @SwaggerLogin()
    async signin(@Body() userDto: UserLoginDto) {
        return await this.authService.login(userDto);
    }

}