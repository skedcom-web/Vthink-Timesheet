import { Body, Controller, Get, Put, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

/**
 * Email notification **configuration** (weekly + status rules) is **Super Admin only**.
 * Company Admins and other roles receive scheduled emails but cannot change settings.
 */
@ApiTags('Admin — Notifications')
@ApiBearerAuth()
@Controller('api/v1/admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  getSettings() {
    return this.notifications.getSettings();
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateSettings(@Body() dto: UpdateNotificationSettingsDto, @CurrentUser() user: { id: string }) {
    return this.notifications.updateSettings(dto, user.id);
  }
}
