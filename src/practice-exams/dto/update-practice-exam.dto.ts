import { PartialType } from "@nestjs/swagger";
import { CreatePracticeExamDto } from "./create-practice-exam.dto";

export class UpdatePracticeExamDto extends PartialType(CreatePracticeExamDto) {}
