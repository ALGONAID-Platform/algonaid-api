import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { uploadFile } from '@uploadcare/upload-client';

@Injectable()
export class UploadcareStorageService {
  private publicKey: string;

  constructor(private configService: ConfigService) {
    this.publicKey = this.configService.get<string>('UPLOADCARE_PUBLIC_KEY') as string;
  }

  async upload(file: Express.Multer.File): Promise<string> {
    try {
      const result = await uploadFile(file.buffer, {
        publicKey: this.publicKey,
        store: 'auto',
        fileName: file.originalname,
      });

      return result.cdnUrl;
    } catch (error) {
      throw new Error(`Uploadcare upload error: ${error.message}`);
    }
  }

  /**
   * Note: Uploadcare's client-side library doesn't support file deletion 
   * via public key for security reasons. Deletion requires the REST API 
   * and a Secret Key. If you need deletion, we can add it later using 
   * the @uploadcare/api-client-utils or simple fetch calls.
   */
  async deleteFile(fileUrl: string): Promise<void> {
    // Placeholder for future REST API implementation
    console.log(`Manual deletion required for: ${fileUrl} or use Uploadcare REST API`);
  }
}
