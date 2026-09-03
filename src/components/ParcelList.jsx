import React, { useState } from 'react';
import { Search, Filter, Plus, ChevronRight, User, CheckSquare, Square, Trash2, Download, Tag, X, CheckCircle2, PanelRightClose } from 'lucide-react';
import { STATUS_COLORS } from '../utils/geoUtils';
import DeleteConfirmModal from './DeleteConfirmModal';

export default function ParcelList({
  parcels,
  selectedParcel,
  onSelectParcel,
  onOpenCreateForm,
  selectedParcelIds = [],
  onToggleSelectParcel,
  onSelectAllParcels,
  onClearSelection,
  onBulkDelete,
  onBulkChangeStatus,
  onBulkExportGeoJSON,
  onToggleCollapse
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const filteredParcels = parcels.filter((parcel) => {
    const lotNumber = parcel.properties.lotNumber || '';
    const occupant = parcel.properties.occupantName || '';
    const status = parcel.properties.status || '';

    const matchesSearch =
      lotNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      occupant.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const allFilteredSelected =
    filteredParcels.length > 0 &&
    filteredParcels.every((p) => selectedParcelIds.includes(p.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      onClearSelection();
    } else {
      const allIds = filteredParcels.map((p) => p.id);
      onSelectAllParcels(allIds);
    }
  };

  return (
    <>
      {/* Custom Bulk Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => setShowBulkDeleteConfirm(false)}
        onConfirm={() => {
          onBulkDelete(selectedParcelIds);
          onClearSelection();
        }}
        count={selectedParcelIds.length}
      />

      <aside className="w-full md:w-80 lg:w-96 bg-white border-l border-slate-200 flex flex-col h-full text-slate-800 shadow-sm select-none relative animate-in slide-in-from-right duration-200">
        {/* Sidebar Header */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-900">Registre des Parcelles</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
              {filteredParcels.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onOpenCreateForm}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>

            {/* Collapse Sidebar Button */}
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded transition-all cursor-pointer"
                title="Masquer / Réduire le panneau latéral"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Input & Select All Row */}
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par lot ou occupant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:border-slate-400 font-sans"
            />
          </div>

          {/* Segmented Control Filter Tabs */}
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded border border-slate-200 text-[11px] font-medium text-slate-600">
            <button
              onClick={() => setStatusFilter('all')}
              className={`py-1 text-center rounded transition-all ${
                statusFilter === 'all' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'hover:bg-slate-200/60'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('disponible')}
              className={`py-1 text-center rounded transition-all ${
                statusFilter === 'disponible' ? 'bg-white text-emerald-700 font-semibold shadow-2xs' : 'hover:bg-slate-200/60'
              }`}
            >
              Libre
            </button>
            <button
              onClick={() => setStatusFilter('occupe')}
              className={`py-1 text-center rounded transition-all ${
                statusFilter === 'occupe' ? 'bg-white text-rose-700 font-semibold shadow-2xs' : 'hover:bg-slate-200/60'
              }`}
            >
              Occupé
            </button>
            <button
              onClick={() => setStatusFilter('litige')}
              className={`py-1 text-center rounded transition-all ${
                statusFilter === 'litige' ? 'bg-white text-amber-700 font-semibold shadow-2xs' : 'hover:bg-slate-200/60'
              }`}
            >
              Litige
            </button>
          </div>

          {/* Select All Checkbox Control Bar */}
          <div className="flex items-center justify-between pt-1 text-xs text-slate-600">
            <button
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-300" />
              )}
              <span>Sélectionner tout ({filteredParcels.length})</span>
            </button>

            {selectedParcelIds.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {selectedParcelIds.length} sélectionné(s)
              </span>
            )}
          </div>
        </div>

        {/* Floating Bulk Action Bar when 1+ parcels are checked */}
        {selectedParcelIds.length > 0 && (
          <div className="bg-slate-900 text-white p-2.5 px-3 border-b border-slate-800 shadow-md flex items-center justify-between gap-2 text-xs animate-in slide-in-from-top duration-200 sticky top-0 z-10">
            <div className="flex items-center gap-2 font-bold text-slate-100">
              <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px]">
                {selectedParcelIds.length}
              </span>
              <span>Actions Groupées</span>
            </div>

            <div className="flex items-center gap-1">
              {/* Bulk Status Change Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-[11px] font-semibold flex items-center gap-1"
                  title="Changer le statut en masse"
                >
                  <Tag className="w-3 h-3 text-emerald-400" />
                  <span>Statut</span>
                </button>

                {showStatusMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white text-slate-800 border border-slate-200 rounded shadow-lg p-1 space-y-0.5 z-[1200] text-xs">
                    <button
                      onClick={() => {
                        onBulkChangeStatus(selectedParcelIds, 'disponible');
                        setShowStatusMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-1.5"
                    >
                      🟢 Passer en Disponible
                    </button>
                    <button
                      onClick={() => {
                        onBulkChangeStatus(selectedParcelIds, 'occupe');
                        setShowStatusMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-1.5"
                    >
                      🔴 Passer en Occupé
                    </button>
                    <button
                      onClick={() => {
                        onBulkChangeStatus(selectedParcelIds, 'litige');
                        setShowStatusMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 rounded hover:bg-amber-50 text-amber-700 font-semibold flex items-center gap-1.5"
                    >
                      🟠 Passer en Litige
                    </button>
                  </div>
                )}
              </div>

              {/* Bulk GeoJSON Export */}
              <button
                onClick={() => onBulkExportGeoJSON(selectedParcelIds)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded text-[11px] font-semibold flex items-center gap-1"
                title="Exporter les parcelles sélectionnées en GeoJSON"
              >
                <Download className="w-3 h-3 text-cyan-400" />
                <span>Export</span>
              </button>

              {/* Bulk Delete Button */}
              <button
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold flex items-center gap-1"
                title="Supprimer les parcelles sélectionnées"
              >
                <Trash2 className="w-3 h-3" />
                <span>Supprimer</span>
              </button>

              {/* Clear Selection Button */}
              <button
                onClick={onClearSelection}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                title="Annuler la sélection"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Parcel Cards List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredParcels.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucun lot ne correspond aux critères de recherche.
            </div>
          ) : (
            filteredParcels.map((parcel) => {
              const isSelected = selectedParcel && selectedParcel.id === parcel.id;
              const isChecked = selectedParcelIds.includes(parcel.id);
              const statusKey = parcel.properties.status || 'disponible';
              const colorConfig = STATUS_COLORS[statusKey] || STATUS_COLORS.disponible;

              return (
                <div
                  key={parcel.id}
                  onClick={() => onSelectParcel(parcel)}
                  className={`p-3 transition-all cursor-pointer flex items-start gap-2.5 ${
                    isChecked
                      ? 'bg-emerald-50/60 border-l-4 border-l-emerald-600'
                      : isSelected
                      ? 'bg-slate-100 border-l-4 border-l-slate-900'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Multi-Selection Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelectParcel(parcel.id);
                    }}
                    className="pt-0.5 cursor-pointer text-slate-400 hover:text-emerald-600 flex-shrink-0"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-slate-900 font-sans truncate">
                        {parcel.properties.lotNumber || 'Lot sans nom'}
                      </span>
                      <span
                        className="px-2 py-0.5 text-[10px] font-semibold rounded border flex-shrink-0"
                        style={{
                          backgroundColor: `${colorConfig.hex}15`,
                          color: colorConfig.hex,
                          borderColor: `${colorConfig.hex}40`
                        }}
                      >
                        {colorConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-bold text-slate-900">
                        {parcel.properties.formattedHa}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {parcel.properties.formattedSqM}
                      </span>
                    </div>

                    {parcel.properties.occupantName && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                        <User className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{parcel.properties.occupantName}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}
