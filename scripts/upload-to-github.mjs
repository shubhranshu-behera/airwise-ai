import fs from 'fs';
import path from 'path';
import readline from 'readline';

const repoName = 'airwise-ai';
const repoDescription = 'AIRWISE AI - Agentic Urban Air Quality & Smart City Environmental Intelligence Platform';

async function promptToken() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question('Paste your GitHub Personal Access Token (classic with repo scope or fine-grained): ', (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  const ignoredDirs = new Set(['node_modules', 'dist', '.airwise-data', '.git']);
  const ignoredFiles = new Set(['.env', '.env.local']);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');

    if (fs.statSync(fullPath).isDirectory()) {
      if (!ignoredDirs.has(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      if (!ignoredFiles.has(file) && !file.endsWith('.log')) {
        arrayOfFiles.push({ fullPath, relPath });
      }
    }
  }

  return arrayOfFiles;
}

async function main() {
  let token = process.argv[2] || process.env.GITHUB_TOKEN;
  if (!token) {
    token = await promptToken();
  }

  if (!token) {
    console.error('[ERROR] No GitHub token provided. Exiting.');
    process.exit(1);
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AirWise-AI-Uploader',
  };

  console.log('\n[1/5] Verifying GitHub user credentials...');
  const userRes = await fetch('https://api.github.com/user', { headers });
  if (!userRes.ok) {
    const errText = await userRes.text();
    console.error(`[ERROR] Authentication failed (${userRes.status}):`, errText);
    process.exit(1);
  }
  const user = await userRes.json();
  const owner = user.login;
  console.log(`✓ Authenticated as: ${owner} (${user.name || owner})`);

  console.log(`\n[2/5] Checking repository '${owner}/${repoName}'...`);
  let repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
  if (repoRes.status === 404) {
    console.log(`Creating new public repository '${repoName}'...`);
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: repoName,
        description: repoDescription,
        private: false,
        auto_init: false,
      }),
    });
    if (!createRes.ok) {
      console.error('[ERROR] Failed to create repository:', await createRes.text());
      process.exit(1);
    }
    console.log(`✓ Created repository: https://github.com/${owner}/${repoName}`);
  } else if (repoRes.ok) {
    console.log(`✓ Repository '${owner}/${repoName}' already exists.`);
  }

  // Ensure repository is initialized with at least one commit so Git Database API can create blobs/trees
  const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
  const repoInfo = await repoInfoRes.json();
  const defaultBranch = repoInfo.default_branch || 'main';

  const commitsRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/commits`, { headers });
  const commitsData = await commitsRes.json();
  if (!commitsRes.ok || !Array.isArray(commitsData) || commitsData.length === 0) {
    console.log('Initializing repository with README.md...');
    const readmeContent = fs.existsSync('README.md') ? fs.readFileSync('README.md', 'utf-8') : '# AirWise AI';
    const initRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents/README.md`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Initial commit: README.md',
        content: Buffer.from(readmeContent).toString('base64'),
      }),
    });
    if (!initRes.ok) {
      console.error('[ERROR] Failed to initialize repo:', await initRes.text());
      process.exit(1);
    }
    console.log('✓ Initialized repository with README.md.');
  }

  console.log('\n[3/5] Scanning and preparing project files...');
  const files = getAllFiles(process.cwd());
  console.log(`Found ${files.length} files to upload.`);

  console.log('\n[4/5] Uploading file blobs to GitHub...');
  const treeItems = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const contentBuffer = fs.readFileSync(file.fullPath);
    const isBinary = contentBuffer.some((byte) => byte === 0);
    const content = isBinary ? contentBuffer.toString('base64') : contentBuffer.toString('utf8');
    const encoding = isBinary ? 'base64' : 'utf-8';

    process.stdout.write(`  [${i + 1}/${files.length}] Uploading ${file.relPath} ... `);

    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, encoding }),
    });

    if (!blobRes.ok) {
      console.log('FAILED!');
      console.error(await blobRes.text());
      process.exit(1);
    }

    const blobData = await blobRes.json();
    treeItems.push({
      path: file.relPath,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
    console.log('done.');
  }

  console.log('\n[5/5] Creating Git tree and commit on main branch...');
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tree: treeItems }),
  });
  if (!treeRes.ok) {
    console.error('[ERROR] Failed to create tree:', await treeRes.text());
    process.exit(1);
  }
  const treeData = await treeRes.json();

  // Get current parent commit if ref exists
  let parentCommitSha = null;
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${defaultBranch}`, { headers });
  if (refRes.ok) {
    const refData = await refRes.json();
    parentCommitSha = refData.object.sha;
  }

  const commitPayload = {
    message: 'Initial release: AirWise AI Urban Environmental Intelligence Platform',
    tree: treeData.sha,
    parents: parentCommitSha ? [parentCommitSha] : [],
  };

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(commitPayload),
  });
  if (!commitRes.ok) {
    console.error('[ERROR] Failed to create commit:', await commitRes.text());
    process.exit(1);
  }
  const commitData = await commitRes.json();

  // Update or create ref
  if (parentCommitSha) {
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${defaultBranch}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commitData.sha, force: true }),
    });
  } else {
    await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: `refs/heads/${defaultBranch}`, sha: commitData.sha }),
    });
  }

  console.log('\n=============================================================');
  console.log('  SUCCESS! Project pushed to GitHub successfully!');
  console.log(`  Repository URL: https://github.com/${owner}/${repoName}`);
  console.log('=============================================================\n');
}

main().catch((err) => {
  console.error('[FATAL ERROR]:', err);
});
