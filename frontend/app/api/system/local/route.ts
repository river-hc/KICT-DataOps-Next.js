// 로컬 시스템 상태 API — 프론트엔드 서버가 실행 중인 머신(현재 PC) 기준
// next.config.js의 /api/* 백엔드 프록시(afterFiles rewrite)보다 앱 라우트가 우선 매칭됨

import { NextResponse } from 'next/server';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { statfs, readFile } from 'fs/promises';

export const dynamic = 'force-dynamic';

const exec = promisify(execFile);

// ─── GPU (nvidia-smi) ─────────────────────────────────────────────────────────

async function getGpus() {
  try {
    const { stdout } = await exec(
      'nvidia-smi',
      [
        '--query-gpu=index,name,utilization.gpu,memory.used,memory.total,memory.free,temperature.gpu',
        '--format=csv,noheader,nounits',
      ],
      { timeout: 3000 },
    );
    const gpus = stdout.trim().split('\n').filter(Boolean).map(line => {
      const [id, name, util, used, total, free, temp] = line.split(',').map(s => s.trim());
      return {
        id: Number(id),
        name,
        utilization: Number(util),
        memory_used: Number(used),
        memory_total: Number(total),
        memory_free: Number(free),
        temperature: Number.isNaN(Number(temp)) ? null : Number(temp),
      };
    });
    return { available: true, gpu_count: gpus.length, gpus, error: null };
  } catch {
    return { available: false, gpu_count: 0, gpus: [], error: 'nvidia-smi not found' };
  }
}

// ─── CPU 사용률 — os.cpus() 누적값을 200ms 간격 2회 샘플링해 차이로 계산 ─────

function cpuTimes() {
  let idle = 0, total = 0;
  for (const c of os.cpus()) {
    idle  += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total };
}

async function getCpuPercent(): Promise<number> {
  const a = cpuTimes();
  await new Promise(r => setTimeout(r, 200));
  const b = cpuTimes();
  const dTotal = b.total - a.total;
  const dIdle  = b.idle  - a.idle;
  return dTotal > 0 ? Math.round((1 - dIdle / dTotal) * 100) : 0;
}

// ─── RAM — Linux는 MemAvailable 기준 (os.freemem()은 캐시를 사용 중으로 집계) ─

async function getRam() {
  const totalMb = Math.round(os.totalmem() / 1024 ** 2);
  try {
    const meminfo = await readFile('/proc/meminfo', 'utf8');
    const avail = meminfo.match(/MemAvailable:\s+(\d+)\s*kB/);
    if (avail) {
      const availMb = Math.round(Number(avail[1]) / 1024);
      return { used_mb: totalMb - availMb, total_mb: totalMb };
    }
  } catch { /* 비 Linux 환경 폴백 */ }
  return { used_mb: Math.round((os.totalmem() - os.freemem()) / 1024 ** 2), total_mb: totalMb };
}

// ─── Disk ─────────────────────────────────────────────────────────────────────

async function getDisk() {
  try {
    const s = await statfs('/');
    const totalGb = (s.blocks * s.bsize) / 1024 ** 3;
    const freeGb  = (s.bavail * s.bsize) / 1024 ** 3;
    return {
      used_gb:  Number((totalGb - freeGb).toFixed(1)),
      total_gb: Number(totalGb.toFixed(1)),
    };
  } catch {
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const [gpu, cpuPercent, ram, disk] = await Promise.all([
    getGpus(),
    getCpuPercent(),
    getRam(),
    getDisk(),
  ]);

  return NextResponse.json({
    host: os.hostname(),
    gpu,
    cpu: {
      percent:  cpuPercent,
      cores:    os.cpus().length,
      model:    os.cpus()[0]?.model ?? null,
      load_avg: os.loadavg().map(v => Number(v.toFixed(2))),
    },
    ram,
    disk,
    os: {
      platform:       os.platform(),
      release:        os.release(),
      uptime_seconds: Math.round(os.uptime()),
      node:           process.version,
    },
  });
}
