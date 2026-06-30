import { metadata } from "reflect-metadata/no-conflict";
import { SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";

export const userRoles =(...roles : Role[])=> SetMetadata('roles', roles);