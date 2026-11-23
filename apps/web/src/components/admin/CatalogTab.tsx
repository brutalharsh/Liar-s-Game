"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { AsyncSection, Skeleton } from "@/components/ui/AsyncSection";
import { useMockQuery } from "@/hooks/useMockQuery";
import {
  adminAddCatalogItem,
  adminPatchCatalogItem,
  adminUploadArt,
  adminListCatalog,
  apiErrorMessage,
  type AdminCatalogItem,
} from "@/lib/api";
import { SHOP_CATEGORIES } from "@/lib/mock/catalog";
import { overlayEmoji } from "@/lib/mock/avatar";
import { Badge, Field } from "@/components/admin/bits";
import { formatCoins } from "@/lib/format";
import { useToasts } from "@/store/ui";

/**
 * CATALOG tab — the owner's core request: INLINE name+price editing, active
 * toggle with save (PATCH /api/admin/catalog/:id), add-item form (POST), and
 * per-item art upload (POST /api/admin/upload — raw file body ≤10MB → image
 * server relay) whose {imageId, imageUrl} is PATCHed back onto the item.
 * Everything optimistic-UI + rollback + toast.
 */
export function CatalogTab() {
  const push = useToasts();
  const query = useMockQuery<AdminCatalogItem[]>(() => adminListCatalog(), []);
  const [category, setCategory] = useState<string>("hat");
  const [overrides, setOverrides] = useState<Record<string, AdminCatalogItem>>({});
  const [added, setAdded] = useState<AdminCatalogItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; price: string }>({ name: "", price: "" });
  const [upload, setUpload] = useState<{ rowId: string; pct: number } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [newItem, setNewItem] = useState({ category: "hat", name: "", price: "" });

  const all = useMemo(() => {
    const base = query.data ?? [];
    return [...added, ...base].map((item) => overrides[item._id] ?? item);
  }, [query.data, added, overrides]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of all) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    const known = SHOP_CATEGORIES.filter((c) => counts.has(c.id)).map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, count: counts.get(c.id) ?? 0 }));
    const extra = [...counts.entries()]
      .filter(([id]) => !known.some((k) => k.id === id))
      .map(([id, count]) => ({ id, label: id, emoji: "🎴", count }));
    return [...known, ...extra];
  }, [all]);

  const rows = all.filter((item) => item.category === category);

  const patchRow = (updater: (before: AdminCatalogItem) => AdminCatalogItem) => (item: AdminCatalogItem) => {
    const before = overrides[item._id] ?? item;
    setOverrides((prev) => ({ ...prev, [item._id]: updater(before) }));
    return before;
  };

  const rollback = (id: string, before: AdminCatalogItem) => {
    setOverrides((prev) => {
      const next = { ...prev };
      next[id] = before;
      return next;
    });
  };

  const runSave = async (item: AdminCatalogItem) => {
    const name = draft.name.trim();
    const price = Number.parseInt(draft.price, 10);
    if (name === "" || Number.isNaN(price) || price < 0) {
      push({ title: "Name and a whole-number price, please", tone: "bad" });
      return;
    }
    const before = patchRow(() => ({ ...item, name, price }))(item);
    try {
      const saved = await adminPatchCatalogItem(item._id, { name, price });
      setOverrides((prev) => ({ ...prev, [item._id]: saved }));
      push({ title: `${saved.name} saved`, sub: `price ${formatCoins(price)} coins`, tone: "good" });
      setEditingId(null);
    } catch (err) {
      rollback(item._id, before);
      push({ title: "Save rolled back", sub: apiErrorMessage(err, "The catalog shelf stuck."), tone: "bad" });
    }
  };

  const runToggle = async (item: AdminCatalogItem, active: boolean) => {
    const before = patchRow(() => ({ ...item, active }))(item);
    try {
      const saved = await adminPatchCatalogItem(item._id, { active });
      setOverrides((prev) => ({ ...prev, [item._id]: saved }));
      push({ title: `${saved.name} ${active ? "back on the shelf" : "taken off the shelf"}`, tone: "good" });
    } catch (err) {
      rollback(item._id, before);
      push({ title: "Toggle rolled back", sub: apiErrorMessage(err, "The catalog shelf stuck."), tone: "bad" });
    }
  };

  const runUpload = async (item: AdminCatalogItem, file: File) => {
    setUpload({ rowId: item._id, pct: 0 });
    try {
      const art = await adminUploadArt(file, `catalog/${item.category}`, (pct) => setUpload({ rowId: item._id, pct }));
      const before = patchRow(() => ({ ...item, imageId: art.imageId, imageUrl: art.imageUrl }))(item);
      try {
        const saved = await adminPatchCatalogItem(item._id, { imageId: art.imageId, imageUrl: art.imageUrl });
        setOverrides((prev) => ({ ...prev, [item._id]: saved }));
        push({ title: "Art uploaded", sub: `${item.name} — image pinned`, tone: "good" });
      } catch (err) {
        rollback(item._id, before);
        push({ title: "Art could not be pinned to the item", sub: apiErrorMessage(err, "PATCH failed."), tone: "bad" });
      }
    } catch (err) {
      push({ title: "Upload refused", sub: apiErrorMessage(err, "The relay refused that picture."), tone: "bad" });
    } finally {
      setUpload(null);
    }
  };

  const runAdd = async () => {
    const name = newItem.name.trim();
    const price = Number.parseInt(newItem.price, 10);
    if (name === "" || Number.isNaN(price) || price < 0) {
      push({ title: "New items need a name + whole-number price", tone: "bad" });
      return;
    }
    setAddBusy(true);
    try {
      const created = await adminAddCatalogItem({ category: newItem.category, name, price });
      setAdded((prev) => [created, ...prev]);
      push({ title: `${created.name} added`, sub: `${created.category} · ${price} coins`, tone: "good" });
      setCategory(created.category);
      setAddOpen(false);
      setNewItem({ category: "hat", name: "", price: "" });
    } catch (err) {
      push({ title: "Item not added", sub: apiErrorMessage(err, "The shelf refused."), tone: "bad" });
    } finally {
      setAddBusy(false);
    }
  };

  const artCell = (item: AdminCatalogItem) => (
    <span className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-btn border border-wood-mid bg-wood-deep text-lg" aria-hidden>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        (overlayEmoji(item.artSlug ?? item._id) ?? "🎴")
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`min-h-12 rounded-btn border-2 px-3 font-display text-sm tracking-wide ${
              category === cat.id ? "border-brass bg-brass/15 text-brass" : "border-wood-mid/70 bg-wood/50 text-ink-dim hover:text-ivory"
            }`}
          >
            <span aria-hidden className="mr-1">{cat.emoji}</span>
            {cat.label} <span className="text-[10px] text-ink-dim">({cat.count})</span>
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          + NEW ITEM
        </Button>
      </div>

      <AsyncSection
        query={query}
        skeleton={
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        }
        isEmpty={(items) => items.filter((i) => i.category === category).length === 0}
        empty={
          <p className="py-8 text-center font-body text-sm text-ink-dim">
            No items in “{category}”.
          </p>
        }
      >
        {() => (
          <>
            {/* desktop table */}
            <div className="hidden lg:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b-2 border-wood-mid/60 font-body text-[10px] uppercase tracking-widest text-ink-dim">
                    <th className="px-2 py-2">Art</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Price (coins)</th>
                    <th className="px-2 py-2">Tier</th>
                    <th className="px-2 py-2">Active</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const editing = editingId === item._id;
                    return (
                      <tr key={item._id} className="border-b border-wood-mid/40">
                        <td className="px-2 py-2">
                          {upload?.rowId === item._id ? (
                            <span className="flex w-28 items-center gap-1">
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-wood-mid">
                                <span className="block h-full bg-brass transition-all" style={{ width: `${upload.pct}%` }} />
                              </span>
                              <span className="font-body text-[10px] text-ink-dim">{upload.pct}%</span>
                            </span>
                          ) : (
                            artCell(item)
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {editing ? (
                            <input
                              aria-label="Item name"
                              value={draft.name}
                              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                              className="min-h-12 w-52 rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-body text-sm text-ivory"
                            />
                          ) : (
                            <span className="font-body text-sm text-ivory">{item.name}</span>
                          )}
                          <span className="ml-2 font-body text-[10px] text-ink-dim">{item._id}</span>
                        </td>
                        <td className="px-2 py-2">
                          {editing ? (
                            <input
                              aria-label="Item price in coins"
                              type="number"
                              value={draft.price}
                              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                              className="min-h-12 w-24 rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-body text-sm text-ivory"
                            />
                          ) : (
                            <span className="font-body text-sm text-brass">🪙 {formatCoins(item.price)}</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <Badge tone={item.tier === "rare" ? "brass" : "neutral"}>{item.tier ?? "fine"}</Badge>
                          {item.levelReq ? <Badge tone="warn">LVL {item.levelReq}</Badge> : null}
                          {item.free ? <Badge tone="good">FREE</Badge> : null}
                        </td>
                        <td className="px-2 py-2">
                          <Switch
                            id={`active-${item._id}`}
                            label={`${item.name} active`}
                            checked={item.active}
                            onChange={(next) => void runToggle(item, next)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            {editing ? (
                              <>
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>CANCEL</Button>
                                <Button variant="brass" size="sm" onClick={() => void runSave(item)}>SAVE</Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingId(item._id);
                                  setDraft({ name: item.name, price: String(item.price) });
                                }}
                              >
                                EDIT
                              </Button>
                            )}
                            <label
                              htmlFor={`art-d-${item._id}`}
                              className="inline-flex min-h-12 cursor-pointer items-center rounded-btn border-2 border-ink-dim/70 px-3 font-display text-xs text-ink-dim hover:border-brass hover:text-brass"
                            >
                              ART
                              <input
                                id={`art-d-${item._id}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                                className="sr-only"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) void runUpload(item, file);
                                }}
                              />
                            </label>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <div className="flex flex-col gap-2 lg:hidden">
              {rows.map((item) => {
                const editing = editingId === item._id;
                return (
                  <Panel key={item._id} className="p-3">
                    <div className="flex items-center gap-3">
                      {upload?.rowId === item._id ? (
                        <span className="flex w-24 items-center gap-1">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-wood-mid">
                            <span className="block h-full bg-brass transition-all" style={{ width: `${upload.pct}%` }} />
                          </span>
                        </span>
                      ) : (
                        artCell(item)
                      )}
                      <div className="min-w-0 flex-1">
                        {editing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              aria-label="Item name"
                              value={draft.name}
                              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                              className="min-h-12 rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-body text-sm text-ivory"
                            />
                            <input
                              aria-label="Item price in coins"
                              type="number"
                              value={draft.price}
                              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                              className="min-h-12 rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-body text-sm text-ivory"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="truncate font-body text-sm text-ivory">{item.name}</p>
                            <p className="font-body text-xs text-brass">🪙 {formatCoins(item.price)} · {item.tier ?? "fine"}</p>
                          </>
                        )}
                      </div>
                      <Switch
                        id={`active-m-${item._id}`}
                        label={`${item.name} active`}
                        checked={item.active}
                        onChange={(next) => void runToggle(item, next)}
                      />
                    </div>
                    <div className="mt-2 flex gap-2">
                      {editing ? (
                        <>
                          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setEditingId(null)}>CANCEL</Button>
                          <Button variant="brass" size="sm" className="flex-1" onClick={() => void runSave(item)}>SAVE</Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setEditingId(item._id);
                            setDraft({ name: item.name, price: String(item.price) });
                          }}
                        >
                          EDIT
                        </Button>
                      )}
                      <label
                        htmlFor={`art-m-${item._id}`}
                        className="inline-flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-btn border-2 border-ink-dim/70 px-3 font-display text-xs text-ink-dim hover:border-brass hover:text-brass"
                      >
                        ART
                        <input
                          id={`art-m-${item._id}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void runUpload(item, file);
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-1 font-body text-[9px] text-ink-dim">id {item._id}{item.imageId ? ` · art ${item.imageId}` : ""}</p>
                  </Panel>
                );
              })}
            </div>
          </>
        )}
      </AsyncSection>

      {/* add-item form */}
      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add catalog item">
        <div className="flex flex-col gap-4">
          <label htmlFor="new-cat" className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-widest text-ink-dim">Category</span>
            <select
              id="new-cat"
              value={newItem.category}
              onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              className="min-h-12 w-full rounded-btn border-2 border-wood-mid bg-wood-deep px-2 font-body text-sm text-ivory"
            >
              {SHOP_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <Field id="new-name" label="Name" value={newItem.name} onChange={(name) => setNewItem((n) => ({ ...n, name }))} placeholder="e.g. Moonshine Beret" />
          <Field id="new-price" label="Price (coins)" type="number" value={newItem.price} onChange={(price) => setNewItem((n) => ({ ...n, price }))} placeholder="e.g. 150" />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>CANCEL</Button>
            <Button variant="brass" className="flex-1" disabled={addBusy} onClick={() => void runAdd()}>
              {addBusy ? "ADDING…" : "ADD ITEM"}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
