import { metadata } from "reflect-metadata/no-conflict";
import { SetMetadata } from "@nestjs/common";
import { Role } from "src/prisma/client/enums";

export const userRoles =(...roles : Role[])=> SetMetadata('roles', roles);