import { createApiServer } from './http';
import { configuredFoundry } from './foundry';
import { configuredSecurity } from './security';
import { Operations } from './operations';
const shutdown = new AbortController();
const adapter = configuredFoundry();
const server = createApiServer({
  adapter,
  staticDirectory: process.env.STATIC_DIRECTORY,
  trustAzureIngress: process.env.TRUST_AZURE_INGRESS === 'true',
  auth: configuredSecurity(),
  operations: new Operations(),
  shutdownSignal: shutdown.signal,
  ...(process.env.APP_ORIGINS
    ? { origins: process.env.APP_ORIGINS.split(',').map((v) => v.trim()) }
    : {}),
});
server.requestTimeout = 30000;
server.headersTimeout = 10000;
const port = Number(process.env.PORT ?? 8791);
server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
  console.log(
    `Evidence API: http://localhost:${port} — ${adapter ? 'Foundry configured' : 'Foundry disconnected'}`,
  ),
);

process.once('SIGTERM', () => {
  shutdown.abort();
  server.close();
  const timer = setTimeout(() => server.closeAllConnections(), 10000);
  timer.unref();
});
