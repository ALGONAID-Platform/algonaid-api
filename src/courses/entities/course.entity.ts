export class Course {
    id: number;
    title: string;
    description?: string;
    thumbnail?: string;
    youtubeLink?: string;
    instructorId: number;
    createdAt: Date;
    updatedAt: Date;
}
