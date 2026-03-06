"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const userRole_1 = require("../enums/userRole");
const enums_1 = require("../../prisma/client/enums");
let AuthService = class AuthService {
    prisma;
    jwtService;
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async register(userDto) {
        const { email, password, name, role } = userDto;
        const existingUser = await this.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            throw new common_1.ConflictException('Email already registered');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        let prismaRole = enums_1.Role.STUDENT;
        if (role === userRole_1.UserRole.ADMIN)
            prismaRole = enums_1.Role.ADMIN;
        if (role === userRole_1.UserRole.OWNER)
            prismaRole = enums_1.Role.OWNER;
        const user = await this.prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: prismaRole,
                ...(prismaRole === enums_1.Role.STUDENT ? {
                    studentProfile: {
                        create: {
                            academicId: `STU-${Date.now()}`
                        }
                    }
                } : prismaRole === enums_1.Role.ADMIN ? {
                    teacherProfile: {
                        create: {
                            specialization: 'General'
                        }
                    }
                } : {})
            }
        });
        const token = await this.generateToken(user.id, user.email, user.role);
        return {
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }
    async login(userDto) {
        const { email, password } = userDto;
        const user = await this.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const token = await this.generateToken(user.id, user.email, user.role);
        return {
            message: 'Logged in successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            access_token: token
        };
    }
    async getCurrentUser(id) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException(`user with id ${id} is not exist`);
        }
        else {
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
            };
        }
    }
    async generateToken(userId, email, role) {
        let userRole = userRole_1.UserRole.STUDENT;
        if (role === enums_1.Role.ADMIN)
            userRole = userRole_1.UserRole.ADMIN;
        if (role === enums_1.Role.OWNER)
            userRole = userRole_1.UserRole.OWNER;
        const payload = { id: userId, email, role: userRole };
        return await this.jwtService.signAsync(payload);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.services.js.map