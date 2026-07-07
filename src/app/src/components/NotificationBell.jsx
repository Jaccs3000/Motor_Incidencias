import { Badge, Box, Button, Divider, IconButton, Menu, MenuItem, Stack, Typography } from "@mui/material";
import { Bell } from "lucide-react";
import { useState } from "react";
import { markNotificationRead } from "../services/notificationService";

export function NotificationBell({ notifications, onChanged }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const markRead = async (notification) => {
    await markNotificationRead(notification);
    await onChanged();
  };

  return (
    <>
      <IconButton onClick={(event) => setAnchorEl(event.currentTarget)} aria-label="notificaciones">
        <Badge badgeContent={notifications.length} color="error">
          <Bell size={21} />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} PaperProps={{ sx: { width: 420, maxWidth: "calc(100vw - 24px)" } }}>
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Notificaciones no leídas</Typography>
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <MenuItem disabled>No hay notificaciones pendientes.</MenuItem>
        ) : notifications.map((notification) => (
          <MenuItem key={notification.id} sx={{ whiteSpace: "normal", alignItems: "flex-start" }}>
            <Stack spacing={1} sx={{ width: "100%" }}>
              <Typography variant="body2" fontWeight={700}>{notification.title}</Typography>
              <Typography variant="body2" color="text.secondary">{notification.message}</Typography>
              <Button size="small" variant="outlined" onClick={() => markRead(notification)}>Marcar como leída</Button>
            </Stack>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
