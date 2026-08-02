import { emailLayout, escapeHtml } from './layout';

export interface ServiceAlertEmailParams {
  service: string;
  status: 'down' | 'up';
  detectedAt: Date;
}

export function renderServiceAlertEmail(params: ServiceAlertEmailParams): {
  subject: string;
  html: string;
} {
  const when = params.detectedAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  const color = params.status === 'down' ? '#dc2626' : '#16a34a';
  const headline =
    params.status === 'down'
      ? `${escapeHtml(params.service)} is not responding`
      : `${escapeHtml(params.service)} has recovered`;

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:${color};">${headline}</p>
    <p style="margin:0 0 20px;">
      ${
        params.status === 'down'
          ? `The scheduled health check could not reach <strong>${escapeHtml(params.service)}</strong> as of ${when} (UTC).`
          : `<strong>${escapeHtml(params.service)}</strong> responded normally again as of ${when} (UTC), after a prior check found it unreachable.`
      }
    </p>
    <p style="margin:0;color:#71717a;font-size:13px;">
      This is an automated alert from TempleOS's own health-check cron — sent only on a state
      change, not on every check.
    </p>
  `;

  return {
    subject: `[TempleOS] ${headline}`,
    html: emailLayout({
      preheader: headline,
      bodyHtml,
    }),
  };
}
