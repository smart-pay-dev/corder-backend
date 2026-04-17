import { IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class PrintReceiptLineDto {
  @IsString()
  productName: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  note?: string;

  /** Ürün ID — sunucu kategori UUID ekler (print-agent kategori→yazıcı). */
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

/** Masa fişi: `tableId` ile sunucu birleştirir. Elden satış vb.: `tableId` yoksa `tableName` + `items` + `total` zorunlu. */
export class PrintReceiptDto {
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  tableName?: string;

  @IsOptional()
  @IsString()
  waiterName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrintReceiptLineDto)
  items?: PrintReceiptLineDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  /**
   * `consolidated` = yönetim paneli kasa fişi (tek yazıcı, MANAGEMENT_RECEIPT_PRINTER).
   * `split` = terminal / kategori bazlı adisyon (PRINT_CATEGORY_ROUTES). Varsayılan: split.
   */
  @IsOptional()
  @IsIn(['consolidated', 'split'])
  receiptMode?: 'consolidated' | 'split';
}
