import type { Notification } from '../types/notification';
import type { StoreSummary } from '../types/store';
import { getNotificationMessageParts } from '../utils/notificationStore';

interface NotificationMessageProps {
  notification: Notification;
  assignedStores?: StoreSummary[];
}

function NotificationMessage({ notification, assignedStores }: NotificationMessageProps) {
  const { beforeStoreName, storeName, afterStoreName } = getNotificationMessageParts(notification, assignedStores);

  return (
    <>
      {beforeStoreName}
      {storeName && <strong>{storeName}</strong>}
      {afterStoreName}
    </>
  );
}

export default NotificationMessage;
