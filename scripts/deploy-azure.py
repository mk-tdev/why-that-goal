#!/usr/bin/env python3
"""Deploy an already pushed public-demo image. No visitor password or local .env required.
Prerequisites and initial scoped identity grants are documented in docs/deployment.md.
No resource deletion, registry credential or Foundry API key is used.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True, help='Full immutable image digest or unique tag already pushed to ACR')
args = parser.parse_args()
cfg = json.loads((root / 'deploy/azure.json').read_text())
if not args.image.startswith(cfg['registry'] + '/why-that-goal:') and not args.image.startswith(cfg['registry'] + '/why-that-goal@sha256:'):
    raise SystemExit('Image must be in the configured why-that-goal repository')
base = f"/subscriptions/{cfg['subscription']}/resourceGroups/{cfg['resourceGroup']}/providers"
identity = base + '/Microsoft.ManagedIdentity/userAssignedIdentities/' + cfg['identityName']
settings = {
    'NODE_ENV': 'production', 'PUBLIC_DEMO': 'true', 'AUTH_MODE': 'local',
    'APP_ORIGINS': cfg['publicOrigin'], 'AUTH_SESSION_SECONDS': '900',
    'FOUNDRY_ENABLED': 'true', 'FOUNDRY_ORCHESTRATION': 'multi-agent',
    'FOUNDRY_RESPONSES_ENDPOINT': cfg['foundryEndpoint'], 'FOUNDRY_DEPLOYMENT': cfg['foundryDeployment'],
    'AZURE_CLIENT_ID': cfg['identityClientId'], 'TRUST_AZURE_INGRESS': 'true',
}
probe = lambda kind: {'type': kind, 'httpGet': {'path': '/api/health', 'port': 8080, 'scheme': 'HTTP'}, 'periodSeconds': 10, 'timeoutSeconds': 3, 'failureThreshold': 12 if kind == 'Startup' else 3}
app = {
    'name': cfg['app'], 'type': 'Microsoft.App/containerApps', 'location': cfg['location'],
    'tags': {'project': 'why-that-goal', 'purpose': 'hackathon'},
    'identity': {'type': 'UserAssigned', 'userAssignedIdentities': {identity: {}}},
    'properties': {
        'environmentId': base + '/Microsoft.App/managedEnvironments/' + cfg['environment'],
        'workloadProfileName': 'Consumption',
        'configuration': {
            'activeRevisionsMode': 'Single',
            'secrets': [],
            'registries': [{'server': cfg['registry'], 'identity': identity}],
            'ingress': {'external': True, 'targetPort': 8080, 'transport': 'auto', 'allowInsecure': False,
                        'traffic': [{'latestRevision': True, 'weight': 100}]},
        },
        'template': {
            'containers': [{'name': 'web', 'image': args.image,
                            'resources': {'cpu': 0.25, 'memory': '0.5Gi'},
                            'env': [{'name': k, 'value': v} for k, v in settings.items()],
                            'probes': [probe(k) for k in ['Startup', 'Readiness', 'Liveness']]}],
            'scale': {'minReplicas': 0, 'maxReplicas': 1,
                      'rules': [{'name': 'http', 'http': {'metadata': {'concurrentRequests': '20'}}}]},
        },
    },
}
# Azure CLI reads JSON as YAML. The temporary manifest contains configuration, never model API keys.
with tempfile.NamedTemporaryFile(mode='w', suffix='.json', prefix='wtg-deploy-', delete=False) as file:
    os.chmod(file.name, 0o600)
    json.dump(app, file)
    manifest = file.name
try:
    subprocess.run(['az', 'containerapp', 'create', '--subscription', cfg['subscription'], '--resource-group', cfg['resourceGroup'], '--name', cfg['app'], '--yaml', manifest, '--query', '{fqdn:properties.configuration.ingress.fqdn,state:properties.provisioningState,revision:properties.latestRevisionName}', '-o', 'json'], check=True)
finally:
    Path(manifest).unlink(missing_ok=True)
