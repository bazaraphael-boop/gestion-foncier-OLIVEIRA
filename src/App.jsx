import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import ClientNavbar from './components/ClientNavbar';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import ParcelList from './components/ParcelList';
import AdminLocationHUD from './components/AdminLocationHUD';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { getOceanZoneInfo } from './utils/coastalZones';
import * as turf from '@turf/turf';

import PortalSelectionModal from './components/PortalSelectionModal';
import AdminLoginModal from './components/AdminLoginModal';

// Lazy load secondary modals to drastically accelerate initial loading
const ParcelModal = lazy(() => import('./components/ParcelModal'));
const ParcelFormModal = lazy(() => import('./components/ParcelFormModal'));
const KmlImporter = lazy(() => import('./components/KmlImporter'));
const KmlParcelImporterModal = lazy(() => import('./components/KmlParcelImporterModal'));
const CadastreBatchModal = lazy(() => import('./components/CadastreBatchModal'));
const ZoneManagerModal = lazy(() => import('./components/ZoneManagerModal'));
const GeoJsonImporterModal = lazy(() => import('./components/GeoJsonImporterModal'));
const SupabaseModal = lazy(() => import('./components/SupabaseModal'));
const AdminSecurityModal = lazy(() => import('./components/AdminSecurityModal'));
const AuditLogModal = lazy(() => import('./components/AuditLogModal'));

import { DEFAULT_KML_DATA } from './data/defaultConcession';
import { parseKMLToGeoJSON, extractMainConcessionPolygon } from './utils/kmlParser';
import { calculateArea, exportParcelsToGeoJSON } from './utils/geoUtils';
import { Layers3, Globe, MapPin, Pencil, Navigation, Crosshair } from 'lucide-react';

import {
  fetchParcelsFromSupabase,
  saveParcelToSupabase,
  deleteParcelFromSupabase,
  bulkSaveParcelsToSupabase,
  bulkDeleteParcelsFromSupabase,
  deleteAllParcelsInSupabase,
  saveConcessionToSupabase,
  fetchConcessionFromSupabase,
  subscribeToRealtimeParcels,
  getLastCloudError
} from './services/supabaseClient';

import { getCurrentSession, onSessionChange, logout } from './services/authService';
import { logActivity } from './services/auditService';
import { useShareSurveyorPosition, useLiveSurveyors } from './hooks/useSurveyorTracking';
import { useZones } from './hooks/useZones';

const STORAGE_KEY_PARCELS = 'geocadastre_parcels_v3';
const STORAGE_KEY_ISETECH = 'geocadastre_isetech_parcels_v3';
const STORAGE_KEY_CONCESSION = 'geocadastre_concession_v3';

function getInitialConcession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONCESSION);
    if (saved) {
      const parsed = JSON.parse(saved);
      const ring = parsed?.geometry?.coordinates?.[0] || parsed?.coordinates?.[0];
      if (Array.isArray(ring) && ring.length >= 20) {
        return parsed;
      }
    }
  } catch (e) {}
  const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
  return extractMainConcessionPolygon(geojson);
}

function getInitialParcels() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PARCELS);
    if (saved !== null) {
      const loaded = JSON.parse(saved);
      if (Array.isArray(loaded)) return loaded;
    }
  } catch (e) {}
  return [];
}

function getInitialIsetechParcels() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ISETECH);
    if (saved !== null) {
      const loaded = JSON.parse(saved);
      if (Array.isArray(loaded)) return loaded;
    }
  } catch (e) {}
  return [];
}

