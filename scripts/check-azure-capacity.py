#!/usr/bin/env python3
"""Read deployment capacity/availability settings; no tokens, keys or billing data exported."""
import json
from datetime import datetime, timezone
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
cfg = json.loads((root / 'deploy/azure.json').read_text())
def az(*args):
    return json.loads(subprocess.check_output(['az', *args, '--subscription', cfg['subscription'], '-o', 'json'], text=True))
subscription = az('account', 'show')
model = az('cognitiveservices', 'account', 'deployment', 'show', '-g', cfg['resourceGroup'], '-n', 'why-that-goal', '--deployment-name', cfg['foundryDeployment'])
app = az('containerapp', 'show', '-g', cfg['resourceGroup'], '-n', cfg['app'])
p = model['properties']
container = app['properties']['template']['containers'][0]
env = {v['name']: v.get('value') for v in container['env']}
report = {
    'recordedAt': datetime.now(timezone.utc).isoformat(),
    'origin': cfg['publicOrigin'], 'subscriptionState': subscription['state'],
    'deployment': {'name': model['name'], 'state': p['provisioningState'], 'deploymentState': p.get('deploymentState'), 'sku': model['sku'], 'model': p['model'], 'rateLimits': p['rateLimits']},
    'app': {'state': app['properties']['provisioningState'], 'readyRevision': app['properties']['latestReadyRevisionName'], 'scale': app['properties']['template']['scale'], 'identityType': app['identity']['type'], 'httpsOnly': not app['properties']['configuration']['ingress']['allowInsecure'], 'publicDemo': env.get('PUBLIC_DEMO') == 'true', 'foundryEnabled': env.get('FOUNDRY_ENABLED') == 'true', 'orchestration': env.get('FOUNDRY_ORCHESTRATION')},
    'scope': 'Read-only Azure control-plane inspection. Configured limits, not remaining quota, future credits/funding, load certification or an uptime guarantee. No quota increase, new identity grants or paid services provisioned.',
}
(root / 'docs/evaluations/azure-capacity.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
