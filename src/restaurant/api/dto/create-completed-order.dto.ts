import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CompletedOrderItemDto {
  @IsString()
  id: string;

  @IsString()
  productId: string;

  @IsString()
  productName: string;

  @IsNumber()
  price: number;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsString()
  status: string;

  @IsDateString()
  createdAt: string;
}

export class CompletedOrderDto {
  @IsString()
  id: string;

  @IsString()
  tableId: string;

  @IsString()
  userId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderItemDto)
  items: CompletedOrderItemDto[];

  @IsString()
  status: string;

  @IsDateString()
  createdAt: string;

  @IsDateString()
  updatedAt: string;
}

export class CompletedPaymentSplitDto {
  @IsString()
  method: string;

  @IsNumber()
  amount: number;
}

export class CompletedPaymentDiscountDto {
  @IsEnum(['percent', 'amount'])
  type: 'percent' | 'amount';

  @IsNumber()
  value: number;

  @IsString()
  reason: string;
}

export class CompletedPaymentDto {
  @IsString()
  id: string;

  @IsString()
  tableId: string;

  @IsString()
  tableName: string;

  @IsArray()
  @IsString({ each: true })
  orderIds: string[];

  @IsNumber()
  amount: number;

  @IsString()
  method: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedPaymentSplitDto)
  splitDetails?: CompletedPaymentSplitDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CompletedPaymentDiscountDto)
  discount?: CompletedPaymentDiscountDto;

  @IsOptional()
  @IsNumber()
  tip?: number;

  @IsString()
  processedBy: string;

  @IsDateString()
  createdAt: string;
}

export class CreateCompletedOrderDto {
  @IsString()
  tableName: string;

  @IsString()
  section: string;

  @IsString()
  waiter: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderDto)
  orders: CompletedOrderDto[];

  @ValidateNested()
  @Type(() => CompletedPaymentDto)
  payment: CompletedPaymentDto;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  discountAmount: number;

  @IsNumber()
  netAmount: number;

  @IsString()
  closedBy: string;

  @IsDateString()
  openedAt: string;

  @IsDateString()
  closedAt: string;
}

