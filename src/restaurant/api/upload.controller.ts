import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';
import { R2UploadService } from '../infrastructure/r2-upload.service';

const uploadsDir = () => join(process.cwd(), 'uploads');

function buildObjectKey(originalName: string): string {
  const ext = extname(originalName) || '.bin';
  const suffix = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  return `menu/${suffix}`;
}

@Controller('restaurant/upload')
@UseGuards(RestaurantJwtGuard)
export class UploadController {
  constructor(private readonly r2: R2UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new BadRequestException('Only images (jpeg, png, gif, webp) allowed'), false);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException('No file uploaded');

    const key = buildObjectKey(file.originalname);

    if (this.r2.isConfigured()) {
      const url = await this.r2.putObject(key, file.buffer, file.mimetype);
      return { url };
    }

    const filename = key.replace(/^menu\//, '');
    const dest = join(uploadsDir(), filename);
    await writeFile(dest, file.buffer);
    return { url: `/uploads/${filename}` };
  }
}
