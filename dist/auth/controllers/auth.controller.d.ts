import { UserRegisterDto } from "../dtos/user-register.dto";
import { AuthService } from "../services/auth.services";
import { UserLoginDto } from "../dtos/user-login.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(userDto: UserRegisterDto): Promise<{
        message: string;
        user: {
            id: number;
            email: string;
            name: string;
            role: import("../../prisma/client/enums").Role;
        };
        access_token: string;
    }>;
    signin(userDto: UserLoginDto): Promise<{
        message: string;
        user: {
            id: number;
            email: string;
            name: string;
            role: import("../../prisma/client/enums").Role;
        };
        access_token: string;
    }>;
}
