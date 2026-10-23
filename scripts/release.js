#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createZipArchive } = require('./zip-util');

function run(cmd, options = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...options });
}

function runOutput(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  process.chdir(rootDir);

  // 1. Check gh CLI
  try {
    execSync('gh --version', { stdio: 'ignore' });
  } catch (e) {
    console.error('❌ GitHub CLI(gh)가 설치되어 있지 않거나 경로에 없습니다.');
    console.error('👉 https://cli.github.com 에서 gh를 설치하고 gh auth login을 진행해주세요.');
    process.exit(1);
  }

  // 2. Read package.json
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const arg = process.argv[2];
  let version = pkg.version;

  if (arg === 'patch' || arg === 'minor' || arg === 'major') {
    const parts = version.split('.').map(Number);
    if (arg === 'major') { parts[0]++; parts[1] = 0; parts[2] = 0; }
    else if (arg === 'minor') { parts[1]++; parts[2] = 0; }
    else if (arg === 'patch') { parts[2]++; }
    version = parts.join('.');
  } else if (arg && /^\d+\.\d+\.\d+$/.test(arg)) {
    version = arg;
  }

  const tag = `v${version}`;
  console.log(`\n🚀 데스크톱 메모 ${tag} 릴리즈 시작...\n`);

  // 3. Update files if version changed
  if (version !== pkg.version) {
    console.log(`📦 버전 변경: ${pkg.version} -> ${version}`);
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // Update index.html badge
    const htmlPath = path.join(rootDir, 'public', 'index.html');
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html.replace(/id="appVersionBadge">v[^<]+</, `id="appVersionBadge">${tag}<`);
      fs.writeFileSync(htmlPath, html, 'utf8');
    }

    // Update README badge
    const readmePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      let readme = fs.readFileSync(readmePath, 'utf8');
      readme = readme.replace(/badge\/version-v[^-\s]+-blue/, `badge/version-${tag}-blue`);
      fs.writeFileSync(readmePath, readme, 'utf8');
    }
  }

  // Commit any pending changes before tagging
  const status = runOutput('git status --porcelain');
  if (status) {
    console.log('📝 변경 사항 자동 커밋 및 푸시 중...');
    run('git add -A');
    run(`git commit -m "chore: release ${tag}"`);
    run('git push origin main');
  }

  // 4. Create Git Tag if not exists
  const existingTags = runOutput('git tag -l').split(/\r?\n/);
  if (!existingTags.includes(tag)) {
    console.log(`🏷️ Git 태그 생성: ${tag}`);
    run(`git tag -a "${tag}" -m "Release ${tag}"`);
    run(`git push origin "${tag}"`);
  } else {
    console.log(`ℹ️ Git 태그 ${tag} 이미 존재함`);
  }

  // 5. Create Zip package
  const zipName = `desktop-memo-${tag}.zip`;
  const zipPath = path.join(rootDir, zipName);
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  console.log(`📦 UTF-8 호환 릴리즈 압축 파일 생성 중: ${zipName}`);
  try {
    const zipSize = createZipArchive(rootDir, zipPath);
    console.log(`✅ 압축 파일 생성 완료 (${(zipSize / 1024).toFixed(1)} KB)`);
  } catch (e) {
    console.error('❌ 압축 파일 생성 실패:', e);
  }

  // 6. Create or update GitHub Release
  console.log(`🌐 GitHub 릴리즈 등록 중 (${tag})...`);
  const zipArg = fs.existsSync(zipPath) ? `"${zipPath}"` : '';

  try {
    // Check if release exists
    const releaseList = runOutput('gh release list');
    const releaseExists = releaseList.includes(tag);

    if (releaseExists) {
      console.log(`🔄 기존 릴리즈 업데이트 중: ${tag}`);
      if (zipArg) {
        run(`gh release upload "${tag}" ${zipArg} --clobber`);
      }
    } else {
      run(`gh release create "${tag}" ${zipArg} --title "${tag}: 데스크톱 메모 업데이트" --generate-notes`);
    }
    console.log(`\n🎉 ${tag} 릴리즈가 성공적으로 GitHub에 반영되었습니다!`);
    console.log(`🔗 https://github.com/askum/memo/releases/tag/${tag}\n`);
  } finally {
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
  }
}

main();
