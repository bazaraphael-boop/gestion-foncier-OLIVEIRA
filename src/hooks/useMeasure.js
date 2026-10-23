import { useEffect, useMemo, useState } from 'react';
import { measurePoints, computeLotQuota } from '../utils/geoUtils';

// Settings and results of the "latte" measuring tool (see components/MeasureTool.jsx)

const SETTINGS_KEY = 'geocadastre_measure_settings_v1';
const DEFAULT_SETTINGS = { lotWidthM: 20, lotLengthM: 25, reservePct: 20, pricePerM2: 0, currency: 'USD' };

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable: defaults are fine
  }
  return DEFAULT_SETTINGS;
}

export function useMeasureSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Storage unavailable: settings only last for this session
    }
  }, [settings]);
  return [settings, setSettings];
}

export function useMeasureResults(points, settings) {
  return useMemo(() => {
    const measure = measurePoints(points);
    const quota = computeLotQuota({
      areaM2: measure.areaM2,
      lotWidthM: Number(settings.lotWidthM) || 0,
      lotLengthM: Number(settings.lotLengthM) || 0,
      reservePct: Number(settings.reservePct) || 0
    });
    const price = Number(settings.pricePerM2) || 0;
    return {
      measure,
      quota,
      pricing: {
        price,
        total: measure.areaM2 * price,
        perLot: quota.lotAreaM2 * price,
        sellable: quota.lots * quota.lotAreaM2 * price
      }
    };
  }, [points, settings]);
}
