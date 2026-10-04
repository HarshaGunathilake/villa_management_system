"use client";

import { useState } from "react";
import { ConciergeBell, Pencil, Plus } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Chip, Field, Input, MoneyInput, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { AMENITY_UNITS, type Amenity, type AmenityUnit } from "@/lib/types";
import { money, plural } from "@/lib/utils";

type Draft = { name: string; price: number; unit: AmenityUnit };
const blank: Draft = { name: "", price: 0, unit: "per booking" };

export default function AmenitiesPage() {
  const { amenities, addAmenity, updateAmenity, removeAmenity, notify } = useStore();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const open = (amenity?: Amenity) => {
    setDraft(amenity ? { name: amenity.name, price: amenity.price, unit: amenity.unit } : blank);
    setConfirmRemove(false);
    setEditing(amenity ? amenity.id : "new");
  };

  const save = () => {
    const clean = { ...draft, name: draft.name.trim() };
    if (editing === "new") {
      addAmenity({ ...clean, enabled: true });
      notify("Amenity added");
    } else if (editing) {
      updateAmenity(editing, clean);
      notify("Amenity updated");
    }
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Amenities"
        subtitle={amenities.length > 0 ? `${plural(amenities.length, "extra")} guests can add to a booking` : "Extras guests can add to a booking"}
        action={
          <Button onClick={() => open()}>
            <Plus /> Add amenity
          </Button>
        }
      />

      {amenities.length === 0 ? (
        <EmptyState
          title="No amenities yet"
          action={
            <Button onClick={() => open()}>
              <Plus /> Add amenity
            </Button>
          }
        >
          Add the extras you offer, such as a BBQ, meals or an airport pickup. You can then add them to any booking.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {amenities.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start gap-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-full ${a.enabled ? "bg-brass-soft text-brass-deep" : "bg-well text-muted"}`}>
                  <ConciergeBell className="size-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-xl leading-tight font-semibold ${a.enabled ? "" : "text-muted"}`}>{a.name}</div>
                  <div className="tnum mt-1 text-lg font-medium">
                    {money(a.price)} <span className="text-base font-normal text-muted">{a.unit}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <div className="font-medium">{a.enabled ? "Offered to guests" : "Not offered"}</div>
                  <div className="text-sm text-muted">{a.enabled ? "Shows when making a booking" : "Hidden from new bookings"}</div>
                </div>
                <Toggle
                  checked={a.enabled}
                  label={`${a.name} is offered`}
                  onChange={(v) => {
                    updateAmenity(a.id, { enabled: v });
                    notify(v ? `${a.name} switched on` : `${a.name} switched off`);
                  }}
                />
              </div>
              <Button variant="secondary" block className="mt-4" onClick={() => open(a)}>
                <Pencil /> Edit
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Add amenity" : "Edit amenity"}
        footer={
          <Button size="lg" block disabled={draft.name.trim().length < 2 || draft.price <= 0} onClick={save}>
            {editing === "new" ? "Add amenity" : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-6">
          <Field label="Name">
            {(id) => <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. BBQ evening" />}
          </Field>
          <Field label="Price">
            {(id) => <MoneyInput id={id} value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />}
          </Field>
          <div>
            <div className="mb-2 font-medium">Charged</div>
            <div className="flex flex-wrap gap-2">
              {AMENITY_UNITS.map((u) => (
                <Chip key={u} selected={draft.unit === u} onClick={() => setDraft({ ...draft, unit: u })}>
                  {u}
                </Chip>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">When you add it to a booking you choose how many, for example 4 breakfasts.</p>
          </div>

          {editing && editing !== "new" ? (
            confirmRemove ? (
              <div className="rounded-card border border-clay/30 bg-clay-soft p-4">
                <p className="font-medium">Remove this amenity?</p>
                <p className="text-sm text-muted">Bookings that already include it keep it.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setConfirmRemove(false)}>
                    Keep it
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      removeAmenity(editing);
                      notify("Amenity removed");
                      setEditing(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" block className="text-clay" onClick={() => setConfirmRemove(true)}>
                Remove amenity
              </Button>
            )
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
