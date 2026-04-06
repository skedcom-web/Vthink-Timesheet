import { IsString, IsDateString, IsArray, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TimesheetEntryDto {
  @ApiProperty() @IsString() projectId: string;
  @ApiProperty() @IsString() taskId: string;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) monday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) tuesday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) wednesday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) thursday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) friday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) saturday: number = 0;
  @ApiProperty({ default: 0 }) @IsNumber() @Min(0) @Max(24) sunday: number = 0;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateTimesheetDto {
  @ApiProperty() @IsDateString() weekStartDate: string;
  @ApiProperty() @IsDateString() weekEndDate: string;
  @ApiProperty({ type: [TimesheetEntryDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => TimesheetEntryDto)
  entries: TimesheetEntryDto[];
}
