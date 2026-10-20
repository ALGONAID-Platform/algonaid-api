import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CertificateGeneratorService } from './certificate-generator.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CertificateGeneratorService],
  exports: [CertificateGeneratorService],
})
export class CertificatesModule {}

