'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

interface Asset {
  id: string;
  name: string;
  category: string;
}

interface InventoryItem {
  id: string;
  assetId: string;
  serialNumber: string;
  condition: 'excellent' | 'good' | 'fair' | 'damaged';
  ownerName: string | null;
  asset: Asset;
}

export default function InventoryPage() {
  const [organizationId, setOrganizationId] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_ORGANIZATION_ID ?? ''
  );
  const [assetName, setAssetName] = useState('Camera Body');
  const [assetCategory, setAssetCategory] = useState('camera');
  const [itemAssetId, setItemAssetId] = useState('');
  const [itemSerialNumber, setItemSerialNumber] = useState('SN-001');
  const [itemCondition, setItemCondition] = useState<'excellent' | 'good' | 'fair' | 'damaged'>(
    'good'
  );
  const [itemOwnerName, setItemOwnerName] = useState('StudioOS');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const canQuery = useMemo(() => organizationId.trim().length > 0, [organizationId]);

  const loadAssets = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/inventory/assets?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      setMessage('Unable to load assets.');
      return;
    }

    const data = (await response.json()) as Asset[];
    setAssets(data);
    const firstAsset = data.at(0);
    if (!itemAssetId && firstAsset) {
      setItemAssetId(firstAsset.id);
    }
  }, [canQuery, itemAssetId, organizationId]);

  const loadItems = useCallback(async (): Promise<void> => {
    if (!canQuery) {
      return;
    }

    const response = await fetch(
      `/api/inventory/items?organizationId=${encodeURIComponent(organizationId)}`
    );
    if (!response.ok) {
      setMessage('Unable to load inventory items.');
      return;
    }

    const data = (await response.json()) as InventoryItem[];
    setItems(data);
  }, [canQuery, organizationId]);

  useEffect(() => {
    void loadAssets();
    void loadItems();
  }, [loadAssets, loadItems]);

  async function onCreateAsset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canQuery || !assetName.trim() || !assetCategory.trim()) {
      setMessage('Organization ID, asset name, and category are required.');
      return;
    }

    const response = await fetch('/api/inventory/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        name: assetName.trim(),
        category: assetCategory.trim()
      })
    });

    if (!response.ok) {
      setMessage('Create asset failed.');
      return;
    }

    setMessage('Asset created.');
    setAssetName('');
    await loadAssets();
  }

  async function onCreateItem(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canQuery || !itemAssetId.trim() || !itemSerialNumber.trim()) {
      setMessage('Organization ID, asset, and serial number are required.');
      return;
    }

    const response = await fetch('/api/inventory/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId,
        assetId: itemAssetId,
        serialNumber: itemSerialNumber.trim(),
        condition: itemCondition,
        ownerName: itemOwnerName.trim() || undefined
      })
    });

    if (!response.ok) {
      setMessage('Create item failed. Serial numbers must be unique per organization.');
      return;
    }

    setMessage('Inventory item created.');
    setItemSerialNumber('');
    await loadItems();
  }

  return (
    <main>
      <h1 style={{ marginTop: 0 }}>Inventory</h1>
      <p style={{ color: 'var(--muted)' }}>Manage assets and serialized inventory items.</p>

      <label>
        Organization ID
        <input
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          style={{ width: '100%', marginTop: 6, marginBottom: 10, padding: 10, maxWidth: 520 }}
        />
      </label>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16
        }}
      >
        <section>
          <h2 style={{ marginBottom: 8 }}>Create Asset</h2>
          <form onSubmit={(event) => void onCreateAsset(event)} style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Asset name"
              value={assetName}
              onChange={(event) => setAssetName(event.target.value)}
              style={{ padding: 10 }}
            />
            <input
              placeholder="Category"
              value={assetCategory}
              onChange={(event) => setAssetCategory(event.target.value)}
              style={{ padding: 10 }}
            />
            <button type="submit" style={{ padding: '8px 12px', width: 'fit-content' }}>
              Create Asset
            </button>
          </form>

          <h3 style={{ marginBottom: 8, marginTop: 16 }}>Assets</h3>
          <ul style={{ paddingLeft: 18 }}>
            {assets.map((asset) => (
              <li key={asset.id}>
                <strong>{asset.name}</strong> ({asset.category})
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 style={{ marginBottom: 8 }}>Create Inventory Item</h2>
          <form onSubmit={(event) => void onCreateItem(event)} style={{ display: 'grid', gap: 8 }}>
            <select
              value={itemAssetId}
              onChange={(event) => setItemAssetId(event.target.value)}
              style={{ padding: 10 }}
            >
              <option value="">Select Asset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Serial number"
              value={itemSerialNumber}
              onChange={(event) => setItemSerialNumber(event.target.value)}
              style={{ padding: 10 }}
            />
            <select
              value={itemCondition}
              onChange={(event) =>
                setItemCondition(event.target.value as 'excellent' | 'good' | 'fair' | 'damaged')
              }
              style={{ padding: 10 }}
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="damaged">Damaged</option>
            </select>
            <input
              placeholder="Owner name"
              value={itemOwnerName}
              onChange={(event) => setItemOwnerName(event.target.value)}
              style={{ padding: 10 }}
            />
            <button type="submit" style={{ padding: '8px 12px', width: 'fit-content' }}>
              Create Item
            </button>
          </form>

          <h3 style={{ marginBottom: 8, marginTop: 16 }}>Inventory Items</h3>
          <ul style={{ paddingLeft: 18 }}>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.serialNumber}</strong> - {item.asset.name} ({item.condition})
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          onClick={() => {
            void loadAssets();
            void loadItems();
          }}
          style={{ padding: '8px 12px' }}
        >
          Refresh Inventory
        </button>
      </div>

      {message && <p>{message}</p>}
    </main>
  );
}
