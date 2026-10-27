import { execFile } from 'node:child_process';
import { mkdtemp, readdir, lstat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const assets = ['.nojekyll', 'index.html', 'app.js', 'engine.js', 'pitch-model.js', 'playback.js', 'stadium.js', 'career-ui.js', 'career.css', 'style.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

/** Publish only the built static files, without changing the checkout or its index. */
export async function publishPages({ root = projectRoot, dryRun = false } = {}) {
  const output = path.join(root, '_site');
  const actual = (await readdir(output)).sort();
  const expected = [...assets].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('The _site directory does not match the website asset list. Run npm run build:site and remove unexpected files before publishing.');
  }
  for (const name of assets) {
    if (!(await lstat(path.join(output, name))).isFile()) throw new Error(`Website asset must be a regular file: ${name}`);
  }
  const temporary = await mkdtemp(path.join(tmpdir(), 'pixel-dugout-pages-'));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(temporary, 'index') };
  const git = async (...args) => {
    try {
      const { stdout } = await exec('git', args, { cwd: root, env });
      return stdout.trim();
    } catch (error) {
      // Git can include remote URLs in its diagnostics; never echo embedded user info.
      const diagnostic = (error.stderr || error.message || 'Unknown Git error').replace(/(https?:\/\/)[^\s/@]+(?::[^\s/@]*)?@/g, '$1[redacted]@');
      throw new Error(`Git ${args[0]} failed: ${diagnostic.trim()}`);
    }
  };
  try {
    await git('fetch', '--no-tags', 'origin', 'refs/heads/gh-pages');
    const parent = await git('rev-parse', '--verify', 'FETCH_HEAD^{commit}');
    await git('read-tree', '--empty');
    for (const name of assets) {
      const sha = await git('hash-object', '-w', '--', path.join(output, name));
      await git('update-index', '--add', '--cacheinfo', `100644,${sha},${name}`);
    }
    const tree = await git('write-tree');
    const previousTree = await git('rev-parse', `${parent}^{tree}`);
    if (tree === previousTree) return { published: false, unchanged: true, commit: parent };
    if (dryRun) return { published: false, unchanged: false, dryRun: true, tree, parent };
    const commit = await git('commit-tree', tree, '-p', parent, '-m', 'Publish Pixel Dugout website');
    // A concurrent publisher causes a normal non-fast-forward rejection; never force.
    await git('push', 'origin', `${commit}:refs/heads/gh-pages`);
    return { published: true, unchanged: false, commit };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const extra = process.argv.slice(2);
  if (extra.some(arg => arg !== '--dry-run')) {
    console.error('Usage: node scripts/publish-pages.mjs [--dry-run]');
    process.exitCode = 1;
  } else {
    try {
      const result = await publishPages({ dryRun: extra.includes('--dry-run') });
      console.log(result.unchanged ? `Website is unchanged (${result.commit}).` : result.dryRun ? 'Website is ready to publish; dry run made no remote changes.' : `Published website commit ${result.commit} to gh-pages. GitHub Pages will deploy it automatically.`);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
