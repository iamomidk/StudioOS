import { Injectable, Logger } from '@nestjs/common';

import type { RenderedNotificationTemplate } from './notification-template.service.js';

@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name);

  sendEmail(recipientUserId: string, message: RenderedNotificationTemplate): Promise<void> {
    this.logger.log(`Email notification sent to ${recipientUserId}: ${message.subject}`);
    return Promise.resolve();
  }

  sendPush(recipientUserId: string, message: RenderedNotificationTemplate): Promise<void> {
    // Push is intentionally a stub in this phase.
    this.logger.log(`Push notification stub for ${recipientUserId}: ${message.subject}`);
    return Promise.resolve();
  }
}
