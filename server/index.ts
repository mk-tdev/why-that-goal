import { createApiServer } from './http';
import { configuredFoundry } from './foundry';
const adapter = configuredFoundry();
const server = createApiServer({ adapter });
server.requestTimeout = 30000;
server.headersTimeout = 10000;
server.listen(8791, '127.0.0.1', () =>
  console.log(
    `Evidence API: http://127.0.0.1:8791 — ${adapter ? 'Foundry configured' : 'Foundry disconnected'}`,
  ),
);
