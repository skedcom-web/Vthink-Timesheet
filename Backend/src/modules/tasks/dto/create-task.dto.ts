import { IsString, IsIn, IsOptional, IsDateString, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TASK_TYPES     = ['DEVELOPMENT', 'DESIGN', 'TESTING', 'MANAGEMENT', 'SUPPORT', 'DOCUMENTATION', 'MEETING'] as const;
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const TASK_STATUSES  = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;

export class CreateTaskDto {
  @ApiProperty()        @IsString()  @IsNotEmpty()           projectId:   string;
  @ApiProperty()        @IsString()  @IsNotEmpty()           name:        string;
  @ApiPropertyOptional() @IsOptional() @IsString()           description?: string;
  @ApiProperty({ enum: TASK_TYPES, default: 'DEVELOPMENT' })
  @IsIn(TASK_TYPES)                                          taskType:    string = 'DEVELOPMENT';
  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: 'MEDIUM' })
  @IsOptional() @IsIn(TASK_PRIORITIES)                       priority?:   string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()       startDate?:  string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()       endDate?:    string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()          billable?:   boolean;
}

export class UpdateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsString()           name?:        string;
  @ApiPropertyOptional() @IsOptional() @IsString()           description?: string;
  @ApiPropertyOptional({ enum: TASK_TYPES })
  @IsOptional() @IsIn(TASK_TYPES)                            taskType?:    string;
  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional() @IsIn(TASK_PRIORITIES)                       priority?:    string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()       startDate?:   string;
  @ApiPropertyOptional() @IsOptional() @IsDateString()       endDate?:     string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean()          billable?:    boolean;
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional() @IsIn(TASK_STATUSES)                         status?:      string;
}
