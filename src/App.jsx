import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import ParcelList from './components/ParcelList';
import ParcelModal from './components/ParcelModal';
import ParcelFormModal from './components/ParcelFormModal';
import KmlImporter from './components/KmlImporter';
import KmlParcelImporterModal from './components/KmlParcelImporterModal';
import GeoJsonImporterModal from './components/GeoJsonImporterModal';
import SupabaseModal from './components/SupabaseModal';

import { DEFAULT_KML_DATA } from './data/defaultConcession';
import { INITIAL_PARCELS } from './data/initialParcels';
import { ISETECH_SUB_PARCELS } from './data/isetechSubParcels';
import { parseKMLToGeoJSON, extractMainConcessionPolygon, extractSubZones } from './utils/kmlParser';
import { calculateArea, exportParcelsToGeoJSON } from './utils/geoUtils';
import { Layers3, ArrowLeft } from 'lucide-react';

import {
  fetchParcelsFromSupabase,
  saveParcelToSupabase,
  deleteParcelFromSupabase,
  bulkSaveParcelsToSupabase,
  bulkDeleteParcelsFromSupabase,
  deleteAllParcelsInSupabase,
  saveConcessionToSupabase,
  subscribeToRealtimeParcels
} from './services/supabaseClient';

const STORAGE_KEY_PARCELS = 'geocadastre_parcels_v3';
const STORAGE_KEY_ISETECH = 'geocadastre_isetech_parcels_v3';
const STORAGE_KEY_CONCESSION = 'geocadastre_concession_v3';

