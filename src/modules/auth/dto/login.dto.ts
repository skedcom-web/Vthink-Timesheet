import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: 'VT348 or name@vthink.co.in', description: 'Employee ID or Email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  email: string; // accepts both email and employeeId

  @ApiProperty({ example: 'YourPassword@123' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  password: string;
}
