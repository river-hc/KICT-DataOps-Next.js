import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat } from 'fs/promises';
import os from 'os';
import path from 'path';

export const dynamic = 'force-dynamic';

const DEFAULT_ROOTS = ['/data', '/mnt', os.homedir()].filter(Boolean);

function configuredRoots(): string[] {
  const raw = process.env.DATASET_BROWSE_ROOTS;
  const roots = raw
    ? raw.split(',').map(item => item.trim()).filter(Boolean)
    : DEFAULT_ROOTS;
  return Array.from(new Set(roots.map(root => path.resolve(root))));
}

function isAllowedPath(target: string, roots: string[]): boolean {
  const resolved = path.resolve(target);
  return roots.some(root => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

async function existingRoots(roots: string[]) {
  const result = [];
  for (const root of roots) {
    try {
      const info = await stat(root);
      if (info.isDirectory()) result.push(root);
    } catch {
      // Ignore roots that do not exist on this PC.
    }
  }
  return result;
}

async function isExistingDirectory(target: string): Promise<boolean> {
  try {
    const info = await stat(target);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function resolveReadablePath(
  requested: string | null,
  roots: string[],
  availableRoots: string[],
): Promise<string> {
  const fallback = availableRoots[0] || os.homedir();
  if (!requested) return fallback;

  let candidate = path.resolve(requested);
  if (!isAllowedPath(candidate, roots)) return fallback;

  while (isAllowedPath(candidate, roots)) {
    if (await isExistingDirectory(candidate)) return candidate;
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }

  return fallback;
}

export async function GET(req: NextRequest) {
  const roots = configuredRoots();
  const availableRoots = await existingRoots(roots);
  const requested = req.nextUrl.searchParams.get('path');
  const currentPath = await resolveReadablePath(requested, roots, availableRoots);

  if (!isAllowedPath(currentPath, roots)) {
    return NextResponse.json({ detail: 'Path is outside allowed dataset roots.' }, { status: 403 });
  }

  try {
    const entries = await readdir(currentPath, { withFileTypes: true });
    const folders = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => {
        const fullPath = path.join(currentPath, entry.name);
        return { name: entry.name, path: fullPath };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = path.dirname(currentPath);
    const canGoUp = parent !== currentPath && isAllowedPath(parent, roots);

    return NextResponse.json({
      currentPath,
      parentPath: canGoUp ? parent : null,
      roots: availableRoots,
      folders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to read folder.';
    return NextResponse.json({ detail: message, currentPath, roots: availableRoots, folders: [] }, { status: 500 });
  }
}
