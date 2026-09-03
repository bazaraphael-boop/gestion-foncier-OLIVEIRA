import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import ParcelList from './components/ParcelList';
import ParcelModal from './components/ParcelModal';
import ParcelFormModal from './components/ParcelFormModal';
import KmlImporter from './components/KmlImporter';
import KmlParcelImporterModal from './components/KmlParcelImporterModal';
import GeoJsonImporterModal from './components/GeoJsonImporterModal';

import { DEFAULT_KML_DATA } from './data/defaultConcession';
import { INITIAL_PARCELS } from './data/initialParcels';
import { ISETECH_SUB_PARCELS } from './data/isetechSubParcels';
import { parseKMLToGeoJSON, extractMainConcessionPolygon, extractSubZones } from './utils/kmlParser';
import { calculateArea, exportParcelsToGeoJSON } from './utils/geoUtils';
import { Layers3, ArrowLeft, PanelRightClose, PanelRightOpen, Layers } from 'lucide-react';

const STORAGE_KEY_PARCELS = 'geocadastre_parcels_v3';
const STORAGE_KEY_CONCESSION = 'geocadastre_concession_v3';

export default function App() {
  // Navigation View Mode: 'global' | 'isetech'
  const [activeView, setActiveView] = useState('global');

  // Sidebar Collapsed state for 100% Full Width Map
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Concession polygon state & Sub-zones (isetech)
  const [concessionPolygon, setConcessionPolygon] = useState(null);
  const [subZones, setSubZones] = useState([]);

  // Main Parcels array state & Sub-parcels array state
  const [globalParcels, setGlobalParcels] = useState([]);
  const [isetechParcels, setIsetechParcels] = useState(ISETECH_SUB_PARCELS);

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

  // Initialize Concession & Parcels from LocalStorage or Defaults
  useEffect(() => {
    // 1. Load Concession
    const savedConcession = localStorage.getItem(STORAGE_KEY_CONCESSION);
    if (savedConcession) {
      try {
        setConcessionPolygon(JSON.parse(savedConcession));
      } catch (e) {
        loadDefaultConcession();
      }
    } else {
      loadDefaultConcession();
    }

    // 2. Load Parcels with Auto-Healing for calculated surface areas
    const savedParcels = localStorage.getItem(STORAGE_KEY_PARCELS);
    if (savedParcels) {
      try {
        const loaded = JSON.parse(savedParcels);
        const healed = loaded.map((p) => {
          const area = calculateArea(p);
          return {
            ...p,
            properties: {
              ...p.properties,
              areaSqM: area.sqMeters > 0 ? area.sqMeters : p.properties.areaSqM || 10026098,
              areaHa: area.hectares > 0 ? area.hectares : p.properties.areaHa || 1002.61,
              formattedSqM: area.sqMeters > 0 ? area.formattedSqM : p.properties.formattedSqM || '10 026 098 m²',
              formattedHa: area.hectares > 0 ? area.formattedHa : p.properties.formattedHa || '1 002,61 ha'
            }
          };
        });
        setGlobalParcels(healed);
      } catch (e) {
        setGlobalParcels(INITIAL_PARCELS);
      }
    } else {
      setGlobalParcels(INITIAL_PARCELS);
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (concessionPolygon) {
      localStorage.setItem(STORAGE_KEY_CONCESSION, JSON.stringify(concessionPolygon));
    }
  }, [concessionPolygon]);

  useEffect(() => {
    if (globalParcels.length > 0) {
      localStorage.setItem(STORAGE_KEY_PARCELS, JSON.stringify(globalParcels));
    }
  }, [globalParcels]);

  const loadDefaultConcession = () => {
    const geojson = parseKMLToGeoJSON(DEFAULT_KML_DATA);
    const mainPoly = extractMainConcessionPolygon(geojson);
    const subs = extractSubZones(geojson);
    setConcessionPolygon(mainPoly);
    setSubZones(subs);
  };

  // Active parcels depending on view mode
  const currentParcels = activeView === 'isetech' ? isetechParcels : globalParcels;

  // Add new single parcel
  const handleAddParcel = (newParcel) => {
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => [newParcel, ...prev]);
    } else {
      setGlobalParcels((prev) => [newParcel, ...prev]);
    }
    setSelectedParcel(newParcel);
    setInitialFormPoints(null);
  };

  // Bulk add parcels imported from KML or GeoJSON
  const handleAddParcelsFromExternal = (newParcelsList) => {
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => [...newParcelsList, ...prev]);
    } else {
      setGlobalParcels((prev) => [...newParcelsList, ...prev]);
    }
    if (newParcelsList.length > 0) {
      setSelectedParcel(newParcelsList[0]);
    }
  };

  // Update existing parcel
  const handleUpdateParcel = (updatedParcel) => {
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p)));
    } else {
      setGlobalParcels((prev) => prev.map((p) => (p.id === updatedParcel.id ? updatedParcel : p)));
    }
    setSelectedParcel(updatedParcel);
  };

  // Delete single parcel
  const handleDeleteParcel = (parcelId) => {
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.filter((p) => p.id !== parcelId));
    } else {
      setGlobalParcels((prev) => prev.filter((p) => p.id !== parcelId));
    }
    setSelectedParcel(null);
    setSelectedParcelIds((prev) => prev.filter((id) => id !== parcelId));
  };

  // --- MULTI-SELECTION BATCH ACTIONS ---
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
    if (activeView === 'isetech') {
      setIsetechParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    } else {
      setGlobalParcels((prev) => prev.filter((p) => !idsToDelete.includes(p.id)));
    }
    setSelectedParcel(null);
    setSelectedParcelIds([]);
  };

  const handleBulkChangeStatus = (idsToUpdate, newStatus) => {
    const updater = (prev) =>
      prev.map((p) => (idsToUpdate.includes(p.id) ? { ...p, properties: { ...p.properties, status: newStatus } } : p));

    if (activeView === 'isetech') {
      setIsetechParcels(updater);
    } else {
      setGlobalParcels(updater);
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

  // Open Form with pre-drawn points from map
  const handleOpenCreateFormWithPoints = (pointsList) => {
    setInitialFormPoints(pointsList);
    setIsFormOpen(true);
  };

  // Switch View to ISETECH Sub-cadastre
  const handleExploreSubZone = (zoneId) => {
    if (zoneId === 'isetech') {
      setActiveView('isetech');
      setSelectedParcel(null);
      setSelectedParcelIds([]);
    }
  };

  // Switch View back to Global Concession
  const handleReturnToGlobal = () => {
    setActiveView('global');
    setSelectedParcel(null);
    setSelectedParcelIds([]);
  };

  // Reset to initial demo data
  const handleResetData = () => {
    if (confirm('Voulez-vous réinitialiser toutes les données aux valeurs démo d\'origine ?')) {
      localStorage.removeItem(STORAGE_KEY_PARCELS);
      localStorage.removeItem(STORAGE_KEY_CONCESSION);
      setGlobalParcels(INITIAL_PARCELS);
      setIsetechParcels(ISETECH_SUB_PARCELS);
      setActiveView('global');
      loadDefaultConcession();
      setSelectedParcel(null);
      setSelectedParcelIds([]);
      setInitialFormPoints(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans flex flex-col antialiased text-slate-800">
      {/* Top Navbar Header */}
      <Navbar
        onOpenCreateForm={() => {
          setInitialFormPoints(null);
          setIsFormOpen(true);
        }}
        onOpenKmlImporter={() => setIsKmlImporterOpen(true)}
        onOpenKmlParcelImporter={() => setIsKmlParcelImporterOpen(true)}
        onOpenGeoJsonImporter={() => setIsGeoJsonImporterOpen(true)}
        parcels={currentParcels}
        concessionPolygon={concessionPolygon}
        onResetData={handleResetData}
      />

      {/* Sub-cadastre Breadcrumb Alert Bar when inside ISETECH View */}
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

      {/* Main Dashboard & Analytics Bar */}
      <Dashboard
        concessionPolygon={activeView === 'isetech' ? subZones[0] || concessionPolygon : concessionPolygon}
        parcels={currentParcels}
      />

      {/* Main Workspace (Map + Collapsible Parcel Sidebar List) */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Interactive Map Area */}
        <main className="flex-1 h-[600px] md:h-auto relative transition-all duration-300">
          <MapView
            concessionPolygon={concessionPolygon}
            subZones={subZones}
            parcels={currentParcels}
            selectedParcel={selectedParcel}
            selectedParcelIds={selectedParcelIds}
            onSelectParcel={(p) => {
              setSelectedParcel(p);
            }}
            onOpenCreateFormWithPoints={handleOpenCreateFormWithPoints}
            activeView={activeView}
            onExploreSubZone={handleExploreSubZone}
            onReturnToGlobal={handleReturnToGlobal}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </main>

        {/* Parcels List Sidebar with Collapse/Expand Toggle */}
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
              setInitialFormPoints(null);
              setIsFormOpen(true);
            }}
            onToggleCollapse={() => setIsSidebarCollapsed(true)}
          />
        )}
      </div>

      {/* Selected Parcel Detail Sidebar / Modal */}
      <ParcelModal
        parcel={selectedParcel}
        onClose={() => setSelectedParcel(null)}
        onUpdateParcel={handleUpdateParcel}
        onDeleteParcel={handleDeleteParcel}
      />

      {/* Create Parcel Modal */}
      <ParcelFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onAddParcel={handleAddParcel}
        concessionPolygon={concessionPolygon}
        existingParcels={currentParcels}
        initialPoints={initialFormPoints}
      />

      {/* GeoJSON Parcel Importer Modal */}
      <GeoJsonImporterModal
        isOpen={isGeoJsonImporterOpen}
        onClose={() => setIsGeoJsonImporterOpen(false)}
        onAddParcels={handleAddParcelsFromExternal}
      />

      {/* KML Parcel Importer Modal */}
      <KmlParcelImporterModal
        isOpen={isKmlParcelImporterOpen}
        onClose={() => setIsKmlParcelImporterOpen(false)}
        onAddParcels={handleAddParcelsFromExternal}
        concessionPolygon={concessionPolygon}
      />

      {/* KML Concession Importer Modal */}
      <KmlImporter
        isOpen={isKmlImporterOpen}
        onClose={() => setIsKmlImporterOpen(false)}
        onSetConcession={(poly) => setConcessionPolygon(poly)}
      />
    </div>
  );
}
