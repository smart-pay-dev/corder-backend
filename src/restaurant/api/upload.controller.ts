import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RestaurantJwtGuard } from '../infrastructure/restaurant-jwt.guard';

const uploadsDir = process.cwd() + '/uploads';

export const uploadStorage = diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${extname(file.originalname) || '.bin'}`;
    cb(null, suffix);
  },
});

@Controller('restaurant/upload')
@UseGuards(RestaurantJwtGuard)
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
        if (allowed) cb(null, true);
        else cb(new BadRequestException('Only images (jpeg, png, gif, webp) allowed'), false);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return { url: `/uploads/${file.filename}` };
  }
}
