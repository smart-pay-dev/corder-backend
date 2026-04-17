import { IsUUID, IsOptional, IsString, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
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
}
