import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class MoveOrderItemsDto {
  @IsUUID()
  fromTableId: string;

  @IsUUID()
  toTableId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  itemIds: string[];

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** Islemi yapan kisinin adi (kasa/root personelde yoksa bile gosterim). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  actorDisplayName?: string;
}
