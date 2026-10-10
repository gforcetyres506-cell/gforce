'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Minus, Search, Edit3, Check, AlertCircle } from 'lucide-react';
import AdminNav from '@/components/admin/AdminNav';
import MStripe from '@/components/ui/MStripe';
import TierBadge from '@/components/ui/TierBadge';
import { localStore } from '@/lib/mockData';
import { isMockDataEnabled } from '@/lib/mock-mode';
import AdminDataPending from '@/components/admin/AdminDataPending';
import { formatPrice, formatTyreSize } from '@/lib/utils';
import type { Tyre } from '@/types';

export default function AdminInventoryPage() {
  const mockMode = isMockDataEnabled();
  const [tyres, setTyres] = useState<Tyre[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // New tyre form state
  const [brand, setBrand] = useState('Michelin');
  const [model, setModel] = useState('');
  const [width, setWidth] = useState(225);
  const [profile, setProfile] = useState(45);
  const [rim, setRim] = useState(18);
  const [tier, setTier] = useState<'budget' | 'mid' | 'premium'>('premium');
  const [season, setSeason] = useState<'summer' | 'all-season' | 'winter'>('summer');
  const [costPrice, setCostPrice] = useState(8000);
  const [sellPrice, setSellPrice] = useState(13500);
  const [stock, setStock] = useState(8);

  async function reloadInventory() {
    try {
      const res = await fetch('/api/admin/inventory');
      const json = await res.json();
      if (json.ok && json.data) {
        setTyres(json.data);
      } else {
        setTyres(localStore.getAllTyres());
      }
    } catch {
      setTyres(localStore.getAllTyres());
    }
  }

  useEffect(() => {
    reloadInventory();
  }, []);

  async function handleStockChange(id: string, delta: number) {
    const tyre = tyres.find((t) => t.id === id);
    if (!tyre) return;
    const newStock = Math.max(0, tyre.stock + delta);
    setTyres(tyres.map((t) => (t.id === id ? { ...t, stock: newStock } : t)));

    try {
      await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, stock: newStock }),
      });
    } catch {
      localStore.updateTyreStock(id, newStock);
    }
  }

  async function handleAddTyre(e: React.FormEvent) {
    e.preventDefault();
    if (!model.trim()) return;

    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand,
          model,
          width,
          profile,
          rim,
          tier,
          season,
          cost_price: costPrice,
          sell_price: sellPrice,
          stock,
        }),
      });
      const json = await res.json();
      if (json.ok && json.data) {
        setTyres([json.data, ...tyres]);
      } else {
        reloadInventory();
      }
    } catch {
      reloadInventory();
    }

    setShowAddModal(false);
    setModel('');
  }

  const filteredTyres = tyres.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.brand.toLowerCase().includes(q) ||
      t.model.toLowerCase().includes(q) ||
      t.sku.toLowerCase().includes(q) ||
      `${t.width}/${t.profile}`.includes(q)
    );
  });

  return (
    <div className="container-g section">
      <MStripe className="mb-6" />
      <AdminNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="display-2 leading-none">TYRE INVENTORY &amp; STOCK</h1>
          <p className="text-xs text-ink-3 mt-1">Development catalogue, pricing, stock, and replenishment controls</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            <input
              className="input pl-9 text-xs"
              placeholder="Search brand, model, size, SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus size={16} /> Add Tyre SKU
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-x-auto p-0 border-line">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-3/60 text-ink-3 font-semibold uppercase tracking-wider">
              <th className="py-3.5 px-4">Brand &amp; Model</th>
              <th className="py-3.5 px-4">Size &amp; Spec</th>
              <th className="py-3.5 px-4">Tier / Season</th>
              <th className="py-3.5 px-4 text-right">Cost Price</th>
              <th className="py-3.5 px-4 text-right">Fitted Price</th>
              <th className="py-3.5 px-4 text-right">Margin</th>
              <th className="py-3.5 px-4 text-center">Stock Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredTyres.map((t) => {
              const marginPence = t.sell_price - t.cost_price;
              const marginPercent = Math.round((marginPence / t.sell_price) * 100);

              return (
                <tr key={t.id} className="hover:bg-surface-3/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-ink-1 text-sm">{t.brand} {t.model}</div>
                    <div className="mono text-[10px] text-ink-3">{t.sku}</div>
                  </td>

                  <td className="py-3 px-4 mono text-xs font-semibold text-ink-1">
                    {formatTyreSize(t)}
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <TierBadge tier={t.tier} />
                      <span className="badge badge-info text-[10px] py-0.5 px-2">{t.season}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right mono text-ink-3">
                    {formatPrice(t.cost_price)}
                  </td>

                  <td className="py-3 px-4 text-right mono font-bold text-ink-1">
                    {formatPrice(t.sell_price)}
                  </td>

                  <td className="py-3 px-4 text-right mono text-ok font-semibold">
                    +{marginPercent}% ({formatPrice(marginPence)})
                  </td>

                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStockChange(t.id, -1)}
                        className="btn btn-secondary btn-sm h-7 w-7 p-0 flex items-center justify-center"
                      >
                        <Minus size={12} />
                      </button>
                      <span className={`mono font-bold w-7 text-center ${t.stock <= 5 ? 'text-warning' : 'text-ok'}`}>
                        {t.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStockChange(t.id, 1)}
                        className="btn btn-secondary btn-sm h-7 w-7 p-0 flex items-center justify-center"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Tyre Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full space-y-5 border-border-brand/40 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-base font-bold uppercase">Add New Tyre Inventory SKU</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink-3 hover:text-ink-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTyre} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1 block">Brand</label>
                  <select className="input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                    {['Michelin', 'Pirelli', 'Continental', 'Goodyear', 'Bridgestone', 'Falken', 'Dunlop', 'Yokohama', 'Nankang', 'Landsail'].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Model Name *</label>
                  <input
                    className="input"
                    placeholder="e.g. Pilot Sport 4S"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label mb-1 block">Width</label>
                  <input
                    type="number"
                    className="input"
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Profile</label>
                  <input
                    type="number"
                    className="input"
                    value={profile}
                    onChange={(e) => setProfile(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Rim</label>
                  <input
                    type="number"
                    className="input"
                    value={rim}
                    onChange={(e) => setRim(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1 block">Tier</label>
                  <select className="input" value={tier} onChange={(e) => setTier(e.target.value as any)}>
                    <option value="premium">Premium</option>
                    <option value="mid">Standard</option>
                    <option value="budget">Budget</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Season</label>
                  <select className="input" value={season} onChange={(e) => setSeason(e.target.value as any)}>
                    <option value="summer">Summer</option>
                    <option value="all-season">All-Season</option>
                    <option value="winter">Winter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label mb-1 block">Cost Price (Pence)</label>
                  <input
                    type="number"
                    className="input"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Sell Price (Pence)</label>
                  <input
                    type="number"
                    className="input"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="label mb-1 block">Initial Stock</label>
                  <input
                    type="number"
                    className="input"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary flex-1 btn-sm"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1 btn-sm">
                  Save SKU to Catalogue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
