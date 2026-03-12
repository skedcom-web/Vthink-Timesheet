import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/assignments')
export class AssignmentsController {
  constructor(private assignmentsService: AssignmentsService) {}

  @Post() create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: any) {
    return this.assignmentsService.create(dto, user.id);
  }

  @Get() findAll() { return this.assignmentsService.findAll(); }
}
