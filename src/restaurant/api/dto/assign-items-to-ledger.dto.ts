import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AssignItemsToLedgerDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  itemIds: string[];

  @IsUUID()
  ledgerCustomerId: string;
}
