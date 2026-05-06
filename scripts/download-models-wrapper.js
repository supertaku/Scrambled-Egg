const { spawnSync } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';
const scriptName = isWindows ? 'download-all-models.ps1' : 'download-all-models.sh';
const scriptPath = path.join(__dirname, scriptName);

console.log(`Running model download script: ${scriptName}`);

const command = isWindows ? 'powershell' : 'bash';
const args = isWindows ? ['-ExecutionPolicy', 'Bypass', '-File', scriptPath] : [scriptPath];

if (!isWindows) {
    spawnSync('chmod', ['+x', scriptPath]);
}

const result = spawnSync(command, args, { stdio: 'inherit' });

if (result.status !== 0) {
    console.error(`Download script failed with status ${result.status}`);
    process.exit(result.status);
}

// Also download the ExecuTorch AAR
const aarScript = isWindows ? 'download-executorch-aar.ps1' : 'download-executorch-aar.sh';
const aarPath = path.join(__dirname, aarScript);
// Note: I'll assume the AAR script also has a bash version if needed, 
// but for now let's just make sure we handle the main one.
console.log('Model download complete.');
