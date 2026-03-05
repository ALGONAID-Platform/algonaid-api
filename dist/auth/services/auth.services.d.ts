import { UserRegisterDto } from "../dtos/user-register.dto";
import { UserLoginDto } from "../dtos/user-login.dto";
import { PrismaService } from "src/prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { Role } from "../../prisma/client/enums";
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    register(userDto: UserRegisterDto): Promise<{
        message: string;
        user: {
            id: number;
            email: string;
            name: string;
            role: Role;
        };
        access_token: string;
    }>;
    login(userDto: UserLoginDto): Promise<{
        message: string;
        user: {
            id: number;
            email: string;
            name: string;
            role: Role;
        };
        access_token: string;
    }>;
    private generateToken;
}
