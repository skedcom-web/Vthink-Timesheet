import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'VT348 or name@vthink.co.in', description: 'Employee ID or Email' })
  @IsString()
  email: string;  // accepts both email and employeeId

  @ApiProperty({ example: 'YourPassword@123' })
  @IsString()
  @MinLength(6)
  password: string;
}
