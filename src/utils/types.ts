import { UserRole } from "src/auth/enums/userRole";

export type JwtPayloadType = {
    id: number;
    email: string;
    role: UserRole;
}