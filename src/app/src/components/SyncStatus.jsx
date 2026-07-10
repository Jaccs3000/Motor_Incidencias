import { Box, Chip, Stack, Typography } from "@mui/material";
import { AlertCircle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

const statusConfig = {
  success: { color: "success", label: "Sincronizado correctamente", icon: CheckCircle2 },
  warning: { color: "warning", label: "Sincronización con advertencias", icon: TriangleAlert },
  error: { color: "error", label: "Error de sincronización", icon: AlertCircle },
  syncing: { color: "info", label: "Sincronizando...", icon: Loader2 },
  paused: { color: "warning", label: "Sincronizacion Pausada", icon: TriangleAlert },
  idle: { color: "default", label: "Sin sincronizar", icon: AlertCircle },
};

export function SyncStatus({ status, lastAttemptAt, message }) {
  const config = statusConfig[status] || statusConfig.idle;
  const Icon = config.icon;

  return (
    <Stack alignItems="flex-end" spacing={0.5}>
      <Chip
        color={config.color}
        variant="outlined"
        icon={<Icon size={16} />}
        label={status === "syncing" ? "Sincronizando..." : config.label}
      />
      <Box sx={{ textAlign: "right" }}>
        <Typography variant="caption" color="text.secondary">
          Ultima Sincronizacion: {lastAttemptAt ? new Date(lastAttemptAt).toLocaleString() : "sin registro"}
        </Typography>
        {message && message !== config.label ? (
          <Typography variant="caption" color="text.secondary" display="block">
            {message}
          </Typography>
        ) : null}
      </Box>
    </Stack>
  );
}
