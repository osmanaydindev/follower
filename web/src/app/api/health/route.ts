// What the compose healthcheck polls. Deliberately does not touch the Go backend:
// this answers "is the web process serving?", nothing more. A backend outage is
// reported in the UI, it must not stop the container from being considered up.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
