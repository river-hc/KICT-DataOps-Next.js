'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AscHeader {
  ncols: number;
  nrows: number;
  xllcorner: number;
  yllcorner: number;
  cellsize: number;
  nodata: number;
}

export interface AscGrid {
  header: AscHeader;
  data: Float32Array;
}

// ─── ASC 파서 ─────────────────────────────────────────────────────────────────

export function renderToCanvas(canvas: HTMLCanvasElement, grid: AscGrid) {
  const { ncols, nrows, nodata } = grid.header;
  canvas.width  = ncols;
  canvas.height = nrows;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(ncols, nrows);
  const px  = img.data;
  for (let i = 0; i < grid.data.length; i++) {
    const [r, g, b, a] = precipToRgba(grid.data[i], nodata);
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

export function generateMockGrid(step: number): AscGrid {
  return _generateMockGrid(step);
}

export function parseAsc(text: string): AscGrid {
  const lines = text.trim().split(/\r?\n/);
  const raw: Record<string, number> = {};
  let dataStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length === 2 && isNaN(Number(parts[0].charAt(0)))) {
      raw[parts[0].toLowerCase()] = parseFloat(parts[1]);
      dataStart = i + 1;
    } else {
      break;
    }
  }

  const ncols = raw['ncols'] ?? 0;
  const nrows = raw['nrows'] ?? 0;
  const nodata = raw['nodata_value'] ?? -9999;
  const data = new Float32Array(ncols * nrows);
  let idx = 0;

  for (let i = dataStart; i < lines.length; i++) {
    for (const p of lines[i].trim().split(/\s+/)) {
      if (p && idx < data.length) data[idx++] = parseFloat(p);
    }
  }

  return {
    header: {
      ncols, nrows, nodata,
      xllcorner: raw['xllcorner'] ?? raw['xllcenter'] ?? 0,
      yllcorner: raw['yllcorner'] ?? raw['yllcenter'] ?? 0,
      cellsize:  raw['cellsize'] ?? 1,
    },
    data,
  };
}

// ─── 모의 격자 생성 ───────────────────────────────────────────────────────────

function _generateMockGrid(step: number): AscGrid {
  const ncols = 120;
  const nrows = 120;
  const t = step / 180;
  const data = new Float32Array(ncols * nrows);

  const cx1 = ncols * (0.28 + t * 0.28);
  const cy1 = nrows * (0.48 + t * 0.06);
  const r1  = 16 - t * 4;
  const i1  = 6.5 - t * 2.2;   // 0–10mm 범위에 맞게 조정

  const cx2 = ncols * (0.52 + t * 0.12);
  const cy2 = nrows * (0.62 - t * 0.08);
  const r2  = 9 + t * 3;
  const i2  = 2.0 + t * 1.5;

  const cx3 = ncols * 0.68;
  const cy3 = nrows * 0.32;
  const r3  = 22;
  const i3  = 0.6 + t * 0.4;

  for (let row = 0; row < nrows; row++) {
    for (let col = 0; col < ncols; col++) {
      const d1  = Math.hypot(col - cx1, row - cy1);
      const d2  = Math.hypot(col - cx2, row - cy2);
      const d3  = Math.hypot(col - cx3, row - cy3);
      const val =
        i1 * Math.exp(-(d1 * d1) / (2 * r1 * r1)) +
        i2 * Math.exp(-(d2 * d2) / (2 * r2 * r2)) +
        i3 * Math.exp(-(d3 * d3) / (2 * r3 * r3));
      data[row * ncols + col] = val < 0.1 ? 0 : Math.round(val * 10) / 10;
    }
  }

  return {
    header: { ncols, nrows, xllcorner: 124.5, yllcorner: 33.0, cellsize: 0.05, nodata: -9999 },
    data,
  };
}

// ─── 컬러맵 (0–10mm 실제 QPF 범위) ───────────────────────────────────────────

