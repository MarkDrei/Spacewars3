'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import { CommanderData, InventoryGrid, InventoryItemData, DEFAULT_INVENTORY_SLOTS, SortStatKey, SortDirection, sortGrid } from '@/shared/inventoryShared';
import { commanderSellPrice, commanderBuyPrice } from '@/shared/starbasePrice';
import CommanderCard from '@/components/Starbase/CommanderCard';
import SortControls from '@/components/Inventory/SortControls';
import './StarbasePage.css';

interface StarbasePageClientProps {
  auth: ServerAuthState;
}

const StarbasePageClient: React.FC<StarbasePageClientProps> = (_props) => {
  const router = useRouter();
  const t = useTranslations('starbase');
  const locale = useLocale();
  const [shopCommanders, setShopCommanders] = useState<CommanderData[]>([]);
  const [inventoryCommanders, setInventoryCommanders] = useState<{ commander: CommanderData; row: number; col: number }[]>([]);
  const [maxInventorySlots, setMaxInventorySlots] = useState<number>(DEFAULT_INVENTORY_SLOTS);
  const [iron, setIron] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  // Sort state for sell (inventory) panel
  const [sellSortBy, setSellSortBy] = useState<SortStatKey | null>(null);
  const [sellSortDir, setSellSortDir] = useState<SortDirection>('desc');

  // Sort state for buy (shop) panel
  const [buySortBy, setBuySortBy] = useState<SortStatKey | null>(null);
  const [buySortDir, setBuySortDir] = useState<SortDirection>('desc');

  const showMessage = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  }, []);

  const fetchShop = useCallback(async () => {
    const res = await fetch('/api/starbase/shop');
    if (res.ok) {
      const data = await res.json();
      setShopCommanders(data.commanders ?? []);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    const res = await fetch('/api/inventory');
    if (res.ok) {
      const data: { grid: InventoryGrid; maxSlots: number } = await res.json();
      const commanders: { commander: CommanderData; row: number; col: number }[] = [];
      data.grid.forEach((rowArr, rowIdx) => {
        rowArr.forEach((item: InventoryItemData | null, colIdx) => {
          if (item && item.itemType === 'commander') {
            commanders.push({ commander: item, row: rowIdx, col: colIdx });
          }
        });
      });
      setInventoryCommanders(commanders);
      setMaxInventorySlots(data.maxSlots);
    }
  }, []);

  const fetchIron = useCallback(async () => {
    const res = await fetch('/api/user-stats');
    if (res.ok) {
      const data = await res.json();
      setIron(data.iron ?? 0);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([fetchShop(), fetchInventory(), fetchIron()]);
      setIsLoading(false);
    };
    init();
  }, [fetchShop, fetchInventory, fetchIron]);

  const handleSell = useCallback(async (row: number, col: number) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/starbase/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });
      const data = await res.json();
      if (res.ok) {
        setIron(data.newIron);
        showMessage(`Sold for ${data.ironEarned.toLocaleString(locale)} Iron!`);
        await fetchInventory();
      } else {
        showMessage(data.error ?? 'Sell failed');
      }
    } finally {
      setIsBusy(false);
    }
  }, [fetchInventory, showMessage, locale]);

  const handleBuy = useCallback(async (slotIndex: number) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/starbase/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex }),
      });
      const data = await res.json();
      if (res.ok) {
        setIron(data.newIron);
        showMessage('Commander purchased!');
        await fetchInventory();
      } else {
        showMessage(data.error ?? 'Purchase failed');
      }
    } finally {
      setIsBusy(false);
    }
  }, [fetchInventory, showMessage]);

  const inventoryFull = inventoryCommanders.length >= maxInventorySlots;

  // Derive sorted lists for display. The sell list is flat (not a grid), so we
  // wrap into a 1-row grid for sortGrid, then flatten back out.
  const sortedInventoryCommanders = useMemo(() => {
    if (!sellSortBy) return inventoryCommanders;
    const singleRow = [inventoryCommanders.map((e) => e.commander)];
    const sorted = sortGrid(singleRow, inventoryCommanders.length, sellSortBy, sellSortDir);
    return sorted[0]
      .filter((c): c is CommanderData => c !== null)
      .map((c) => inventoryCommanders.find((e) => e.commander === c)!);
  }, [inventoryCommanders, sellSortBy, sellSortDir]);

  const sortedShopCommanders = useMemo(() => {
    if (!buySortBy) return shopCommanders.map((c, i) => ({ commander: c, index: i }));
    const singleRow = [shopCommanders as (CommanderData | null)[]];
    const sorted = sortGrid(singleRow, shopCommanders.length, buySortBy, buySortDir);
    return sorted[0]
      .filter((c): c is CommanderData => c !== null)
      .map((c) => ({ commander: c, index: shopCommanders.indexOf(c) }));
  }, [shopCommanders, buySortBy, buySortDir]);

  return (
    <AuthenticatedLayout>
      <div className="starbase-page">
        <div className="starbase-container">
          <div className="starbase-header">
            <h1 className="starbase-title">{t('pageHeading')}</h1>
            <div className="starbase-iron-display">
              {t('ironDisplay', { amount: iron.toLocaleString(locale) })}
            </div>
            <button
              className="starbase-return-btn"
              onClick={() => router.push('/game')}
            >
              {t('returnToGame')}
            </button>
          </div>

          {message && (
            <div className="starbase-message">{message}</div>
          )}

          {isLoading ? (
            <div className="starbase-loading">{t('loadingMessage')}</div>
          ) : (
            <div className="starbase-panels">
              {/* Sell Panel */}
              <div className="starbase-panel starbase-panel--sell">
                <div className="starbase-panel-heading-row">
                  <h2 className="starbase-panel-heading">{t('sellCommandersHeading')}</h2>
                  <SortControls
                    sortBy={sellSortBy}
                    sortDir={sellSortDir}
                    onSortChange={(by, dir) => { setSellSortBy(by); setSellSortDir(dir); }}
                    accentColor="#4488ff"
                  />
                </div>
                {inventoryCommanders.length === 0 ? (
                  <p className="starbase-empty">{t('noCommandersInInventory')}</p>
                ) : (
                  <div className="starbase-card-list">
                    {sortedInventoryCommanders.map(({ commander, row, col }) => (
                      <CommanderCard
                        key={`${row}-${col}`}
                        commander={commander}
                        price={commanderSellPrice(commander)}
                        actionLabel={t('sellButton')}
                        onAction={() => handleSell(row, col)}
                        disabled={isBusy}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Buy Panel */}
              <div className="starbase-panel starbase-panel--buy">
                <div className="starbase-panel-heading-row">
                  <h2 className="starbase-panel-heading">{t('buyCommandersHeading')}</h2>
                  <SortControls
                    sortBy={buySortBy}
                    sortDir={buySortDir}
                    onSortChange={(by, dir) => { setBuySortBy(by); setBuySortDir(dir); }}
                    accentColor="#66bb6a"
                  />
                </div>
                <div className="starbase-card-list">
                  {sortedShopCommanders.map(({ commander, index }) => {
                    const price = commanderBuyPrice(commander);
                    return (
                      <CommanderCard
                        key={index}
                        commander={commander}
                        price={price}
                        actionLabel={t('buyButton')}
                        onAction={() => handleBuy(index)}
                        disabled={isBusy || iron < price || inventoryFull}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthenticatedLayout>
  );
};

export default StarbasePageClient;
