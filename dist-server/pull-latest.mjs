// Downloads the newest successful "Build unsigned IPA" artifact into this folder,
// so the LAN server always has the latest build. Requires the GitHub CLI (`gh`)
// to be installed and authenticated.
//
//   node dist-server/pull-latest.mjs        (or: npm run serve:pull)

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const REPO = 'immmahh-sketch/ios-scanner';
const WORKFLOW = 'build-ipa.yml';
const ARTIFACT = 'scanner-unsigned-ipa';

const sh = (args) => execFileSync('gh', args, { encoding: 'utf8' }).trim();

const runId = sh([
  'run', 'list', '--repo', REPO, '--workflow', WORKFLOW,
  '--status', 'success', '--limit', '1', '--json', 'databaseId',
  '--jq', '.[0].databaseId',
]);

if (!runId) {
  console.error('No successful build run found. Trigger one:  gh workflow run "Build unsigned IPA"');
  process.exit(1);
}

for (const f of readdirSync(DIR)) {
  if (f.toLowerCase().endsWith('.ipa')) rmSync(join(DIR, f));
}

console.log(`Downloading artifact from run ${runId}…`);
sh(['run', 'download', runId, '--repo', REPO, '--name', ARTIFACT, '--dir', DIR]);

const got = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.ipa'));
console.log(got.length ? `Got: ${got.join(', ')}` : 'Download finished but no .ipa found.');