function precipToRgba(val: number, nodata: number): readonly [number, number, number, number] {
  if (val === nodata || val < 0.1) return [0, 0, 0, 0];
  if (val <  0.5) return [200, 235, 255, 180];  // 극희박 (매우 연한 하늘)
  if (val <  1.0) return [120, 190, 255, 210];  // 약한 (연한 파랑)
  if (val <  2.0) return [ 50, 130, 240, 230];  // 보통 (파랑)
  if (val <  3.0) return [  0,  70, 200, 240];  // 조금 강함 (진파랑)
  if (val <  5.0) return [  0, 160, 100, 245];  // 중간 (청록)
  if (val <  7.0) return [ 80, 210,  40, 245];  // 강함 (연두)
  if (val < 10.0) return [240, 220,   0, 250];  // 꽤 강함 (노랑)
  if (val < 20.0) return [255, 130,   0, 250];  // 강한 (오렌지)
  if (val < 50.0) return [240,  30,   0, 255];  // 매우 강한 (빨강)
  return                 [180,   0, 180, 255];  // 극강 (보라)
}

const COLORBAR: { label: string; color: string }[] = [
  { label: '0',   color: 'rgba(200,235,255,0.7)' },
  { label: '0.5', color: 'rgb(120,190,255)' },
  { label: '1',   color: 'rgb(50,130,240)' },
  { label: '2',   color: 'rgb(0,70,200)' },
  { label: '3',   color: 'rgb(0,160,100)' },
  { label: '5',   color: 'rgb(80,210,40)' },
  { label: '7',   color: 'rgb(240,220,0)' },
  { label: '10',  color: 'rgb(255,130,0)' },
  { label: '20',  color: 'rgb(240,30,0)' },
  { label: '50+', color: 'rgb(180,0,180)' },
];

// ─── 한반도 지형 오버레이 ──────────────────────────────────────────────────────

function geoToPixel(lat: number, lon: number, h: AscHeader): [number, number] {
  const col = (lon - h.xllcorner) / h.cellsize;
  const row = h.nrows - 1 - (lat - h.yllcorner) / h.cellsize;
  return [col, row];
}

// 한반도 해안선 좌표 [위도, 경도] — 시계방향
const KOREA_MAINLAND: [number, number][] = [
  // 북한 북서부 (그리드 상단 → 남하)
  [39.0, 124.9], [38.8, 125.1], [38.5, 125.2], [38.2, 125.5],
  [38.0, 125.9],
  // 서해안 (남하)
  [37.9, 126.6], [37.6, 126.5], [37.3, 126.3], [36.9, 126.4],
  [36.5, 126.5], [36.1, 126.4], [35.7, 126.4], [35.3, 126.1],
  [35.0, 126.3], [34.7, 126.5],
  // 남해안 (동진)
  [34.4, 126.9], [34.3, 127.2], [34.3, 127.5], [34.4, 127.8],
  [34.6, 128.0], [34.8, 128.3], [34.7, 128.7],
  // 동해안 (북상)
  [35.1, 129.0], [35.5, 129.4], [36.0, 129.5], [36.5, 129.5],
  [37.0, 129.4], [37.5, 129.1], [37.9, 128.8],
  // 비무장지대 동쪽 → 북한 동해안
  [38.2, 128.5], [38.6, 128.2], [38.9, 127.4], [39.0, 127.4],
];

const JEJU_ISLAND: [number, number][] = [
  [33.5, 126.3], [33.3, 126.6], [33.2, 127.0],
  [33.3, 127.5], [33.5, 127.7], [33.6, 127.3],
  [33.6, 126.8], [33.5, 126.3],
];

