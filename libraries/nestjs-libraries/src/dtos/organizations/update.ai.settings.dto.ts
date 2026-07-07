import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'AI Base URL must be a valid URL' })
  aiBaseUrl?: string;

  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @IsOptional()
  @IsString()
  aiModel?: string;
}
