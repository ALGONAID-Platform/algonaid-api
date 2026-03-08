import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateModuleDto {


    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    description?: string;

   
}
