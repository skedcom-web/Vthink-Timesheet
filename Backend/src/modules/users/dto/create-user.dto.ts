import { IsString, IsEmail, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CreateUserRole {
  COMPANY_ADMIN  = 'COMPANY_ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TEAM_MEMBER    = 'TEAM_MEMBER',
}

export class CreateUserDto {
  @ApiProperty()           @IsString()  @IsNotEmpty()                name:        string;
  @ApiProperty()           @IsEmail()                                email:       string;
  @ApiPropertyOptional()   @IsOptional() @IsString()                 employeeId?: string;
  @ApiPropertyOptional()   @IsOptional() @IsString()                 department?: string;
  @ApiProperty({ enum: CreateUserRole }) @IsEnum(CreateUserRole)     role:        CreateUserRole;
  @ApiPropertyOptional()   @IsOptional() @IsString()                 customEmailMessage?: string;
}

export class RevokeUserDto {
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() userId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customEmailMessage?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() currentPassword: string;
  @ApiProperty() @IsString() @IsNotEmpty() newPassword:     string;
}

export class SetNewPasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() token:       string;
  @ApiProperty() @IsString() @IsNotEmpty() newPassword: string;
}
