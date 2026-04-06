import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/create-task.dto';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/tasks')
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(dto, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a task (name, status, dates, etc.)' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get tasks — hierarchy-filtered by actor role' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'activeOnly', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    if (activeOnly === 'true') return this.tasksService.findActive(projectId);
    return this.tasksService.findAll(user, projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single task with assignments' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }
}
