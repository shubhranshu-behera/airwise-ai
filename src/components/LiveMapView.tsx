import L from 'leaflet';
import { Info, Layers, MapPin, Search, Wind } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type {
  AqiStandard,
  CityLocation,
  CommunityReport,
  CurrentEnvironmentData,
  NeighborhoodStation,
} from '../types';

interface LiveMapViewProps {
  city: CityLocation;
  standard: AqiStandard;
  current: CurrentEnvironmentData | null;
  onSelectCity: (city: CityLocation) => void;
  onAskAi: (prompt: string) => void;
}

type LayerKey =
  | 'aqiHeat'
  | 'pm25'
  | 'pm10'
  | 'stations'
  | 'hotspots'
  | 'greenZones'
  | 'wind'
  | 'community'
  | 'routes';

const LAYER_LABELS: Array<{ key: LayerKey; label: string }> = [
  { key: 'aqiHeat', label: 'AQI Zones' },
  { key: 'pm25', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
  { key: 'stations', label: 'Stations' },
  { key: 'hotspots', label: 'Hotspots' },
  { key: 'greenZones', label: 'Green Zones' },
  { key: 'wind', label: 'Wind Vector' },
  { key: 'community', label: 'Community Reports' },
  { key: 'routes', label: 'Clean Corridor' },
];

export function LiveMapView({ city, standard, current, onSelectCity, onAskAi }: LiveMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [stations, setStations] = useState<NeighborhoodStation[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [selectedStation, setSelectedStation] = useState<NeighborhoodStation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CityLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    aqiHeat: true,
    pm25: false,
    pm10: false,
    stations: true,
    hotspots: true,
    greenZones: true,
    wind: true,
    community: true,
    routes: true,
  });

  // Load neighborhood stations & community reports for selected city
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getNeighborhoods(city, standard), api.getCommunityReports(city.name)])
      .then(([nRes, cRes]) => {
        if (cancelled) return;
        setStations(nRes.stations);
        setSelectedStation(nRes.stations[0] || null);
        setReports(cRes.reports);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city.id, city.lat, city.lng, standard]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [city.lat, city.lng],
      zoom: 12,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      maxZoom: 18,
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  // Re-center map when city changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([city.lat, city.lng], 12, { animate: true });
    }
  }, [city.lat, city.lng]);

  // Render active geospatial overlays
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const st of stations) {
      const isHotspot = st.zoneType === 'traffic_hotspot' || st.zoneType === 'industrial';
      const isGreen = st.zoneType === 'green_zone';

      if (activeLayers.aqiHeat || activeLayers.pm25 || activeLayers.pm10) {
        const radius = activeLayers.pm10 ? 1500 : activeLayers.pm25 ? 1250 : 1400;
        const fillColor = activeLayers.pm10
          ? '#F59E0B'
          : activeLayers.pm25
            ? '#39BDF8'
            : st.category.color;
        L.circle([st.lat, st.lng], {
          radius,
          color: fillColor,
          weight: 1,
          opacity: 0.45,
          fillColor,
          fillOpacity: 0.16,
        })
          .on('click', () => setSelectedStation(st))
          .addTo(group);
      }

      if (isHotspot && !activeLayers.hotspots) continue;
      if (isGreen && !activeLayers.greenZones) continue;
      if (!isHotspot && !isGreen && !activeLayers.stations) continue;

      const markerColor = isGreen ? '#22C55E' : isHotspot ? '#EF4444' : st.category.color;
      const marker = L.circleMarker([st.lat, st.lng], {
        radius: st.dataOrigin === 'city_reference_model' ? 10 : 8,
        color: '#EAF2F8',
        weight: 2,
        fillColor: markerColor,
        fillOpacity: 0.9,
      });

      const popupEl = document.createElement('div');
      popupEl.style.minWidth = '170px';
      const titleEl = document.createElement('div');
      titleEl.style.fontWeight = '700';
      titleEl.style.fontSize = '13px';
      titleEl.style.marginBottom = '4px';
      titleEl.textContent = st.name;
      const aqiEl = document.createElement('div');
      aqiEl.style.fontFamily = 'monospace';
      aqiEl.style.fontSize = '12px';
      aqiEl.textContent = `AQI: ${st.aqi} (${st.category.label})`;
      const pmEl = document.createElement('div');
      pmEl.style.fontFamily = 'monospace';
      pmEl.style.fontSize = '11px';
      pmEl.style.color = '#9CB2C5';
      pmEl.textContent = `PM2.5: ${st.pm25} · PM10: ${st.pm10} µg/m³`;
      const metaEl = document.createElement('div');
      metaEl.style.fontSize = '10px';
      metaEl.style.color = '#9CB2C5';
      metaEl.style.marginTop = '4px';
      metaEl.textContent = `${
        st.dataOrigin === 'city_reference_model' ? 'City Reference Feed' : 'Estimated Micro-Zone'
      } · ${st.confidencePct}% confidence`;
      popupEl.append(titleEl, aqiEl, pmEl, metaEl);

      marker.bindPopup(popupEl);
      marker.on('click', () => setSelectedStation(st));
      marker.addTo(group);
    }

    // Clean greenway travel corridor polyline connecting greener zones
    if (activeLayers.routes && stations.length >= 3) {
      const greenPoints = stations
        .filter((s) => s.zoneType === 'green_zone' || s.zoneType === 'residential')
        .map((s) => [s.lat, s.lng] as [number, number]);
      if (greenPoints.length >= 2) {
        L.polyline(greenPoints, {
          color: '#00C9A7',
          weight: 3,
          dashArray: '6 6',
          opacity: 0.85,
        })
          .bindPopup('Lower-exposure green corridor connecting vegetated & residential buffers')
          .addTo(group);
      }
    }

    // Wind vector arrow indicator from city center
    if (activeLayers.wind && current?.weather.windDirectionDeg !== null && current?.weather.windDirectionDeg !== undefined) {
      const rad = ((current.weather.windDirectionDeg + 180) % 360) * (Math.PI / 180);
      const endLat = city.lat + Math.cos(rad) * 0.025;
      const endLng = city.lng + Math.sin(rad) * 0.025;
      L.polyline(
        [
          [city.lat, city.lng],
          [endLat, endLng],
        ],
        { color: '#39BDF8', weight: 3, opacity: 0.9 },
      )
        .bindPopup(
          `Wind Flow: ${current.weather.windSpeedKmh ?? '—'} km/h from ${current.weather.windCardinal} (${current.weather.windDirectionDeg}°)`,
        )
        .addTo(group);
    }

    // Community reports pins
    if (activeLayers.community) {
      for (const rep of reports) {
        const repEl = document.createElement('div');
        repEl.style.maxWidth = '200px';
        const rTitle = document.createElement('div');
        rTitle.style.fontWeight = '700';
        rTitle.style.fontSize = '12px';
        rTitle.textContent = `Community Report: ${rep.neighborhood}`;
        const rDesc = document.createElement('div');
        rDesc.style.fontSize = '11px';
        rDesc.style.color = '#9CB2C5';
        rDesc.style.margin = '3px 0';
        rDesc.textContent = rep.description;
        const rMeta = document.createElement('div');
        rMeta.style.fontSize = '10px';
        rMeta.style.color = '#00C9A7';
        rMeta.textContent = `Status: ${rep.status} · ${rep.upvotes} upvotes`;
        repEl.append(rTitle, rDesc, rMeta);

        L.circleMarker([rep.lat, rep.lng], {
          radius: 7,
          color: '#F59E0B',
          weight: 2,
          fillColor: rep.category === 'clean_air_zone' ? '#22C55E' : '#F59E0B',
          fillOpacity: 0.85,
        })
          .bindPopup(repEl)
          .addTo(group);
      }
    }
  }, [stations, reports, activeLayers, current, city]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchCities(searchQuery);
      setSearchResults(res.results);
    } finally {
      setSearching(false);
    }
  }

  function toggleLayer(key: LayerKey) {
    setActiveLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-4">
      {/* Search + Layer Controls */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[var(--aw-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any city worldwide (e.g. Cuttack, Pune, Tokyo)..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--aw-bg)] border border-[var(--aw-border)] text-sm text-[var(--aw-text)] focus:outline-none focus:border-[#00C9A7]"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-4 py-2 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer whitespace-nowrap"
            >
              {searching ? 'Searching...' : 'Locate'}
            </button>
          </form>

          <div className="flex items-center gap-2 text-xs text-[var(--aw-text-secondary)]">
            <Layers className="w-4 h-4 text-[#39BDF8]" />
            <span>Toggle map layers:</span>
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--aw-border)]">
            {searchResults.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => {
                  onSelectCity(loc);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 rounded-md bg-[var(--aw-bg)] border border-[var(--aw-border)] hover:border-[#00C9A7] text-xs text-[var(--aw-text)] cursor-pointer transition-colors"
              >
                {loc.name}, {loc.region || loc.country}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {LAYER_LABELS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleLayer(item.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                activeLayers[item.key]
                  ? 'bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/40'
                  : 'bg-[var(--aw-bg)] text-[var(--aw-text-secondary)] border border-[var(--aw-border)] hover:text-[var(--aw-text)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Map + Location Inspector Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 rounded-xl border border-[var(--aw-border)] overflow-hidden bg-[#0A1726] min-h-[480px] relative">
          <div ref={mapContainerRef} className="w-full h-[500px]" />
        </div>

        {/* Selected Location Detailed Inspector */}
        <div className="lg:col-span-4 rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] p-5 flex flex-col justify-between space-y-5">
          {selectedStation ? (
            <>
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-[#39BDF8]">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>
                      {selectedStation.dataOrigin === 'city_reference_model'
                        ? 'City Reference Live Feed'
                        : 'Estimated Neighborhood Offset'}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[var(--aw-text)]">{selectedStation.name}</h3>
                  <div className="text-xs text-[var(--aw-text-secondary)] font-mono-num">
                    {selectedStation.lat}°, {selectedStation.lng}° · Confidence {selectedStation.confidencePct}%
                  </div>
                </div>

                <div className="flex items-baseline justify-between py-3 border-y border-[var(--aw-border)]">
                  <div>
                    <div className="text-xs text-[var(--aw-text-secondary)]">
                      {standard === 'CPCB_NAQI' ? 'CPCB NAQI' : 'US AQI'}
                    </div>
                    <div
                      className="font-mono-num text-3xl font-bold mt-0.5"
                      style={{ color: selectedStation.category.color }}
                    >
                      {selectedStation.aqi}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold" style={{ color: selectedStation.category.color }}>
                      {selectedStation.category.label}
                    </div>
                    <div className="text-xs text-[var(--aw-text-secondary)] font-mono-num">
                      Observed {selectedStation.observedAt.slice(11, 16)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
                    <div className="text-[11px] text-[var(--aw-text-secondary)]">PM2.5</div>
                    <div className="font-mono-num text-base font-semibold text-[var(--aw-text)]">
                      {selectedStation.pm25}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
                    <div className="text-[11px] text-[var(--aw-text-secondary)]">PM10</div>
                    <div className="font-mono-num text-base font-semibold text-[var(--aw-text)]">
                      {selectedStation.pm10}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[var(--aw-bg)]">
                    <div className="text-[11px] text-[var(--aw-text-secondary)]">NO₂</div>
                    <div className="font-mono-num text-base font-semibold text-[var(--aw-text)]">
                      {selectedStation.no2}
                    </div>
                  </div>
                </div>

                {current && (
                  <div className="flex items-center justify-between text-xs text-[var(--aw-text-secondary)]">
                    <span className="inline-flex items-center gap-1.5">
                      <Wind className="w-3.5 h-3.5 text-[#39BDF8]" />
                      Wind {current.weather.windSpeedKmh ?? '—'} km/h {current.weather.windCardinal}
                    </span>
                    <span className="font-mono-num">
                      {current.weather.temperatureC ?? '—'}°C · RH {current.weather.humidityPct ?? '—'}%
                    </span>
                  </div>
                )}

                <p className="text-xs text-[var(--aw-text-secondary)] leading-relaxed">{selectedStation.note}</p>

                <div className="p-3 rounded-lg bg-[var(--aw-bg)] text-[11px] text-[var(--aw-text-secondary)] flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <span>
                    Do not infer safe outdoor locations from map colors alone. Micro-zone markers represent spatial
                    estimates around the live city model.
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--aw-border)]">
                <button
                  type="button"
                  onClick={() =>
                    onAskAi(
                      `Analyze air quality around ${selectedStation.name} (AQI ${selectedStation.aqi}, PM2.5 ${selectedStation.pm25} µg/m³) and recommend safer outdoor alternatives.`,
                    )
                  }
                  className="w-full py-2.5 rounded-lg bg-[#00C9A7] text-[#05181C] text-xs font-semibold hover:bg-[#19DDBB] transition-colors cursor-pointer"
                >
                  Get AI Recommendation for This Zone
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--aw-text-secondary)]">Select a zone on the map to inspect details.</div>
          )}
        </div>
      </div>

      {/* Neighborhood Comparison Table */}
      <div className="rounded-xl border border-[var(--aw-border)] bg-[var(--aw-surface)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--aw-border)] flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-[var(--aw-text)]">
            Neighborhood Comparison — {city.name}
          </h3>
          <span className="text-xs text-[var(--aw-text-secondary)]">Click any row to focus on map</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--aw-border)] text-xs text-[var(--aw-text-secondary)]">
                <th className="px-5 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Origin</th>
                <th className="px-4 py-3 font-medium text-right">AQI</th>
                <th className="px-4 py-3 font-medium text-right">PM2.5</th>
                <th className="px-4 py-3 font-medium text-right">PM10</th>
                <th className="px-4 py-3 font-medium text-right">NO₂</th>
                <th className="px-5 py-3 font-medium text-right">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((st) => (
                <tr
                  key={st.id}
                  onClick={() => {
                    setSelectedStation(st);
                    mapRef.current?.panTo([st.lat, st.lng]);
                  }}
                  className={`border-b border-[var(--aw-border)] last:border-b-0 hover:bg-white/[0.03] cursor-pointer transition-colors ${
                    selectedStation?.id === st.id ? 'bg-[#00C9A7]/[0.07]' : ''
                  }`}
                >
                  <td className="px-5 py-3 font-medium text-[var(--aw-text)]">{st.name}</td>
                  <td className="px-4 py-3 text-xs text-[var(--aw-text-secondary)]">
                    {st.dataOrigin === 'city_reference_model' ? 'City Reference' : 'Estimated Offset'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num font-semibold" style={{ color: st.category.color }}>
                    {st.aqi}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-num text-[var(--aw-text)]">{st.pm25}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-[var(--aw-text)]">{st.pm10}</td>
                  <td className="px-4 py-3 text-right font-mono-num text-[var(--aw-text)]">{st.no2}</td>
                  <td className="px-5 py-3 text-right font-mono-num text-[var(--aw-text-secondary)]">
                    {st.confidencePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
