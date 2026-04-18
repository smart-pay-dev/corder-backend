import { ArrayMinSize, IsArray, IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class ReorderCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  ids: string[];

  /** Bos veya gonderilmezse ilk kategorinin parent_id degeri kullanilir (geriye uyum). */
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsUUID()
  parentId?: string | null;
}