function KoreaOverlay({ header }: { header: AscHeader }) {
  const { ncols, nrows, xllcorner, yllcorner, cellsize } = header;
  // 격자가 도(degree) 단위가 아니면 오버레이 불가
  if (cellsize >= 1) return null;

  const xmax = xllcorner + ncols * cellsize;
  const ymax = yllcorner + nrows * cellsize;

  const tp = (lat: number, lon: number) => {
    const [c, r] = geoToPixel(lat, lon, header);
    return `${c.toFixed(2)},${r.toFixed(2)}`;
  };

  // 위도·경도 격자선 (1° 간격)
  const latLines: number[] = [];
  for (let lat = Math.ceil(yllcorner); lat <= Math.floor(ymax); lat++) latLines.push(lat);
  const lonLines: number[] = [];
  for (let lon = Math.ceil(xllcorner); lon <= Math.floor(xmax); lon++) lonLines.push(lon);

  const mainPts = KOREA_MAINLAND.map(([la, lo]) => tp(la, lo)).join(' ');
  const jejuPts = JEJU_ISLAND.map(([la, lo]) => tp(la, lo)).join(' ');

  return (
    <>
      {/* 위도 격자선 */}
      {latLines.map(lat => {
        const [, row] = geoToPixel(lat, xllcorner, header);
        return (
          <g key={`lat${lat}`}>
            <line x1={0} y1={row} x2={ncols} y2={row}
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.35} strokeDasharray="1.5,2" />
            <text x={1.5} y={row - 0.8} fill="rgba(255,255,255,0.45)"
              fontSize={3.5} fontFamily="monospace">{lat}°N</text>
          </g>
        );
      })}

      {/* 경도 격자선 */}
      {lonLines.map(lon => {
        const [col] = geoToPixel(yllcorner, lon, header);
        return (
          <g key={`lon${lon}`}>
            <line x1={col} y1={0} x2={col} y2={nrows}
              stroke="rgba(255,255,255,0.18)" strokeWidth={0.35} strokeDasharray="1.5,2" />
            <text x={col + 0.8} y={nrows - 1.5} fill="rgba(255,255,255,0.45)"
              fontSize={3.5} fontFamily="monospace">{lon}°E</text>
          </g>
        );
      })}

      {/* 한반도 본토 해안선 */}
      <polyline points={mainPts}
        fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={0.7}
        strokeLinejoin="round" strokeLinecap="round" />

      {/* 제주도 */}
      <polygon points={jejuPts}
        fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={0.55} />
    </>
  );
}

// ─── 통계 ────────────────────────────────────────────────────────────────────

function calcStats(grid: AscGrid) {
  const { nodata } = grid.header;
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  for (let i = 0; i < grid.data.length; i++) {
    const v = grid.data[i];
    if (v === nodata || v < 0.1) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    count++;
  }
  return {
    min:  count ? min.toFixed(1) : '0.0',
    max:  count ? max.toFixed(1) : '0.0',
    mean: count ? (sum / count).toFixed(1) : '0.0',
    coverage: ((count / grid.data.length) * 100).toFixed(1),
  };
}

// ─── AscViewer ────────────────────────────────────────────────────────────────

interface AscViewerProps {
  steps: number[];
  ascTexts?: Record<number, string>;  // 이미 로드된 ASC 텍스트
  ascUrls?:  Record<number, string>;  // URL 기반 지연 로딩
}

