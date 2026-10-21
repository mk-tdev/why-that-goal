import { createApiServer } from './http';
const server = createApiServer();
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(8787, '127.0.0.1', () =>
  console.log('Evidence API: http://127.0.0.1:8787 — Foundry disconnected'),
);
