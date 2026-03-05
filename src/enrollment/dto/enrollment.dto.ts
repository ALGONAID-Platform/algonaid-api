import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty } from "class-validator";

export class CreateEnrollmentDto {

    @IsNotEmpty()
    @IsInt()
    @ApiProperty({title : " course Id" , description:"every course have course id "  })
    courseId: number;
}