export default function AscViewer({ steps, ascTexts, ascUrls }: AscViewerProps) {
  const [frameIdx,   setFrameIdx]   = useState(0);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [intervalMs, setIntervalMs] = useState(900);
  const [fetchVer,   setFetchVer]   = useState(0);  // 데이터 로드 시 리렌더 트리거

  const fetchedRef  = useRef<Record<number, string>>({});   // 로드된 텍스트 캐시
  const fetchingRef = useRef<Set<number>>(new Set());       // 진행 중인 요청 추적
  const canvasRef   = useRef<HTMLCanvasElement>(null);

  // 단일 스텝 URL 로딩
  const fetchStep = useCallback(async (step: number) => {
    const url = ascUrls?.[step];
    if (!url) return;
    if (fetchedRef.current[step] !== undefined) return;
    if (fetchingRef.current.has(step)) return;

    fetchingRef.current.add(step);
    try {
      const text = await fetch(url).then(r => r.text());
      fetchedRef.current[step] = text;
      setFetchVer(v => v + 1);
    } catch {
      fetchedRef.current[step] = '';  // 실패 마킹
      setFetchVer(v => v + 1);
    } finally {
      fetchingRef.current.delete(step);
    }
  }, [ascUrls]);

  // 현재 프레임 로드 + 다음 프레임 프리페치
  useEffect(() => {
    if (!ascUrls) return;
    fetchStep(steps[frameIdx]);
    fetchStep(steps[(frameIdx + 1) % steps.length]);
  }, [frameIdx, steps, ascUrls, fetchStep]);

  // 격자 데이터 계산
  const grids = useMemo<(AscGrid | null)[]>(() => {
    return steps.map(step => {
      const src = ascTexts?.[step] ?? fetchedRef.current[step];
      if (src !== undefined) return src.length > 0 ? parseAsc(src) : _generateMockGrid(step);
      if (!ascUrls) return _generateMockGrid(step);
      return null;  // URL 있지만 아직 미로드
    });
    // fetchVer 가 바뀔 때마다 재계산
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, ascTexts, ascUrls, fetchVer]);

  // 캔버스 렌더링
  useEffect(() => {
    const grid = grids[frameIdx];
    if (canvasRef.current && grid) {
      renderToCanvas(canvasRef.current, grid);
    }
  }, [frameIdx, grids]);

  // 자동 재생
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(
      () => setFrameIdx(prev => (prev + 1) % steps.length),
      intervalMs
    );
    return () => clearInterval(id);
  }, [isPlaying, intervalMs, steps.length]);

  const goPrev = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i - 1 + steps.length) % steps.length);
  }, [steps.length]);

  const goNext = useCallback(() => {
    setIsPlaying(false);
    setFrameIdx(i => (i + 1) % steps.length);
  }, [steps.length]);

  if (!steps.length) return null;

  const curStep   = steps[frameIdx];
  const curGrid   = grids[frameIdx];
  const isLoading = curGrid === null;
  const isMock    = (!ascUrls && !ascTexts?.[curStep]) ||
                    (ascUrls != null && fetchedRef.current[curStep] === '');
  const stats     = curGrid ? calcStats(curGrid) : null;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          QPF 예측 슬라이드 (ASC)
        </p>
        {isMock && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            모의 데이터
          </span>
        )}
      </div>

      {/* 캔버스 영역 */}
      <div className="relative bg-gray-950 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={525}
          height={625}
          className="w-full"
          style={{ imageRendering: 'pixelated', display: 'block', height: 'auto' }}
        />

        {/* 한반도 지형 + 격자 오버레이 */}
        {curGrid && (
          <svg
            viewBox={`0 0 ${curGrid.header.ncols} ${curGrid.header.nrows}`}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
            preserveAspectRatio="none"
          >
            <KoreaOverlay header={curGrid.header} />
          </svg>
        )}

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80">
            <div className="flex flex-col items-center gap-2">
              <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <p className="text-xs text-gray-300">T+{curStep}분 로딩 중...</p>
            </div>
          </div>
        )}

        {/* 선행시간 레이블 */}
        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white text-sm font-bold px-3 py-1 rounded-lg">
          T+{curStep}분
        </div>

        {/* 프레임 번호 */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg">
          {frameIdx + 1} / {steps.length}
        </div>

        {/* 통계 오버레이 */}
        {stats && (
          <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg space-y-0.5">
            <div>최대 <span className="font-bold text-orange-300 ml-1">{stats.max} mm</span></div>
            <div>평균 <span className="font-medium text-yellow-200 ml-1">{stats.mean} mm</span></div>
            <div>강수 면적 <span className="font-medium text-blue-300 ml-1">{stats.coverage}%</span></div>
          </div>
        )}
      </div>

      {/* 컨트롤 바 */}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={goPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition text-xs font-bold"
        >
          ◀
        </button>
        <button
          onClick={() => setIsPlaying(p => !p)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition text-sm ${
            isPlaying
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={goNext}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition text-xs font-bold"
        >
          ▶
        </button>

        <div className="flex items-center gap-2 ml-auto text-xs text-gray-400">
          <span>느림</span>
          <input
            type="range" min={200} max={2000} step={100}
            value={2200 - intervalMs}
            onChange={e => setIntervalMs(2200 - Number(e.target.value))}
            className="w-20 accent-blue-600"
          />
          <span>빠름</span>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {steps.map((step, i) => (
          <button
            key={step}
            onClick={() => { setFrameIdx(i); setIsPlaying(false); }}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition ${
              i === frameIdx
                ? 'bg-blue-600 text-white'
                : fetchedRef.current[step] !== undefined
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            T+{step}
          </button>
        ))}
      </div>

      {/* 컬러바 */}
      <div className="mt-3">
        <div className="flex h-3 rounded overflow-hidden">
          {COLORBAR.slice(0, -1).map((s, i) => (
            <div key={i} className="flex-1" style={{ background: s.color }} />
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          {COLORBAR.map(s => <span key={s.label}>{s.label}</span>)}
        </div>
        <p className="text-xs text-gray-400 text-right mt-0.5">단위: mm/hr</p>
      </div>
    </div>
  );
}
