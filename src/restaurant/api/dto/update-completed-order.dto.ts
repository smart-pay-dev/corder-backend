import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CompletedOrderDto, CompletedPaymentDto } from './create-completed-order.dto';

/** Tamamlanan hesap düzeltmesi — toplamlar sunucuda yeniden hesaplanır. */
export class UpdateCompletedOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompletedOrderDto)
  orders!: CompletedOrderDto[];

  @ValidateNested()
  @Type(() => CompletedPaymentDto)
  payment!: CompletedPaymentDto;
}
