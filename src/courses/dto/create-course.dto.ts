import { IsOptional } from "class-validator";

export class CreateCourseDto {

    title : string;

    @IsOptional()
    description :string;

    @IsOptional()
    thumbnail : string;
}
