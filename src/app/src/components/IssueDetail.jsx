import { Button, Grid, Link, Paper, Stack, Typography } from "@mui/material";
import { ExternalLink, X } from "lucide-react";

export function IssueDetail({ issue, onClose }) {
  if (!issue) {
    return (
      <Paper variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
        <Typography color="text.secondary">Selecciona una incidencia del grid para ver su detalle.</Typography>
      </Paper>
    );
  }

  const details = [
    ["Número de Incidencia", issue.issueKey],
    ["Resumen", issue.summary],
    ["Tipo de incidencia", issue.issueType],
    ["Estado", issue.status],
    ["Informador", issue.attributes?.reporter],
    ["Responsable", issue.attributes?.assignee],
    ["Prioridad", issue.attributes?.priority],
    ["Fecha de creación", formatDate(issue.attributes?.createdAt)],
    ["Fecha de modificación", formatDate(issue.attributes?.updatedAt)],
    ["Fecha de resolución", formatDate(issue.attributes?.resolutionDate)],
    ["Tiempo estimado", formatDuration(issue.attributes?.timeOriginalEstimate)],
    ["Tiempo registrado", formatDuration(issue.attributes?.timeSpent)],
    ["Tiempo restante", formatDuration(issue.attributes?.timeRemainingEstimate)],
  ];

  return (
    <Paper variant="outlined" sx={{ p: 2, flexShrink: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
        <div>
          <Typography variant="h6">{issue.issueKey}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
            {issue.summary}
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={<ExternalLink size={17} />}
            disabled={!issue.jiraUrl}
            onClick={() => window.open(issue.jiraUrl, "_blank", "noopener,noreferrer")}
          >
            Abrir incidencia en Jira
          </Button>
          <Button variant="outlined" startIcon={<X size={17} />} onClick={onClose}>
            Ocultar
          </Button>
        </Stack>
      </Stack>
      <Grid container spacing={1.25} sx={{ mt: 1 }}>
        {details.map(([label, value]) => (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={label}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>{value || "Sin dato"}</Typography>
          </Grid>
        ))}
        <Grid size={{ xs: 12 }}>
          <Typography variant="caption" color="text.secondary">Descripción</Typography>
          <Typography component="div" variant="body2" sx={{ maxHeight: 95, overflow: "auto", pr: 1 }}>
            <Description value={issue.attributes?.description} />
          </Typography>
        </Grid>
      </Grid>
    </Paper>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(secondsValue) {
  const totalMinutes = Math.round(Number(secondsValue || 0) / 60);
  if (!totalMinutes) return "";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(" ");
}

function Description({ value }) {
  const parts = extractTextParts(value);
  if (!parts.length) return "Sin dato";
  return parts.map((part, index) =>
    part.url ? (
      <Link key={`${part.text}-${index}`} href={part.url} target="_blank" rel="noreferrer" sx={{ mr: 0.5 }}>
        {part.text || part.url}
      </Link>
    ) : (
      <span key={`${part.text}-${index}`}>{part.text}</span>
    ),
  );
}

function extractTextParts(value) {
  if (!value) return [];
  if (typeof value === "string") return linkify(value);
  const parts = [];
  walkAdf(value, parts);
  return parts.flatMap((part) => (part.url ? [part] : linkify(part.text)));
}

function walkAdf(node, parts) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((child) => walkAdf(child, parts));
    return;
  }
  if (node.type === "text" && node.text) {
    const linkMark = node.marks?.find((mark) => mark.type === "link" && mark.attrs?.href);
    parts.push({ text: node.text, url: linkMark?.attrs?.href || "" });
  }
  if (node.type === "inlineCard" && node.attrs?.url) {
    parts.push({ text: node.attrs.url, url: node.attrs.url });
  }
  if (["paragraph", "heading"].includes(node.type)) {
    parts.push({ text: " " });
  }
  walkAdf(node.content, parts);
}

function linkify(text) {
  const raw = String(text || "");
  const regex = /(https?:\/\/[^\s]+)/g;
  const parts = [];
  let lastIndex = 0;
  for (const match of raw.matchAll(regex)) {
    if (match.index > lastIndex) parts.push({ text: raw.slice(lastIndex, match.index) });
    parts.push({ text: match[0], url: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) parts.push({ text: raw.slice(lastIndex) });
  return parts;
}
