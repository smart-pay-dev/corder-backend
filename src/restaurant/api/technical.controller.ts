import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { RestaurantId } from '../infrastructure/restaurant-id.decorator';
import { RestaurantUser } from '../infrastructure/restaurant-user.decorator';
import { PrintersService, CreatePrinterDto, UpdatePrinterDto } from '../application/printers.service';
import { AuditLogsService, CreateAuditLogDto } from '../application/audit-logs.service';
import { BackupsService, CreateBackupDto } from '../application/backups.service';
import { AuditCategory } from '../domain/audit-log.entity';
import { R2UploadService } from '../infrastructure/r2-upload.service';
import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Controller('restaurant')
@UseGuards(RestaurantJwtGuard)
export class TechnicalController {
  constructor(
    private readonly printers: PrintersService,
    private readonly audits: AuditLogsService,
    private readonly backups: BackupsService,
    private readonly r2: R2UploadService,
    private readonly config: ConfigService,
  ) {}

  // ----- Printers -----

  @Get('printers')
  listPrinters(@RestaurantId() restaurantId: string) {
    return this.printers.list(restaurantId);
  }

  @Post('printers')
  createPrinter(@RestaurantId() restaurantId: string, @Body() body: CreatePrinterDto) {
    return this.printers.create(restaurantId, body);
  }

  @Put('printers/:id')
  updatePrinter(
    @RestaurantId() restaurantId: string,
    @Param('id') id: string,
    @Body() body: UpdatePrinterDto,
  ) {
    return this.printers.update(restaurantId, id, body);
  }

  @Delete('printers/:id')
  deletePrinter(@RestaurantId() restaurantId: string, @Param('id') id: string) {
    return this.printers.remove(restaurantId, id);
  }

  // ----- Audit logs -----

  @Get('audit-logs')
  listAuditLogs(
    @RestaurantId() restaurantId: string,
    @Query('category') category?: AuditCategory,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const n = limit ? Number(limit) : 200;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    return this.audits.list(restaurantId, {
      category,
      limit: n,
      from: fromDate && Number.isFinite(fromDate.getTime()) ? fromDate : undefined,
      to: toDate && Number.isFinite(toDate.getTime()) ? toDate : undefined,
    });
  }

  @Post('audit-logs')
  createAuditLog(
    @RestaurantId() restaurantId: string,
    @RestaurantUser() user: { id: string; name: string },
    @Body() body: Omit<CreateAuditLogDto, 'userId' | 'userName'> & { userId?: string; userName?: string },
  ) {
    return this.audits.create(restaurantId, {
      userId: body.userId ?? user.id,
      userName: body.userName ?? user.name,
      action: body.action,
      category: body.category,
      details: body.details,
      metadata: body.metadata,
    });
  }

  // ----- Backups -----

  @Get('backups')
  listBackups(@RestaurantId() restaurantId: string) {
    return this.backups.list(restaurantId);
  }

  @Post('backups')
  createBackup(@RestaurantId() restaurantId: string, @Body() body: CreateBackupDto) {
    return this.backups.create(restaurantId, body);
  }

  // ----- TEMP: R2 cache backfill — bu endpoint işi yapınca silinecek -----

  @Post('admin/r2-backfill-cache')
  async r2BackfillCache() {
    if (!this.r2.isConfigured()) {
      return { ok: false, message: 'R2 yapılandırılmamış' };
    }

    const accountId = this.config.get<string>('R2_ACCOUNT_ID')!.trim();
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID')!.trim();
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY')!.trim();
    const bucket = this.config.get<string>('R2_BUCKET_NAME')!.trim();

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED' as any,
      responseChecksumValidation: 'WHEN_REQUIRED' as any,
    });

    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken }));
      for (const obj of res.Contents ?? []) { if (obj.Key) keys.push(obj.Key); }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    let updated = 0;
    const errors: string[] = [];

    for (const key of keys) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        await client.send(new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${key}`,
          Key: key,
          ContentType: head.ContentType ?? 'application/octet-stream',
          CacheControl: 'public, max-age=31536000, immutable',
          MetadataDirective: 'REPLACE',
        }));
        updated++;
      } catch (err: any) {
        errors.push(`${key}: ${err?.message}`);
      }
    }

    return { ok: true, total: keys.length, updated, errors };
  }
}