export default function App() {
  // Authentication & Role Session State ('admin' | 'arpenteur' | 'client' | null)
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authView, setAuthView] = useState(() => {
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';
      if (search.includes('admin') || hash.includes('admin') || pathname.endsWith('/admin')) {
        return 'admin_login';
      }
    } catch (e) {}
    return 'portal';
  });

  // Navigation View Mode: 'isetech' | 'global' (Defaults to the true cadastre ISETECH from Image 2)
  const [activeView, setActiveView] = useState('isetech');

  // Zones of the concession (Zone ISETECH…): visible to all, added and deleted by the admin only
  const { zones, addZone, removeZone } = useZones({ signedIn: !!session?.user?.id, isAdmin: session?.role === 'admin' });
  const activeZone = zones.find((z) => z.id === activeView) || null;
  // A zone that no longer exists (deleted on another device) brings the view back to the whole concession
  if (activeView !== 'global' && !activeZone) setActiveView('global');

  // Sidebar Collapsed state for 100% Full Width Map (collapsed by default on mobile)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.innerWidth < 768;
    } catch (e) {
      return false;
    }
  });

  // Synchronous INSTANT initialization
  const [concessionPolygon, setConcessionPolygon] = useState(getInitialConcession);

  // Main Parcels array state & Sub-parcels array state
  const [globalParcels, setGlobalParcels] = useState(getInitialParcels);
  const [isetechParcels, setIsetechParcels] = useState(getInitialIsetechParcels);

  // Single selected parcel for detail view
  const [selectedParcel, setSelectedParcel] = useState(null);

  // Multi-selection array state for batch actions
  const [selectedParcelIds, setSelectedParcelIds] = useState([]);

  // Initial points for form when created via map drawing tool
  const [initialFormPoints, setInitialFormPoints] = useState(null);

  // Modals visibility state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isKmlImporterOpen, setIsKmlImporterOpen] = useState(false);
  const [isKmlParcelImporterOpen, setIsKmlParcelImporterOpen] = useState(false);
  const [isCadastreBatchOpen, setIsCadastreBatchOpen] = useState(false);
  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState(false);
  const [zoneDraftPoints, setZoneDraftPoints] = useState(null); // [[lat, lng]] traced on the map for a new zone
  const [isGeoJsonImporterOpen, setIsGeoJsonImporterOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isAdminSecurityOpen, setIsAdminSecurityOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);

  // Admin Real-Time GPS Geolocation States
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [flyToTrigger, setFlyToTrigger] = useState(0);
  const [drawTrigger, setDrawTrigger] = useState(0);
  const [drawingForZone, setDrawingForZone] = useState(false); // trace started from "Zones de la concession"
  const [editConcessionTrigger, setEditConcessionTrigger] = useState(0);
  const watchIdRef = useRef(null);
  const isFirstFixRef = useRef(true);

  // Stop GPS watch and reset location states
  const stopLocation = () => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLocating(false);
    setUserLocation(null);
    setLocationAccuracy(null);
    setIsSimulated(false);
    isFirstFixRef.current = true;
  };

  // Cleanup GPS watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Toggle GPS geolocation watcher
  const handleToggleLocation = () => {
    if (isLocating) {
      stopLocation();
      return;
    }

    if (!('geolocation' in navigator)) {
      alert("La géolocalisation n'est pas supportée par votre appareil ou navigateur.");
      return;
    }

    setIsLocating(true);
    setIsSimulated(false);
    isFirstFixRef.current = true;

    const successCallback = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      // Filter stationary jitter (under 1.5 meters) to avoid map and beacon jumping
      setUserLocation((prevLoc) => {
        if (!prevLoc) return [latitude, longitude];
        const dLat = (latitude - prevLoc[0]) * 111320;
        const dLng = (longitude - prevLoc[1]) * 111320 * Math.cos((latitude * Math.PI) / 180);
        const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);
        if (distMeters < 1.5) {
          return prevLoc;
        }
        return [latitude, longitude];
      });

      setLocationAccuracy(accuracy || null);

      // Trigger map flyTo ONLY on the very first GPS fix
      if (isFirstFixRef.current) {
        isFirstFixRef.current = false;
        setFlyToTrigger((prev) => prev + 1);
      }
    };

    const errorCallback = (err) => {
      console.warn('Erreur géolocalisation GPS:', err);
      if (err.code === 1) {
        alert("Accès à la géolocalisation refusé. Veuillez autoriser la localisation dans les paramètres de votre navigateur.");
        stopLocation();
      } else {
        // Fallback retry with getCurrentPosition
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (fallbackErr) => {
            alert("Impossible de déterminer votre position GPS: " + fallbackErr.message);
            stopLocation();
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      }
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } catch (e) {
      console.error("WatchPosition error:", e);
      navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
    }
  };

  // Simulation coordinates for testing Zones UP, A, B, C, D even on desktop
  const SIMULATION_POINTS = {
    UP: [-5.8794, 12.2848], // Zone UP (Utilité Publique): ~50 m de l'océan
    A: [-5.8788, 12.2855],  // Zone A: ~150 m de l'océan
    B: [-5.8790, 12.2870],  // Zone B: ~270 m de l'océan
    C: [-5.8780, 12.2890],  // Zone C: ~514 m de l'océan
    D: [-5.9050, 12.3350]   // Zone D: ~1 775 m de l'océan (dans Zone ISETECH)
  };

  const handleSimulateLocation = (zoneCode) => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const target = SIMULATION_POINTS[zoneCode] || SIMULATION_POINTS.B;
    setUserLocation(target);
    setLocationAccuracy(8);
    setIsSimulated(true);
    setIsLocating(true);
    setFlyToTrigger((prev) => prev + 1);
  };

  const handleRecenterLocation = () => {
    if (userLocation) {
      setFlyToTrigger((prev) => prev + 1);
    }
  };

  // Real-time spatial analysis for active GPS position
  const locationAnalysis = useMemo(() => {
    if (!userLocation) {
      return {
        zoneInfo: null,
        isInConcession: false,
        insideZoneName: null,
        locatedParcel: null
      };
    }

    const [lat, lng] = userLocation;
    const pt = turf.point([lng, lat]);

    // 1. Coastal Zone and exact distance from ocean
    const zoneInfo = getOceanZoneInfo(userLocation);

    // 2. Check if inside Concession Manuel Joaquim d'Oliveira (5 310,21 ha)
    let inConcession = false;
    if (concessionPolygon && concessionPolygon.geometry) {
      try {
        inConcession = turf.booleanPointInPolygon(pt, concessionPolygon);
      } catch (e) {}
    }

    // 3. Zone of the concession containing the position (Zone ISETECH…)
    const insideZone = zones.find((zone) => {
      try {
        return turf.booleanPointInPolygon(pt, zone);
      } catch (e) {
        return false;
      }
    });

    // 4. Check if inside a specific parcel
    let foundParcel = null;
    const allParcelsToCheck = [...(globalParcels || []), ...(isetechParcels || [])];
    for (const p of allParcelsToCheck) {
      if (p && p.geometry) {
        try {
          if (turf.booleanPointInPolygon(pt, p)) {
            foundParcel = p;
            break;
          }
        } catch (e) {}
      }
    }

    return {
      zoneInfo,
      isInConcession: inConcession,
      insideZoneName: insideZone?.properties?.name || null,
      locatedParcel: foundParcel
    };
  }, [userLocation, concessionPolygon, zones, globalParcels, isetechParcels]);

  // Role session flags
  const isClientRole = session?.role === 'client';
  const isArpenteur = session?.role === 'arpenteur';
  const isAdmin = session?.role === 'admin';

  // Live tracking: the arpenteur's real GPS position is sent while it is on (nothing is shown to him),
  // the admin follows it on the map
  useShareSurveyorPosition({
    enabled: isArpenteur && isLocating && !isSimulated && !!userLocation,
    session,
    position: userLocation,
    accuracy: locationAccuracy
  });
  const liveSurveyors = useLiveSurveyors(isAdmin);

  // Restore the Supabase session on load and react to sign-out / token expiration
  useEffect(() => {
    let isMounted = true;
    getCurrentSession().then((restored) => {
      if (!isMounted) return;
      setSession(restored);
      setIsAuthReady(true);
    });
    const unsubscribe = onSessionChange((next) => {
      if (isMounted && !next) {
        setSession(null);
        setAuthView('portal');
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const sessionUserId = session?.user?.id;

  // Cache version migration to clear obsolete local storage on all devices
  const CACHE_VERSION = 'v7_restore_concession_5326ha';
  useEffect(() => {
    try {
      const v = localStorage.getItem('geocadastre_cache_ver');
      if (v !== CACHE_VERSION) {
        localStorage.removeItem(STORAGE_KEY_CONCESSION);
        localStorage.setItem('geocadastre_cache_ver', CACHE_VERSION);
        const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
        const officialPoly = extractMainConcessionPolygon(geojson);
        if (officialPoly) {
          // Cloud save happens through the admin-only effect below
          setConcessionPolygon(officialPoly);
        }
      }
    } catch (e) {}
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);

  // Automatic Real-Time WebSockets Subscription & Polling Sync (signed-in users only:
  // RLS returns no rows to anonymous visitors, which must not wipe the local cache)
  useEffect(() => {
    if (!sessionUserId) return;
    let isMounted = true;

    const syncLatestData = async () => {
      try {
        // 1. Sync latest Concession from Supabase Cloud
        const cloudConcession = await fetchConcessionFromSupabase();
        if (isMounted && cloudConcession && cloudConcession.geometry) {
          const ring = cloudConcession.geometry.coordinates?.[0];
          if (Array.isArray(ring) && ring.length >= 20) {
            setConcessionPolygon((prev) => {
              const prevStr = JSON.stringify(prev);
              const cloudStr = JSON.stringify(cloudConcession);
              if (prevStr === cloudStr) return prev;
              try {
                localStorage.setItem(STORAGE_KEY_CONCESSION, cloudStr);
              } catch (e) {}
              return cloudConcession;
            });
          }
        }

        // 2. Sync latest Parcels from Supabase Cloud
        const cloudParcels = await fetchParcelsFromSupabase();
        if (isMounted && cloudParcels !== null) {
          setGlobalParcels((prev) => {
            if (prev && prev.length === cloudParcels.length && JSON.stringify(prev) === JSON.stringify(cloudParcels)) {
              return prev;
            }
            return cloudParcels;
          });
          setIsetechParcels((prev) => {
            if (prev && prev.length === cloudParcels.length && JSON.stringify(prev) === JSON.stringify(cloudParcels)) {
              return prev;
            }
            return cloudParcels;
          });
        }
      } catch (err) {
        console.warn('Auto-sync error:', err);
      }
    };

    // 1. Initial Cloud Sync
    syncLatestData();

    // 2. Realtime WebSocket Channel Subscription
    const channel = subscribeToRealtimeParcels(() => {
      if (isMounted) {
        syncLatestData();
      }
    });

    // 3. Periodic Background Polling Fallback (Every 25 Seconds)
    const intervalId = setInterval(() => {
      if (isMounted) {
        syncLatestData();
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [sessionUserId]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const cloudConcession = await fetchConcessionFromSupabase();
      if (cloudConcession && cloudConcession.geometry) {
        setConcessionPolygon(cloudConcession);
        try {
          localStorage.setItem(STORAGE_KEY_CONCESSION, JSON.stringify(cloudConcession));
        } catch (e) {}
      }

      const cloudParcels = await fetchParcelsFromSupabase();
      if (cloudParcels !== null) {
        setGlobalParcels(cloudParcels);
        setIsetechParcels(cloudParcels);
        logActivity({
          role: isArpenteur ? 'arpenteur' : 'admin',
          actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
          action: 'CLOUD_SYNC',
          actionLabel: 'Synchronisation Cloud Supabase réussie',
          details: `Concession et ${cloudParcels.length} parcelle(s) synchronisées avec le Cloud`,
          severity: 'info'
        });
      }
    } catch (e) {
      console.warn('Manual sync error:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // Save to LocalStorage & Supabase Cloud
  useEffect(() => {
    if (concessionPolygon && session?.role === 'admin') {
      try {
        localStorage.setItem(STORAGE_KEY_CONCESSION, JSON.stringify(concessionPolygon));
      } catch (e) {}
      saveConcessionToSupabase(concessionPolygon);
    }
  }, [concessionPolygon, session]);

  useEffect(() => {
    if (globalParcels !== null) {
      localStorage.setItem(STORAGE_KEY_PARCELS, JSON.stringify(globalParcels));
    }
  }, [globalParcels]);

  useEffect(() => {
    if (isetechParcels !== null) {
      localStorage.setItem(STORAGE_KEY_ISETECH, JSON.stringify(isetechParcels));
    }
  }, [isetechParcels]);

  const loadDefaultConcession = () => {
    const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
    const mainPoly = extractMainConcessionPolygon(geojson);
    setConcessionPolygon(mainPoly);
  };

  const currentParcels = useMemo(() => {
    return activeView === 'global' ? globalParcels : isetechParcels;
  }, [activeView, isetechParcels, globalParcels]);

  // Auth Success Handlers
  const handleAuthSuccess = (validSession) => {
    setSession(validSession);
    setAuthView('portal');
    setDrawTrigger(0);
    setEditConcessionTrigger(0);
    setSelectedParcel(null);
    setSelectedParcelIds([]);
  };

  const handleLogout = async () => {
    await logout(session);
    setSession(null);
    setAuthView('portal');
    setDrawTrigger(0);
    setEditConcessionTrigger(0);
    setSelectedParcel(null);
    setSelectedParcelIds([]);
    stopLocation();
  };

  // A write refused by the server is shown with its reason instead of failing silently
  const reportCloudRefusal = (ok, parcel) => {
    if (ok) return;
    const lotRef = parcel?.properties?.lotNumber || parcel?.id || '';
    alert(`Le lot ${lotRef} n'a pas pu être enregistré sur le serveur.

Raison : ${getLastCloudError() || 'inconnue (connexion Internet ?)'}

La modification reste visible sur cet appareil mais n'est pas partagée.`);
  };

  // Add new single parcel (Admin or Arpenteur)
  const handleAddParcel = (newParcel) => {
    if (isClientRole) return;
    setIsetechParcels((prev) => [newParcel, ...prev]);
    setGlobalParcels((prev) => [newParcel, ...prev]);
    saveParcelToSupabase(newParcel).then((ok) => reportCloudRefusal(ok, newParcel));
    setSelectedParcel(newParcel);
    setInitialFormPoints(null);

    const lotRef = newParcel.properties?.lotNumber || newParcel.id;
    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_CREATE',
      actionLabel: `Création de la parcelle ${lotRef}`,
      target: lotRef,
      details: `Superficie: ${newParcel.properties?.formattedHa || 'N/A'}, Statut: ${newParcel.properties?.status || 'disponible'}, Affectataire: ${newParcel.properties?.occupantName || 'Aucun'}`,
      severity: 'success'
    });
  };

  // Bulk add parcels imported from KML or GeoJSON (Admin only)
  const handleAddParcelsFromExternal = (newParcelsList) => {
    if (isClientRole) return;
    setIsetechParcels((prev) => [...newParcelsList, ...prev]);
    setGlobalParcels((prev) => [...newParcelsList, ...prev]);
    bulkSaveParcelsToSupabase(newParcelsList).then((ok) =>
      reportCloudRefusal(ok, { properties: { lotNumber: newParcelsList.map((p) => p.properties?.lotNumber).join(', ') } })
    );
    if (newParcelsList.length > 0) {
      setSelectedParcel(newParcelsList[0]);
    }

    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_IMPORT',
      actionLabel: `Import externe de ${newParcelsList.length} parcelle(s)`,
      target: `${newParcelsList.length} lots`,
      details: 'Lots importés depuis fichier GeoJSON/KML',
      severity: 'info'
    });
  };

  // Update existing parcel (Admin, or Arpenteur for attributes only: bornes are Admin only)
  const handleUpdateParcel = (updatedParcel) => {
    if (isClientRole) return;
    const existing = currentParcels.find((p) => p.id === updatedParcel.id);
    const verticesChanged = existing && JSON.stringify(existing.geometry?.coordinates) !== JSON.stringify(updatedParcel.geometry?.coordinates);
    if (verticesChanged && isArpenteur) {
      alert("Seul l'Administrateur est habilité à modifier les bornes d'une parcelle.");
      return;
    }
    const lotRef = updatedParcel.properties?.lotNumber || updatedParcel.id;
    const actorRole = isArpenteur ? 'arpenteur' : 'admin';
    const actorLabel = isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur';

    const updater = (prev) => prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p));
    setIsetechParcels(updater);
    setGlobalParcels(updater);
    saveParcelToSupabase(updatedParcel).then((ok) => reportCloudRefusal(ok, updatedParcel));
    setSelectedParcel(updatedParcel);

    if (verticesChanged) {
      logActivity({
        role: actorRole,
        actor: actorLabel,
        action: 'PARCEL_VERTICES_EDIT',
        actionLabel: `Bornage GPS modifié pour le lot ${lotRef}`,
        target: lotRef,
        details: `Bornage technique recalculé (${updatedParcel.geometry?.coordinates?.[0]?.length || 0} sommets). Superficie: ${updatedParcel.properties?.formattedHa || 'N/A'}`,
        severity: 'warning'
      });
    } else {
      logActivity({
        role: actorRole,
        actor: actorLabel,
        action: 'PARCEL_UPDATE',
        actionLabel: `Modification de la fiche du lot ${lotRef}`,
        target: lotRef,
        details: `Statut: ${updatedParcel.properties?.status}, Affectataire: ${updatedParcel.properties?.occupantName || 'Aucun'}`,
        severity: 'info'
      });
    }
  };

  // Delete single parcel (Admin only - Forbidden for Arpenteur)
  const handleDeleteParcel = (parcelId) => {
    if (isClientRole || isArpenteur) return;
    const deleted = currentParcels.find((p) => p.id === parcelId);
    const lotRef = deleted?.properties?.lotNumber || parcelId;

    setIsetechParcels((prev) => prev.filter((p) => p.id !== parcelId));
    setGlobalParcels((prev) => prev.filter((p) => p.id !== parcelId));
    deleteParcelFromSupabase(parcelId);
    setSelectedParcel(null);
    setSelectedParcelIds((prev) => prev.filter((id) => id !== parcelId));

    logActivity({
      role: 'admin',
      actor: 'Administrateur',
      action: 'PARCEL_DELETE',
      actionLabel: `Suppression du lot ${lotRef}`,
      target: lotRef,
      details: 'Parcelle définitivement retirée du cadastre',
      severity: 'danger'
    });
  };

  const handleToggleSelectParcel = (parcelId) => {
    setSelectedParcelIds((prev) =>
      prev.includes(parcelId) ? prev.filter((id) => id !== parcelId) : [...prev, parcelId]
    );
  };

  const handleSelectAllParcels = (allIds) => {
    setSelectedParcelIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedParcelIds([]);
  };

  // Bulk delete parcels (Admin only - Forbidden for Arpenteur)
  const handleBulkDeleteParcels = (idsToDelete) => {
    if (isClientRole || isArpenteur) return;
    setIsetechParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    setGlobalParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    bulkDeleteParcelsFromSupabase(idsToDelete);
    setSelectedParcel(null);
    setSelectedParcelIds([]);

    logActivity({
      role: 'admin',
      actor: 'Administrateur',
      action: 'PARCEL_BULK_DELETE',
      actionLabel: `Suppression groupée de ${idsToDelete.length} parcelle(s)`,
      target: `${idsToDelete.length} lots`,
      details: 'Suppression collective exécutée par la direction',
      severity: 'danger'
    });
  };

  const handleBulkChangeStatus = (idsToUpdate, newStatus) => {
    if (isClientRole) return;
    const updater = (prev) =>
      prev.map((p) => (idsToUpdate.includes(p.id) ? { ...p, properties: { ...p.properties, status: newStatus } } : p));

    setIsetechParcels(updater);
    setGlobalParcels(updater);

    const updatedParcels = currentParcels.filter((p) => idsToUpdate.includes(p.id)).map((p) => ({
      ...p,
      properties: { ...p.properties, status: newStatus }
    }));
    bulkSaveParcelsToSupabase(updatedParcels);

    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_BULK_STATUS',
      actionLabel: `Changement de statut en masse (${idsToUpdate.length} lots -> ${newStatus})`,
      target: `${idsToUpdate.length} lots`,
      details: `Statut modifié en : ${newStatus}`,
      severity: 'info'
    });
  };

  const handleBulkExportGeoJSON = (idsToExport) => {
    const selectedParcels = currentParcels.filter((p) => idsToExport.includes(p.id));
    const geojsonStr = exportParcelsToGeoJSON(selectedParcels);
    const blob = new Blob([geojsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Selection_${idsToExport.length}_Parcels_${new Date().toISOString().split('T')[0]}.geojson`;
    a.click();

    logActivity({
      role: isArpenteur ? 'arpenteur' : 'admin',
      actor: isArpenteur ? 'Arpenteur Géomètre' : 'Administrateur',
      action: 'PARCEL_EXPORT',
      actionLabel: `Export GeoJSON de ${idsToExport.length} parcelle(s)`,
      target: `${idsToExport.length} lots`,
      details: 'Export cartographique GeoJSON généré',
      severity: 'info'
    });
  };

  const handleOpenCreateFormWithPoints = (pointsList) => {
    if (isClientRole) return;
    setInitialFormPoints(pointsList);
    setIsFormOpen(true);
  };

  const handleExploreSubZone = (zoneId) => {
    if (zones.some((z) => z.id === zoneId)) {
      setActiveView(zoneId);
      setSelectedParcel(null);
      setSelectedParcelIds([]);
    }
  };

  const handleReturnToGlobal = () => {
    setActiveView('global');
    setSelectedParcel(null);
    setSelectedParcelIds([]);
  };

  const handleClearAllData = async () => {
    if (isClientRole || isArpenteur) return;
    if (confirm('Voulez-vous supprimer définitivement TOUTES les parcelles (Local & Supabase Cloud) ?')) {
      localStorage.setItem(STORAGE_KEY_PARCELS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_ISETECH, JSON.stringify([]));
      setGlobalParcels([]);
      setIsetechParcels([]);
      setSelectedParcel(null);
      setSelectedParcelIds([]);
      await deleteAllParcelsInSupabase();

      logActivity({
        role: 'admin',
        actor: 'Administrateur',
        action: 'DATA_PURGE',
        actionLabel: 'Purge intégrale du cadastre',
        target: 'Toutes les parcelles',
        details: 'Suppression totale des parcelles effectuée (Local & Supabase)',
        severity: 'danger'
      });
    }
  };

  const handleUpdateConcessionPolygon = (newPolygon) => {
    if (isClientRole || isArpenteur) {
      alert("Seul l'Administrateur en chef est habilité à ajuster les bornes de la concession.");
      return;
    }
    setConcessionPolygon(newPolygon);
    try {
      localStorage.setItem(STORAGE_KEY_CONCESSION, JSON.stringify(newPolygon));
      saveConcessionToSupabase(newPolygon);
    } catch (e) {
      console.warn('Erreur sauvegarde concession:', e);
    }

    const area = calculateArea(newPolygon);
    const verticesCount = newPolygon?.geometry?.coordinates?.[0]?.length
      ? newPolygon.geometry.coordinates[0].length - 1
      : 0;

    logActivity({
      role: 'admin',
      actor: session?.user?.email || 'Administrateur',
      action: 'CONCESSION_VERTICES_EDIT',
      actionLabel: 'Ajustement officiel des bornes de la concession',
      target: "Périmètre Manuel J. d'Oliveira",
      details: `${verticesCount} bornes calibrées, nouvelle superficie: ${area.formattedHa}`,
      severity: 'warning'
    });
  };

  const handleResetConcession = () => {
    if (isClientRole || isArpenteur) return;
    if (confirm('Voulez-vous réinitialiser le tracé du périmètre officiel de la concession ?')) {
      localStorage.removeItem(STORAGE_KEY_CONCESSION);
      loadDefaultConcession();

      logActivity({
        role: 'admin',
        actor: 'Administrateur',
        action: 'CONCESSION_RESET',
        actionLabel: 'Réinitialisation du périmètre de la concession',
        target: 'Périmètre Manuel J. d\'Oliveira (5 310 ha)',
        details: 'Restauration du tracé géodésique officiel par défaut',
        severity: 'warning'
      });
    }
  };

  const handleSyncCloud = async () => {
    const cloudParcels = await fetchParcelsFromSupabase();
    if (cloudParcels !== null) {
      setGlobalParcels(cloudParcels);
    } else {
      await bulkSaveParcelsToSupabase(globalParcels);
    }
  };

  // --- RESTORING SESSION ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen h-[100dvh] w-full bg-slate-900 flex items-center justify-center text-slate-400 text-xs font-sans">
        Vérification de la session…
      </div>
    );
  }

  // --- UNAUTHENTICATED GATE (Portal Selection / Professional Login) ---
  if (!session) {
    if (authView === 'admin_login') {
      return (
        <AdminLoginModal
          onSuccess={handleAuthSuccess}
          onBack={() => setAuthView('portal')}
        />
      );
    }

    return (
      <PortalSelectionModal
        onSelectAdmin={() => setAuthView('admin_login')}
      />
    );
  }

  // --- AUTHENTICATED APP WORKSPACE ---
  return (
    <div className="min-h-screen h-screen h-[100dvh] w-full bg-slate-100 font-sans flex flex-col antialiased text-slate-800 overflow-hidden select-none">
      {/* Top Header Navbar depending on role */}
      {isClientRole ? (
        <ClientNavbar
          onLogout={handleLogout}
          onSync={handleManualSync}
          isSyncing={isSyncing}
        />
      ) : (
        <Navbar
          onOpenCreateForm={() => {
            setInitialFormPoints(null);
            setIsFormOpen(true);
          }}
          onOpenKmlImporter={() => setIsKmlImporterOpen(true)}
          onOpenKmlParcelImporter={() => setIsKmlParcelImporterOpen(true)}
          onOpenCadastreBatch={() => setIsCadastreBatchOpen(true)}
          onOpenGeoJsonImporter={() => setIsGeoJsonImporterOpen(true)}
          parcels={currentParcels}
          concessionPolygon={concessionPolygon}
          onResetConcession={handleResetConcession}
          onClearAllData={handleClearAllData}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenSecurityModal={() => setIsAdminSecurityOpen(true)}
          onOpenAuditModal={() => setIsAuditLogOpen(true)}
          onLogout={handleLogout}
          onSync={handleManualSync}
          isSyncing={isSyncing}
          onToggleLocation={handleToggleLocation}
          isLocating={isLocating}
          locationZoneInfo={locationAnalysis.zoneInfo}
          isArpenteur={isArpenteur}
          onStartDrawing={() => {
            setDrawingForZone(false);
            setDrawTrigger((prev) => prev + 1);
          }}
          onStartEditConcession={() => setEditConcessionTrigger((prev) => prev + 1)}
          activeView={activeView}
          zones={zones}
          onSelectView={(view) => (view === 'global' ? handleReturnToGlobal() : handleExploreSubZone(view))}
          onOpenZoneManager={isAdmin ? () => setIsZoneManagerOpen(true) : undefined}
        />
      )}

      {/* Admin Real-Time GPS HUD Banner */}
      {!isClientRole && isLocating && userLocation && (
        <AdminLocationHUD
          userLocation={userLocation}
          locationAccuracy={locationAccuracy}
          locationZoneInfo={locationAnalysis.zoneInfo}
          isInConcession={locationAnalysis.isInConcession}
          insideZoneName={locationAnalysis.insideZoneName}
          locatedParcel={locationAnalysis.locatedParcel}
          isSimulated={isSimulated}
          onRecenter={handleRecenterLocation}
          onSimulate={handleSimulateLocation}
          onClose={stopLocation}
        />
      )}

      {/* Dashboard Analytics */}
      <Dashboard
        concessionPolygon={activeZone || concessionPolygon}
        parcels={currentParcels}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden min-h-0">
        <main className="flex-1 h-full w-full relative transition-all duration-300 min-h-0">
          <MapView
            concessionPolygon={concessionPolygon}
            subZones={zones}
            drawingForZone={drawingForZone}
            onCreateZoneFromPoints={
              isAdmin
                ? (points) => {
                    setDrawingForZone(false);
                    setZoneDraftPoints(points);
                    setIsZoneManagerOpen(true);
                  }
                : undefined
            }
            parcels={currentParcels}
            selectedParcel={selectedParcel}
            selectedParcelIds={selectedParcelIds}
            onSelectParcel={(p) => setSelectedParcel(p)}
            onUpdateParcel={handleUpdateParcel}
            onOpenCreateFormWithPoints={handleOpenCreateFormWithPoints}
            activeView={activeView}
            onExploreSubZone={handleExploreSubZone}
            onReturnToGlobal={handleReturnToGlobal}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isVisitorMode={isClientRole}
            userLocation={userLocation}
            locationAccuracy={locationAccuracy}
            locationZoneInfo={locationAnalysis.zoneInfo}
            isInConcession={locationAnalysis.isInConcession}
            locatedParcel={locationAnalysis.locatedParcel}
            flyToTrigger={flyToTrigger}
            drawTrigger={drawTrigger}
            onToggleLocation={handleToggleLocation}
            isLocating={isLocating}
            onUpdateConcessionPolygon={handleUpdateConcessionPolygon}
            isAdmin={isAdmin}
            isArpenteur={isArpenteur}
            liveSurveyors={liveSurveyors}
            editConcessionTrigger={editConcessionTrigger}
            onCancelConcessionEditing={() => setEditConcessionTrigger(0)}
          />
        </main>

        {/* Desktop Sidebar */}
        {!isSidebarCollapsed && !isClientRole && (
          <div className="hidden md:flex flex-col h-full z-10">
            <ParcelList
              parcels={currentParcels}
              selectedParcel={selectedParcel}
              selectedParcelIds={selectedParcelIds}
              onSelectParcel={(p) => setSelectedParcel(p)}
              onToggleSelectParcel={handleToggleSelectParcel}
              onSelectAllParcels={handleSelectAllParcels}
              onClearSelection={handleClearSelection}
              onBulkDelete={handleBulkDeleteParcels}
              onBulkChangeStatus={handleBulkChangeStatus}
              onBulkExportGeoJSON={handleBulkExportGeoJSON}
              onOpenCreateForm={() => {
                setInitialFormPoints(null);
                setIsFormOpen(true);
              }}
              onToggleCollapse={() => setIsSidebarCollapsed(true)}
              isVisitorMode={false}
              isArpenteur={isArpenteur}
            />
          </div>
        )}
      </div>

      {/* Mobile Drawer (Bottom Sheet) for ParcelList */}
      {!isSidebarCollapsed && !isClientRole && (
        <div className="md:hidden fixed inset-0 z-[1250] flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setIsSidebarCollapsed(true)}
          />
          <div className="relative z-10 w-full max-h-[85vh] h-[82vh] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250">
            <div
              className="w-full flex justify-center py-2.5 bg-slate-100/90 border-b border-slate-200 cursor-pointer"
              onClick={() => setIsSidebarCollapsed(true)}
            >
              <div className="w-12 h-1.5 rounded-full bg-slate-400/60"></div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <ParcelList
                parcels={currentParcels}
                selectedParcel={selectedParcel}
                selectedParcelIds={selectedParcelIds}
                onSelectParcel={(p) => {
                  setSelectedParcel(p);
                  setIsSidebarCollapsed(true);
                }}
                onToggleSelectParcel={handleToggleSelectParcel}
                onSelectAllParcels={handleSelectAllParcels}
                onClearSelection={handleClearSelection}
                onBulkDelete={handleBulkDeleteParcels}
                onBulkChangeStatus={handleBulkChangeStatus}
                onBulkExportGeoJSON={handleBulkExportGeoJSON}
                onOpenCreateForm={() => {
                  setInitialFormPoints(null);
                  setIsFormOpen(true);
                }}
                onToggleCollapse={() => setIsSidebarCollapsed(true)}
                isVisitorMode={false}
                isArpenteur={isArpenteur}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Dock Bar */}
      {!isClientRole && (
        <nav
          aria-label="Navigation principale"
          className="md:hidden fixed bottom-0 inset-x-0 z-[1000] bg-white border-t border-slate-200 px-2 pt-1.5 grid grid-cols-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {[
            {
              key: 'map',
              label: 'Carte',
              icon: <Globe className="w-5 h-5" />,
              active: isSidebarCollapsed,
              onClick: () => setIsSidebarCollapsed(true)
            },
            {
              key: 'draw',
              label: 'Tracer',
              icon: <Pencil className="w-5 h-5" />,
              active: false,
              onClick: () => {
                setIsSidebarCollapsed(true);
                setDrawingForZone(false);
                setDrawTrigger((prev) => prev + 1);
              }
            },
            {
              key: 'gps',
              label: isLocating ? 'GPS actif' : 'GPS',
              icon: <Navigation className="w-5 h-5" />,
              active: isLocating,
              onClick: handleToggleLocation
            },
            {
              key: 'list',
              label: `Registre (${currentParcels.length})`,
              icon: <Layers3 className="w-5 h-5" />,
              active: !isSidebarCollapsed,
              onClick: () => setIsSidebarCollapsed(false)
            }
          ].map((item) => (
            <button
              key={item.key}
              onClick={item.onClick}
              aria-pressed={item.active}
              className={`flex flex-col items-center gap-0.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                item.active ? 'text-brand-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-12 h-7 rounded-full flex items-center justify-center transition-colors ${item.active ? 'bg-brand-50' : ''}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* Lazy Loaded Admin Modals & Detail Views */}
      {!isClientRole && (
        <Suspense fallback={null}>
          {selectedParcel && (
            <ParcelModal
              parcel={selectedParcel}
              onClose={() => setSelectedParcel(null)}
              onUpdateParcel={handleUpdateParcel}
              onDeleteParcel={handleDeleteParcel}
              isVisitorMode={false}
              isArpenteur={isArpenteur}
              concessionPolygon={concessionPolygon}
            />
          )}

          {isSupabaseModalOpen && (
            <SupabaseModal
              isOpen={isSupabaseModalOpen}
              onClose={() => setIsSupabaseModalOpen(false)}
              onSyncCloud={handleSyncCloud}
            />
          )}

          {isFormOpen && (
            <ParcelFormModal
              isOpen={isFormOpen}
              onClose={() => setIsFormOpen(false)}
              onAddParcel={handleAddParcel}
              concessionPolygon={concessionPolygon}
              existingParcels={currentParcels}
              initialPoints={initialFormPoints}
              onStartDrawing={() => {
                setIsFormOpen(false);
                setDrawingForZone(false);
                setDrawTrigger((prev) => prev + 1);
              }}
              onOpenCadastreBatch={() => {
                setIsFormOpen(false);
                setIsCadastreBatchOpen(true);
              }}
            />
          )}

          {isZoneManagerOpen && isAdmin && (
            <ZoneManagerModal
              isOpen={isZoneManagerOpen}
              onClose={() => {
                setIsZoneManagerOpen(false);
                setZoneDraftPoints(null);
              }}
              zones={zones}
              concessionPolygon={concessionPolygon}
              initialPoints={zoneDraftPoints}
              onAddZone={async (zone) => {
                await addZone(zone);
                logActivity({
                  role: 'admin',
                  actor: 'Administrateur',
                  action: 'ZONE_CREATE',
                  actionLabel: `Zone ajoutée : ${zone.properties.name}`,
                  target: zone.properties.name,
                  details: `Zone de la concession ajoutée (${zone.geometry.coordinates[0].length - 1} bornes)`,
                  severity: 'info'
                });
              }}
              onRemoveZone={async (id) => {
                const zone = zones.find((z) => z.id === id);
                await removeZone(id);
                if (activeView === id) handleReturnToGlobal();
                logActivity({
                  role: 'admin',
                  actor: 'Administrateur',
                  action: 'ZONE_DELETE',
                  actionLabel: `Zone supprimée : ${zone?.properties?.name || id}`,
                  target: zone?.properties?.name || id,
                  details: 'Zone retirée de la carte (les parcelles sont conservées)',
                  severity: 'warning'
                });
              }}
              onStartDrawing={() => {
                setIsZoneManagerOpen(false);
                setZoneDraftPoints(null);
                setDrawingForZone(true);
                setDrawTrigger((prev) => prev + 1);
              }}
            />
          )}

          {isCadastreBatchOpen && (
            <CadastreBatchModal
              isOpen={isCadastreBatchOpen}
              onClose={() => setIsCadastreBatchOpen(false)}
              onAddParcels={handleAddParcelsFromExternal}
              concessionPolygon={concessionPolygon}
              existingParcels={currentParcels}
            />
          )}

          {isGeoJsonImporterOpen && (
            <GeoJsonImporterModal
              isOpen={isGeoJsonImporterOpen}
              onClose={() => setIsGeoJsonImporterOpen(false)}
              onAddParcels={handleAddParcelsFromExternal}
            />
          )}

          {isKmlParcelImporterOpen && (
            <KmlParcelImporterModal
              isOpen={isKmlParcelImporterOpen}
              onClose={() => setIsKmlParcelImporterOpen(false)}
              onAddParcels={handleAddParcelsFromExternal}
              concessionPolygon={concessionPolygon}
            />
          )}

          {isKmlImporterOpen && (
            <KmlImporter
              isOpen={isKmlImporterOpen}
              onClose={() => setIsKmlImporterOpen(false)}
              onSetConcession={(poly) => setConcessionPolygon(poly)}
            />
          )}

          {isAdminSecurityOpen && (
            <AdminSecurityModal
              isOpen={isAdminSecurityOpen}
              onClose={() => setIsAdminSecurityOpen(false)}
              onLogout={handleLogout}
              session={session}
            />
          )}

          {isAuditLogOpen && (
            <AuditLogModal
              isOpen={isAuditLogOpen}
              onClose={() => setIsAuditLogOpen(false)}
            />
          )}
        </Suspense>
      )}

      {/* PWA Mobile Add to Home Screen Prompt */}
      <PwaInstallPrompt />
    </div>
  );
}

