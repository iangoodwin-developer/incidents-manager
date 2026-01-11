// small dependency free chart for incident readings
// kept it css only so demo stays lightweight

import React, { useMemo } from 'react';
import { IncidentReading } from '../../../../shared/types';
import styles from './IncidentChart.scss'


type IncidentChartProps = {
  readings: IncidentReading[];
};

const TREND_THRESHOLD = 0.2;

const formatReading = (value: number) => value.toFixed(1);

// compare last two readings to decide arrow + color
const getTrendSummary = (readings: IncidentReading[], key: 'temperature' | 'pressure') => {
  const last = readings[readings.length - 1];
  const previous = readings[readings.length - 2];

  if (!last) {
    return { label: 'N/A', symbol: '-', status: 'steady' as const };
  }
  if (!previous) {
    return { label: formatReading(last[key]), symbol: '-', status: 'steady' as const };
  }

  const delta = last[key] - previous[key];
  if (delta > TREND_THRESHOLD) {
    return { label: formatReading(last[key]), symbol: '^', status: 'rising' as const };
  }
  if (delta < -TREND_THRESHOLD) {
    return { label: formatReading(last[key]), symbol: 'v', status: 'falling' as const };
  }

  return { label: formatReading(last[key]), symbol: '-', status: 'steady' as const };
};

export const IncidentChart: React.FC<IncidentChartProps> = ({ readings }) => {
  const temperatureTrend = getTrendSummary(readings, 'temperature');
  const pressureTrend = getTrendSummary(readings, 'pressure');

  const temperatureBars = useMemo(() => {
    // normalize bar heights so visual scale adjusts to data range
    if (readings.length === 0) {
      return [];
    }
    const values = readings.map((item) => item.temperature);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return readings.map((item) => ({
      id: item.timestamp,
      height: ((item.temperature - min) / range) * 100,
    }));
  }, [readings]);

  const pressureBars = useMemo(() => {
    if (readings.length === 0) {
      return [];
    }
    const values = readings.map((item) => item.pressure);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return readings.map((item) => ({
      id: item.timestamp,
      height: ((item.pressure - min) / range) * 100,
    }));
  }, [readings]);

  return (
    <section className={styles.incidentChart}>
      <header className={styles.incidentChartHeader}>
        <div>
          <h3 className='incident-chart__title'>Live readings</h3>
          <p className='incident-chart__subtitle'>Temperature and pressure over time.</p>
        </div>
        <div className='incident-chart__values'>
          <div className='incident-chart__value'>
            <span className='incident-chart__value-label'>Temp</span>
            <span
              className={`incident-chart__value-number incident-chart__value-number--${temperatureTrend.status}`}
            >
              {temperatureTrend.label} F
            </span>
            <span className='incident-chart__value-arrow'>{temperatureTrend.symbol}</span>
          </div>
          <div className='incident-chart__value'>
            <span className='incident-chart__value-label'>Pressure</span>
            <span
              className={`incident-chart__value-number incident-chart__value-number--${pressureTrend.status}`}
            >
              {pressureTrend.label} psi
            </span>
            <span className='incident-chart__value-arrow'>{pressureTrend.symbol}</span>
          </div>
        </div>
      </header>
      {temperatureBars.length === 0 ? (
        <p className='incident-chart__empty'>No readings yet.</p>
      ) : (
        <div className='incident-chart__series'>
          <div className='incident-chart__legend'>
            <span className='incident-chart__legend-item'>
              <span className='incident-chart__legend-swatch incident-chart__legend-swatch--temp' />
              Temperature
            </span>
            <span className='incident-chart__legend-item'>
              <span className='incident-chart__legend-swatch incident-chart__legend-swatch--pressure' />
              Pressure
            </span>
          </div>
          <div className='incident-chart__bars'>
            {temperatureBars.map((bar) => (
              <div
                key={bar.id}
                className='incident-chart__bar incident-chart__bar--temp'
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
          <div className='incident-chart__bars'>
            {pressureBars.map((bar) => (
              <div
                key={bar.id}
                className='incident-chart__bar incident-chart__bar--pressure'
                style={{ height: `${bar.height}%` }}
              />
            ))}
          </div>
        </div>
      )}
      <p className='incident-chart__caption'>Updates stream in real time via WebSocket.</p>
    </section>
  );
};
