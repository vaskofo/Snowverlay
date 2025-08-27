import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverProcess;

function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', '..', 'pso_server', 'server.exe');

    console.log(`Attempting to start server from path: ${serverPath}`);

    serverProcess = spawn(serverPath, ["auto", "info"], {
      stdio: ['inherit', 'pipe', 'inherit'],
      shell: true
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Server Output: ${output}`);
      if (output.includes('Server listening on')) {
        console.log('Server is ready. Resolving promise.');
        parentPort.postMessage({ status: 'server-ready' });
        resolve(serverProcess);
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server process:', err);
      parentPort.postMessage({ status: 'server-error', error: err.message });
      reject(err);
    });

    serverProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Server process exited with code ${code} before starting.`);
        parentPort.postMessage({ status: 'server-error', error: `Server exited with code ${code}` });
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

parentPort.on('message', (message) => {
  if (message.action === 'start-server') {
    console.log('Worker thread received command to start server.');
    startServer();
  }
});
