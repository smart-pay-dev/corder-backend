import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

@Injectable()
export class R2UploadService {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;
  private readonly publicBase: string | null;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID')?.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')?.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')?.trim();
    const bucket = this.config.get<string>('R2_BUCKET_NAME')?.trim();
    const publicBase = this.config.get<string>('R2_PUBLIC_BASE_URL')?.trim()?.replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey && bucket && publicBase) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
      this.publicBase = publicBase;
    } else {
      this.client = null;
      this.bucket = null;
      this.publicBase = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null && this.bucket !== null && this.publicBase !== null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client || !this.bucket || !this.publicBase) {
      throw new Error('R2 is not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `${this.publicBase}/${key}`;
  }
}
