import { IsString, IsDateString, IsNumber, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty()          @IsString()     @IsNotEmpty()               taskId:               string;
  @ApiPropertyOptional()  @IsOptional()   @IsString()                 employeeId?:          string; // users table UUID (optional)
  @ApiPropertyOptional()  @IsOptional()   @IsString()                 employeeNo?:          string; // from employee_configs
  @ApiPropertyOptional()  @IsOptional()   @IsString()                 employeeName?:        string; // display name
  @ApiProperty()          @IsDateString()                             assignStartDate:      string;
  @ApiProperty()          @IsDateString()                             assignEndDate:        string;
  @ApiProperty({ default: 100 }) @IsNumber() @Min(0) @Max(100)       allocationPercentage: number = 100;
  @ApiPropertyOptional()  @IsOptional()   @IsString()                 roleOnTask?:          string;

  // frontend sends projectId for task filtering — ignored by backend
  @ApiPropertyOptional()  @IsOptional()   @IsString()                 projectId?:           string;
}
