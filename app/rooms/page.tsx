"use client";

import { useState } from "react";
import { Home, Pencil, Plus } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell";
import { Photo } from "@/components/photo";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Stepper, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { PHOTOS } from "@/lib/photos";
import { useStore } from "@/lib/store";
import type { Room } from "@/lib/types";
import { money, plural } from "@/lib/utils";

type Draft = Pick<Room, "name" | "view" | "capacity" | "price">;
const blank: Draft = { name: "", view: "", capacity: 2, price: 0 };

export default function RoomsPage() {
  const { rooms, villa, addRoom, updateRoom, notify } = useStore();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);

  const open = (room?: Room) => {
    setDraft(room ? { name: room.name, view: room.view, capacity: room.capacity, price: room.price } : blank);
    setEditing(room ? room.id : "new");
  };

  const save = () => {
    const clean = { ...draft, name: draft.name.trim(), view: draft.view.trim() };
    if (editing === "new") {
      addRoom({ ...clean, enabled: true });
      notify("Room added");
    } else if (editing) {
      updateRoom(editing, clean);
      notify("Room updated");
    }
    setEditing(null);
  };

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle={`${plural(rooms.length, "room")} at ${villa.name}`}
        action={
          <Button onClick={() => open()}>
            <Plus /> Add room
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-12 place-items-center rounded-full bg-brass-soft">
          <Home className="size-6 text-brass-deep" />
        </span>
        <div className="flex-1 basis-56">
          <div className="text-lg font-semibold">Entire Villa</div>
          <div className="text-muted">
            All rooms together, up to {villa.maxGuests} guests. Change this in Villa settings.
          </div>
        </div>
        <div className="tnum text-xl font-semibold">{money(villa.price)} a night</div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rooms.map((room) => (
          <Card key={room.id} className="overflow-hidden">
            <Photo src={room.photo ?? PHOTOS.garden} alt="" className={`h-40 ${room.enabled ? "" : "opacity-50 grayscale"}`} />
            <div className="p-5">
              <div className="text-xl font-semibold">{room.name}</div>
              <div className="text-muted">
                {room.view ? `${room.view}, ` : ""}
                {plural(room.capacity, "guest")}
              </div>
              <div className="tnum mt-2 text-lg font-semibold">{money(room.price)} a night</div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4">
                <div>
                  <div className="font-medium">{room.enabled ? "Taking bookings" : "Not in use"}</div>
                  <div className="text-sm text-muted">{room.enabled ? "Switch off for repairs or a break" : "Hidden from new bookings"}</div>
                </div>
                <Toggle
                  checked={room.enabled}
                  label={`${room.name} takes bookings`}
                  onChange={(v) => {
                    updateRoom(room.id, { enabled: v });
                    notify(v ? `${room.name} switched on` : `${room.name} switched off`);
                  }}
                />
              </div>
              <Button variant="secondary" block className="mt-4" onClick={() => open(room)}>
                <Pencil /> Edit room
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === "new" ? "Add room" : "Edit room"}
        footer={
          <Button size="lg" block disabled={draft.name.trim().length < 2 || draft.price <= 0} onClick={save}>
            {editing === "new" ? "Add room" : "Save changes"}
          </Button>
        }
      >
        <div className="space-y-5">
          <Field label="Room name">
            {(id) => <Input id={id} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Ocean View Room" />}
          </Field>
          <Field label="Short description" optional>
            {(id) => <Input id={id} value={draft.view} onChange={(e) => setDraft({ ...draft, view: e.target.value })} placeholder="e.g. Ocean view" />}
          </Field>
          <Field label="Price per night">
            {(id) => <MoneyInput id={id} value={draft.price} onChange={(v) => setDraft({ ...draft, price: v })} />}
          </Field>
          <div className="rounded-card border border-line bg-card px-5">
            <Stepper label="Guests" hint="How many people the room sleeps" value={draft.capacity} min={1} max={10} onChange={(v) => setDraft({ ...draft, capacity: v })} />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
