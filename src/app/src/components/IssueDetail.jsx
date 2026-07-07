import { Button, Grid, Paper, Stack, Typography } from "@mui/material";
import { ExternalLink } from "lucide-react";

export function IssueDetail({ issue }) {
  if (!issue) {
    return (
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography color="text.secondary">Selecciona una incidencia del grid para ver su detalle.</Typography>
      </Paper>
    );
  }

  const detailEntries = Object.entries(issue.attributes || {});

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <div>
          <Typography variant="h6">{issue.issueKey}</Typography>
          <Typography variant="body2" color="text.secondary">{issue.summary}</Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<ExternalLink size={17} />}
          disabled={!issue.jiraUrl}
          onClick={() => window.open(issue.jiraUrl, "_blank", "noopener,noreferrer")}
        >
          Abrir incidencia en Jira
        </Button>
      </Stack>
      <Grid container spacing={1.5} sx={{ mt: 1 }}>
        {detailEntries.map(([key, value]) => (
          <Grid size={{ xs: 12, md: 6 }} key={key}>
            <Typography variant="caption" color="text.secondary">{key}</Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{formatDetail(value)}</Typography>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

function formatDetail(value) {
  if (value == null || value === "") return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
