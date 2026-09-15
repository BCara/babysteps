import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const endpoint = process.argv[2];
const local = process.argv.includes('--local');
if (!endpoint) throw new Error('Pass the deployed HTTPS /mcp URL, or a loopback URL with --local for a development package.');
const url = new URL(endpoint);
if (url.username || url.password || url.search || url.hash || url.pathname !== '/mcp'
  || (url.protocol !== 'https:' && !(local && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))) {
  throw new Error('Use an HTTPS /mcp URL without credentials, query or fragment.');
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const destination = path.join(root, 'artifacts', `${local ? 'development' : 'release'}-${stamp}`, 'pitterpatter');
await mkdir(destination, { recursive: true });
await cp(path.join(root, 'plugins', 'pitterpatter'), destination, { recursive: true });
const openaiPath = path.join(destination, '.codex-plugin', 'plugin.json');
const manifest = JSON.parse(await readFile(openaiPath, 'utf8'));
const server = { type: 'http', url: url.href };
manifest.mcpServers = { pitterpatter: server };
await writeFile(openaiPath, JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(destination, '.mcp.json'), JSON.stringify({ mcpServers: { pitterpatter: server } }, null, 2) + '\n');
await writeFile(path.join(destination, 'CONNECTION.md'), `# Connect PitterPatter\n\nMCP URL: ${url.href}\n\n${local ? 'Development build: this loopback address is not reachable by hosted ChatGPT or Claude.' : 'Use this URL in ChatGPT or Claude, then sign in to PitterPatter and approve access. Packaging does not deploy the server or publish a directory listing.'}\n`);
// Python's standard ZIP writer includes hidden manifest directories on Windows.
const archive = `${destination}.zip`;
execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c',
  'import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root)) for p in root.rglob("*") if p.is_file()]; z.close()', destination, archive]);
console.log(JSON.stringify({ directory: destination, archive, endpoint: url.href, development: local }, null, 2));
