import { IsString, IsDateString, IsNumber, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty() @IsString() @IsNotEmpty() taskId: string;
  @ApiProperty() @IsString() @IsNotEmpty() employeeId: string;
  @ApiProperty() @IsDateString() assignStartDate: string;
  @ApiProperty() @IsDateString() assignEndDate: string;
  @ApiProperty({ default: 100 }) @IsNumber() @Min(0) @Max(100) allocationPercentage: number = 100;
  @ApiPropertyOptional() @IsOptional() @IsString() roleOnTask?: string;
}
