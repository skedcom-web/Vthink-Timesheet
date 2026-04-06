import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class StatusReminderRuleDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty({ enum: ['NOT_INITIATED', 'DRAFT', 'SUBMITTED', 'REJECTED'] }) @IsString() statusKey!: string;
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty({ description: '1=Mon … 7=Sun (IST)' }) @IsArray() @IsInt({ each: true }) weekdaysMonFirst!: number[];
  @ApiProperty({ minimum: 0, maximum: 23 }) @IsInt() @Min(0) @Max(23) hour!: number;
  @ApiProperty({ minimum: 0, maximum: 59 }) @IsInt() @Min(0) @Max(59) minute!: number;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() weeklyReminderEnabled?: boolean;

  @ApiPropertyOptional({ type: [StatusReminderRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusReminderRuleDto)
  statusReminderRules?: StatusReminderRuleDto[];
}