function getInitialConcession() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONCESSION);
    if (saved) return JSON.parse(saved);
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
  // Visitor Read-Only Mode State
  const [isVisitorMode, setIsVisitorMode] = useState(false);

  // Navigation View Mode: 'global' | 'isetech'
  const [activeView, setActiveView] = useState('global');

  // Sidebar Collapsed state for 100% Full Width Map
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Synchronous INSTANT initialization
  const [concessionPolygon, setConcessionPolygon] = useState(getInitialConcession);
  const [subZones, setSubZones] = useState(() => {
    const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
    return extractSubZones(geojson);
  });

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
  const [isGeoJsonImporterOpen, setIsGeoJsonImporterOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Automatic Real-Time WebSockets Subscription & Polling Sync
  useEffect(() => {
    let isMounted = true;

    const syncLatestParcels = async () => {
      try {
        const cloudParcels = await fetchParcelsFromSupabase();
        if (isMounted && cloudParcels !== null) {
          setGlobalParcels(cloudParcels);
        }
      } catch (err) {
        console.warn('Auto-sync error:', err);
      }
    };

    // 1. Initial Cloud Sync
    syncLatestParcels();

    // 2. Realtime WebSocket Channel Subscription
    const channel = subscribeToRealtimeParcels(() => {
      if (isMounted) {
        syncLatestParcels();
      }
    });

    // 3. Periodic Background Polling Sync (Every 8 Seconds)
    const intervalId = setInterval(() => {
      if (isMounted) {
        syncLatestParcels();
      }
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  // Save to LocalStorage & Supabase Cloud
  useEffect(() => {
    if (concessionPolygon) {
      localStorage.setItem(STORAGE_KEY_CONCESSION, JSON.stringify(concessionPolygon));
      saveConcessionToSupabase(concessionPolygon);
    }
  }, [concessionPolygon]);

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
    const subs = extractSubZones(geojson);
    setConcessionPolygon(mainPoly);
    setSubZones(subs);
  };

  const currentParcels = useMemo(() => {
    return activeView === 'isetech' ? isetechParcels : globalParcels;
  }, [activeView, isetechParcels, globalParcels]);

  // Add new single parcel
  const handleAddParcel = (newParcel) => {
    if (isVisitorMode) return;
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => [newParcel, ...prev]);
    } else {
      setGlobalParcels((prev) => [newParcel, ...prev]);
      saveParcelToSupabase(newParcel);
    }
    setSelectedParcel(newParcel);
    setInitialFormPoints(null);
  };

  // Bulk add parcels imported from KML or GeoJSON
  const handleAddParcelsFromExternal = (newParcelsList) => {
    if (isVisitorMode) return;
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => [...newParcelsList, ...prev]);
    } else {
      setGlobalParcels((prev) => [...newParcelsList, ...prev]);
      bulkSaveParcelsToSupabase(newParcelsList);
    }
    if (newParcelsList.length > 0) {
      setSelectedParcel(newParcelsList[0]);
    }
  };

  // Update existing parcel
  const handleUpdateParcel = (updatedParcel) => {
    if (isVisitorMode) return;
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p)));
    } else {
      setGlobalParcels((prev) => prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p)));
      saveParcelToSupabase(updatedParcel);
    }
    setSelectedParcel(updatedParcel);
  };

  // Delete single parcel
  const handleDeleteParcel = (parcelId) => {
    if (isVisitorMode) return;
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.filter((p) => p.id !== parcelId));
    } else {
      setGlobalParcels((prev) => prev.filter((p) => p.id !== parcelId));
      deleteParcelFromSupabase(parcelId);
    }
    setSelectedParcel(null);
    setSelectedParcelIds((prev) => prev.filter((id) => id !== parcelId));
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

  const handleBulkDeleteParcels = (idsToDelete) => {
    if (isVisitorMode) return;
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    } else {
      setGlobalParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
      bulkDeleteParcelsFromSupabase(idsToDelete);
    }
    setSelectedParcel(null);
    setSelectedParcelIds([]);
  };

  const handleBulkChangeStatus = (idsToUpdate, newStatus) => {
    if (isVisitorMode) return;
    const updater = (prev) =>
      prev.map((p) => (idsToUpdate.includes(p.id) ? { ...p, properties: { ...p.properties, status: newStatus } } : p));

    if (activeView === 'isetech') {
      setIsetechParcels(updater);
    } else {
      setGlobalParcels(updater);
      const updatedParcels = globalParcels.filter((p) => idsToUpdate.includes(p.id)).map((p) => ({
        ...p,
        properties: { ...p.properties, status: newStatus }
      }));
      bulkSaveParcelsToSupabase(updatedParcels);
    }
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
  };

  const handleOpenCreateFormWithPoints = (pointsList) => {
    if (isVisitorMode) return;
    setInitialFormPoints(pointsList);
    setIsFormOpen(true);
  };

  const handleExploreSubZone = (zoneId) => {
    if (zoneId === 'isetech') {
      setActiveView('isetech');
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
    if (isVisitorMode) return;
    if (confirm('Voulez-vous supprimer définitivement TOUTES les parcelles (Local & Supabase Cloud) ?')) {
      localStorage.setItem(STORAGE_KEY_PARCELS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEY_ISETECH, JSON.stringify([]));
      setGlobalParcels([]);
      setIsetechParcels([]);
      setSelectedParcel(null);
      setSelectedParcelIds([]);
      await deleteAllParcelsInSupabase();
    }
  };

  const handleResetData = () => {
    if (isVisitorMode) return;
    if (confirm('Voulez-vous recharger les données démo d\'origine ?')) {
      localStorage.removeItem(STORAGE_KEY_PARCELS);
      localStorage.removeItem(STORAGE_KEY_ISETECH);
      localStorage.removeItem(STORAGE_KEY_CONCESSION);
      setGlobalParcels(INITIAL_PARCELS);
      setIsetechParcels(ISETECH_SUB_PARCELS);
      setActiveView('global');
      loadDefaultConcession();
      setSelectedParcel(null);
      setSelectedParcelIds([]);
      setInitialFormPoints(null);
      bulkSaveParcelsToSupabase(INITIAL_PARCELS);
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

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col antialiased text-slate-800">
      {/* Top Navbar Header */}
      <Navbar
        onOpenCreateForm={() => {
          if (isVisitorMode) return;
          setInitialFormPoints(null);
          setIsFormOpen(true);
        }}
        onOpenKmlImporter={() => !isVisitorMode && setIsKmlImporterOpen(true)}
        onOpenKmlParcelImporter={() => !isVisitorMode && setIsKmlParcelImporterOpen(true)}
        onOpenGeoJsonImporter={() => !isVisitorMode && setIsGeoJsonImporterOpen(true)}
        parcels={currentParcels}
        concessionPolygon={concessionPolygon}
        onResetData={handleResetData}
        onClearAllData={handleClearAllData}
        isVisitorMode={isVisitorMode}
        onToggleVisitorMode={() => setIsVisitorMode(!isVisitorMode)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
      />

      {/* Sub-cadastre Breadcrumb Alert Bar */}
      {activeView === 'isetech' && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between gap-3 text-slate-200 text-xs">
          <div className="flex items-center gap-2 font-semibold">
            <Layers3 className="w-4 h-4 text-cyan-400" />
            <span>
              Sous-cadastre spécialisé : <strong className="text-white uppercase">ZONE ISETECH (1 002,61 ha)</strong>
            </span>
          </div>
          <button
            onClick={handleReturnToGlobal}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded flex items-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour Vue Périmètre Global
          </button>
        </div>
      )}

      {/* Dashboard Analytics */}
      <Dashboard
        concessionPolygon={activeView === 'isetech' ? subZones[0] || concessionPolygon : concessionPolygon}
        parcels={currentParcels}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        <main className="flex-1 h-[600px] md:h-auto relative transition-all duration-300">
          <MapView
            concessionPolygon={concessionPolygon}
            subZones={subZones}
            parcels={currentParcels}
            selectedParcel={selectedParcel}
            selectedParcelIds={selectedParcelIds}
            onSelectParcel={(p) => setSelectedParcel(p)}
            onOpenCreateFormWithPoints={handleOpenCreateFormWithPoints}
            activeView={activeView}
            onExploreSubZone={handleExploreSubZone}
            onReturnToGlobal={handleReturnToGlobal}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            isVisitorMode={isVisitorMode}
          />
        </main>

        {!isSidebarCollapsed && (
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
              if (isVisitorMode) return;
              setInitialFormPoints(null);
              setIsFormOpen(true);
            }}
            onToggleCollapse={() => setIsSidebarCollapsed(true)}
            isVisitorMode={isVisitorMode}
          />
        )}
      </div>

      {/* Selected Parcel Detail Sidebar / Modal */}
      <ParcelModal
        parcel={selectedParcel}
        onClose={() => setSelectedParcel(null)}
        onUpdateParcel={handleUpdateParcel}
        onDeleteParcel={handleDeleteParcel}
        isVisitorMode={isVisitorMode}
      />

      {/* Supabase Cloud Sync Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onSyncCloud={handleSyncCloud}
      />

      {/* Modals */}
      {!isVisitorMode && (
        <>
          <ParcelFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            onAddParcel={handleAddParcel}
            concessionPolygon={concessionPolygon}
            existingParcels={currentParcels}
            initialPoints={initialFormPoints}
          />

          <GeoJsonImporterModal
            isOpen={isGeoJsonImporterOpen}
            onClose={() => setIsGeoJsonImporterOpen(false)}
            onAddParcels={handleAddParcelsFromExternal}
          />

          <KmlParcelImporterModal
            isOpen={isKmlParcelImporterOpen}
            onClose={() => setIsKmlParcelImporterOpen(false)}
            onAddParcels={handleAddParcelsFromExternal}
            concessionPolygon={concessionPolygon}
          />

          <KmlImporter
            isOpen={isKmlImporterOpen}
            onClose={() => setIsKmlImporterOpen(false)}
            onSetConcession={(poly) => setConcessionPolygon(poly)}
          />
        </>
      )}
    </div>
  );
}
