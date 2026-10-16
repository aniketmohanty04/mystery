#!/usr/bin/env node
/**
 * Build a clean release archive from the COMMITTED files (git archive).
 *
 * Why the guards: `git archive HEAD` silently ignores uncommitted edits and
 * untracked files, so a stale or incomplete ZIP could be submitted by mistake.
 * This script refuses to run unless the working tree is clean, and it never
 * touches an existing archive until the new one has been written successfully.
 *
 * Excluded automatically (git-ignored): node_modules/, dist/, *.zip.
 */
import { execFileSync } from 'node:child_process';
import { renameSync, rmSync, statSync } from 'node:fs';

const OUTPUT = 'mystery-box-phase2.zip';
const TEMP = `${OUTPUT}.tmp`;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function fail(message) {
  console.error(`package: ${message}`);
  process.exit(1);
}

try {
  git('rev-parse', '--is-inside-work-tree');
} catch {
  fail('not a git repository (or git is not installed). Run "git init", commit your files, then retry.');
}

try {
  git('rev-parse', '--verify', 'HEAD');
} catch {
  fail('the repository has no commits yet. Commit your files, then retry.');
}

const dirty = git('status', '--porcelain');
if (dirty) {
  fail(
    'uncommitted or untracked changes would be missing from the archive:\n' +
      dirty.split('\n').map(line => `  ${line}`).join('\n') +
      '\nCommit (or stash) them, then retry.',
  );
}

try {
  git('archive', '--format=zip', '-o', TEMP, 'HEAD');
  renameSync(TEMP, OUTPUT);
} catch (error) {
  rmSync(TEMP, { force: true });
  fail(`git archive failed: ${error instanceof Error ? error.message : error}`);
}

const kib = (statSync(OUTPUT).size / 1024).toFixed(1);
console.log(`package: wrote ${OUTPUT} (${kib} KiB) from commit ${git('rev-parse', '--short', 'HEAD')}`);
