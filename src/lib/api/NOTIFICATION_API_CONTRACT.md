# Notification API Contract

The React app integrates with **python-notification-service-fastapi** (e.g. in folder `General`). Set `VITE_NOTIFICATION_API_URL` in `.env` (default: `http://localhost:8700`).

## Expected endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/notifications` | List notifications. Query: `page`, `page_size`, `unread_only` (optional). |
| GET | `/v1/notifications/unread-count` | Get unread count. |
| PATCH | `/v1/notifications/{id}/read` | Mark one notification as read. |
| PATCH | `/v1/notifications/read-all` | Mark all as read. |

## Response shapes

**GET /v1/notifications**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "title": "string",
      "message": "string",
      "type": "info | success | warning | error",
      "read": false,
      "created_at": "ISO8601",
      "link": "string | null",
      "metadata": {}
    }
  ],
  "total": 0,
  "page": 1,
  "page_size": 20,
  "unread_count": 0
}
```

**GET /v1/notifications/unread-count**

```json
{
  "unread_count": 0
}
```

PATCH endpoints can return 204 No Content or 200 with a minimal body.
