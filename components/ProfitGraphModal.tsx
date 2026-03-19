'use client';

import { useMemo } from 'react';
import type { GameResult } from '@/types';

interface Props {
  results: GameResult[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

interface DailyPoint {
  key: string;
  label: string;
  value: number;
  timestamp: number;
}

interface ChartPoint extends DailyPoint {
  x: number;
  y: number;
  color: string;
}

interface SegmentPart {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

const POSITIVE_BRIGHT_COLOR = '#4ade80';
const POSITIVE_DARK_COLOR = '#16a34a';
const NEGATIVE_BRIGHT_COLOR = '#f87171';
const NEGATIVE_DARK_COLOR = '#dc2626';
const NEUTRAL_COLOR = 'rgba(255,255,255,0.45)';

function formatCurrency(value: number) {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : '-'}$${Math.abs(rounded).toLocaleString()}`;
}

function getTrendColor(value: number, previousValue?: number) {
  if (value === 0) return NEUTRAL_COLOR;
  if (previousValue == null) {
    return value > 0 ? POSITIVE_BRIGHT_COLOR : NEGATIVE_BRIGHT_COLOR;
  }

  const increased = value >= previousValue;

  if (value > 0) {
    return increased ? POSITIVE_BRIGHT_COLOR : POSITIVE_DARK_COLOR;
  }

  return increased ? NEGATIVE_BRIGHT_COLOR : NEGATIVE_DARK_COLOR;
}

function getExtremeValueColor(value: number) {
  if (value > 0) return POSITIVE_BRIGHT_COLOR;
  if (value < 0) return NEGATIVE_BRIGHT_COLOR;
  return NEUTRAL_COLOR;
}

function buildDailyPoints(results: GameResult[]): DailyPoint[] {
  const dailyMap = new Map<string, { key: string; label: string; delta: number; timestamp: number }>();

  for (const result of results) {
    const date = new Date(result.savedAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const key = `${year}-${month}-${day}`;
    const timestamp = new Date(year, date.getMonth(), day).getTime();
    const current = dailyMap.get(key);

    if (current) {
      current.delta += result.gameDelta;
    } else {
      dailyMap.set(key, {
        key,
        label: `${month}/${day}`,
        delta: result.gameDelta,
        timestamp,
      });
    }
  }

  let runningTotal = 0;

  return [...dailyMap.values()]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((point) => {
      runningTotal += point.delta;
      return {
        key: point.key,
        label: point.label,
        value: runningTotal,
        timestamp: point.timestamp,
      };
    });
}

function getZeroSafeRange(minValue: number, maxValue: number) {
  const range = maxValue - minValue;
  if (range > 0) return range;
  return Math.max(Math.abs(maxValue), 1);
}

function getSegmentParts(start: ChartPoint, end: ChartPoint, zeroY: number): SegmentPart[] {
  const startValue = start.value;
  const endValue = end.value;

  if (startValue === 0 && endValue === 0) {
    return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y, color: NEUTRAL_COLOR }];
  }

  if ((startValue >= 0 && endValue >= 0) || (startValue <= 0 && endValue <= 0)) {
    return [{ x1: start.x, y1: start.y, x2: end.x, y2: end.y, color: end.color }];
  }

  const ratio = Math.abs(startValue) / (Math.abs(startValue) + Math.abs(endValue));
  const crossX = start.x + (end.x - start.x) * ratio;

  return [
    {
      x1: start.x,
      y1: start.y,
      x2: crossX,
      y2: zeroY,
      color: start.color,
    },
    {
      x1: crossX,
      y1: zeroY,
      x2: end.x,
      y2: end.y,
      color: end.color,
    },
  ];
}

export default function ProfitGraphModal({ results, loading, error, onClose }: Props) {
  const points = useMemo(() => buildDailyPoints(results), [results]);

  const chart = useMemo(() => {
    if (points.length === 0) return null;

    const svgHeight = 220;
    const paddingTop = 20;
    const paddingRight = 16;
    const paddingBottom = 52;
    const paddingLeft = 16;
    const graphHeight = svgHeight - paddingTop - paddingBottom;
    const svgWidth = Math.max(320, points.length * 64);
    const graphWidth = svgWidth - paddingLeft - paddingRight;
    const minValue = Math.min(0, ...points.map((point) => point.value));
    const maxValue = Math.max(0, ...points.map((point) => point.value));
    const padding = Math.max(getZeroSafeRange(minValue, maxValue) * 0.12, 1);
    const paddedMin = minValue - padding;
    const paddedMax = maxValue + padding;
    const range = paddedMax - paddedMin;

    const toY = (value: number) =>
      paddingTop + ((paddedMax - value) / range) * graphHeight;

    const zeroY = toY(0);
    const chartPoints: ChartPoint[] = points.map((point, index) => {
      const x = points.length === 1
        ? paddingLeft + graphWidth / 2
        : paddingLeft + (graphWidth * index) / (points.length - 1);
      const previousValue = index > 0 ? points[index - 1].value : undefined;

      return {
        ...point,
        x,
        y: toY(point.value),
        color: getTrendColor(point.value, previousValue),
      };
    });

    const segments = chartPoints.flatMap((point, index) => {
      if (index === 0) return [];
      return getSegmentParts(chartPoints[index - 1], point, zeroY);
    });

    return {
      svgWidth,
      svgHeight,
      zeroY,
      paddedMin,
      paddedMax,
      chartPoints,
      segments,
    };
  }, [points]);

  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: '720px',
          width: 'min(92vw, 720px)',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>生涯収支グラフ</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
            プレイした日だけを横軸に表示した、生涯収支の推移です
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(255,255,255,0.5)' }}>
              読み込み中...
            </div>
          ) : error ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 16px',
                borderRadius: '12px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          ) : !chart ? (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 16px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              まだ収支データがありません
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>最高生涯収支</div>
                  <div style={{ color: getExtremeValueColor(Math.max(...points.map((point) => point.value))), fontWeight: 700 }}>
                    {formatCurrency(Math.max(...points.map((point) => point.value)))}
                  </div>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>最低生涯収支</div>
                  <div style={{ color: getExtremeValueColor(Math.min(...points.map((point) => point.value))), fontWeight: 700 }}>
                    {formatCurrency(Math.min(...points.map((point) => point.value)))}
                  </div>
                </div>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>プレイ日数</div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>
                    {points.length}日
                  </div>
                </div>
              </div>

              <div
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  paddingBottom: '4px',
                }}
              >
                <svg
                  width={chart.svgWidth}
                  height={chart.svgHeight}
                  viewBox={`0 0 ${chart.svgWidth} ${chart.svgHeight}`}
                  role="img"
                  aria-label="生涯収支グラフ"
                >
                  <line
                    x1={16}
                    y1={chart.zeroY}
                    x2={chart.svgWidth - 16}
                    y2={chart.zeroY}
                    stroke="rgba(255,255,255,0.25)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={12}
                    y={24}
                    fill="rgba(255,255,255,0.45)"
                    fontSize="11"
                    textAnchor="start"
                  >
                    {formatCurrency(chart.paddedMax)}
                  </text>
                  <text
                    x={12}
                    y={chart.zeroY - 6}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="11"
                    textAnchor="start"
                  >
                    $0
                  </text>
                  <text
                    x={12}
                    y={chart.svgHeight - 34}
                    fill="rgba(255,255,255,0.45)"
                    fontSize="11"
                    textAnchor="start"
                  >
                    {formatCurrency(chart.paddedMin)}
                  </text>

                  {chart.segments.map((segment, index) => (
                    <line
                      key={`${segment.x1}-${segment.x2}-${index}`}
                      x1={segment.x1}
                      y1={segment.y1}
                      x2={segment.x2}
                      y2={segment.y2}
                      stroke={segment.color}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  ))}

                  {chart.chartPoints.map((point) => (
                    <g key={point.key}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4.5"
                        fill={point.color}
                        stroke="#111827"
                        strokeWidth="2"
                      />
                      <text
                        x={point.x}
                        y={chart.svgHeight - 18}
                        fill="rgba(255,255,255,0.72)"
                        fontSize="11"
                        textAnchor="middle"
                      >
                        {point.label}
                      </text>
                      <text
                        x={point.x}
                        y={point.value >= 0 ? point.y - 10 : point.y + 18}
                        fill={point.color}
                        fontSize="11"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {formatCurrency(point.value)}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
