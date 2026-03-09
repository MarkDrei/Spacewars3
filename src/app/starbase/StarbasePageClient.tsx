'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthenticatedLayout from '@/components/Layout/AuthenticatedLayout';
import { ServerAuthState } from '@/lib/server/serverSession';
import { CommanderData, InventoryGrid, InventoryItemData, DEFAULT_INVENTORY_SLOTS } from '@/shared/inventoryShared';
import { commanderSellPrice, commanderBuyPrice } from '@/shared/starbasePrice';
import CommanderCard from '@/components/Starbase/CommanderCard';
import './StarbasePage.css';

interface StarbasePageClientProps {
  auth: ServerAuthState;
}

const StarbasePageClient: React.FC<StarbasePageClientProps> = (_props) => {
  const router = useRouter();
  const [shopCommanders, setShopCommanders] = useState<CommanderData[]>([]);
  const [inventoryCommanders, setInventoryCommanders] = useState<{ commander: CommanderData; row: number; col: number }[]>([]);
  const [maxInventorySlots, setMaxInventorySlots] = useState<number>(DEFAULT_INVENTORY_SLOTS);
  const [iron, setIron] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

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
        showMessage(`Sold for ${data.ironEarned.toLocaleString()} Iron!`);
        await fetchInventory();
      } else {
        showMessage(data.error ?? 'Sell failed');
      }
    } finally {
      setIsBusy(false);
    }
  }, [fetchInventory, showMessage]);

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

  return (
    <AuthenticatedLayout>
      <div className="starbase-page">
        <div className="starbase-container">
          <div className="starbase-header">
            <h1 className="starbase-title">🛸 Starbase</h1>
            <div className="starbase-iron-display">
              ⚙ Iron: <strong>{iron.toLocaleString()}</strong>
            </div>
            <button
              className="starbase-return-btn"
              onClick={() => router.push('/game')}
            >
              ← Return to Game
            </button>
          </div>

          {message && (
            <div className="starbase-message">{message}</div>
          )}

          {isLoading ? (
            <div className="starbase-loading">Loading…</div>
          ) : (
            <div className="starbase-panels">
              {/* Sell Panel */}
              <div className="starbase-panel">
                <h2 className="starbase-panel-heading">Sell Commanders</h2>
                {inventoryCommanders.length === 0 ? (
                  <p className="starbase-empty">No commanders in inventory.</p>
                ) : (
                  <div className="starbase-card-list">
                    {inventoryCommanders.map(({ commander, row, col }) => (
                      <CommanderCard
                        key={`${row}-${col}`}
                        commander={commander}
                        price={commanderSellPrice(commander)}
                        actionLabel="Sell"
                        onAction={() => handleSell(row, col)}
                        disabled={isBusy}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Buy Panel */}
              <div className="starbase-panel">
                <h2 className="starbase-panel-heading">Buy Commanders</h2>
                <div className="starbase-card-list">
                  {shopCommanders.map((commander, index) => {
                    const price = commanderBuyPrice(commander);
                    return (
                      <CommanderCard
                        key={index}
                        commander={commander}
                        price={price}
                        actionLabel="Buy"
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
