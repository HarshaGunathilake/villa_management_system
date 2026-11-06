"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { ConfirmButtons, FormError, Modal } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, PasswordInput, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useAdmin, useAdminData } from "@/lib/admin-store";
import type { AdminUser, AdminVilla } from "@/lib/admin-types";
import { shiftMonths } from "@/lib/admin-logic";

const plusMonth = (iso: string) => shiftMonths(iso, 1);

/* ------------------------------------------------------------ create a villa */

export function CreateVillaSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Add villa" className="sm:w-[34rem]">
      {open ? <CreateVillaForm onClose={onClose} /> : null}
    </Sheet>
  );
}

function CreateVillaForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { act, notify } = useAdmin();
  const { today, settings } = useAdminData();
  const [villa, setVilla] = useState({ name: "", location: "", phone: "", email: "", address: "", description: "" });
  const [monthlyAmount, setMonthlyAmount] = useState(settings.defaultMonthlyAmount);
  const [startDate, setStartDate] = useState(today);
  const [nextPaymentDate, setNextPaymentDate] = useState(plusMonth(today));
  const [admin, setAdmin] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [activate, setActivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ villaId: string; name: string; adminEmail: string } | null>(null);

  const v = (key: keyof typeof villa) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVilla({ ...villa, [key]: e.target.value });
  const a = (key: keyof typeof admin) => (e: React.ChangeEvent<HTMLInputElement>) => setAdmin({ ...admin, [key]: e.target.value });

  const problem =
    villa.name.trim().length < 2 ? "Enter the villa name."
    : admin.name.trim().length < 2 ? "Enter the admin's name."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email.trim()) ? "Enter the admin's email."
    : admin.password.length < 8 ? "The password needs at least 8 characters."
    : admin.password !== admin.confirm ? "The two passwords do not match."
    : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problem) return setError(problem);
    setBusy(true);
    const result = await act<{ villaId: string }>({
      type: "createVilla",
      villa,
      subscription: { monthlyAmount, startDate, nextPaymentDate },
      admin: { name: admin.name, email: admin.email, phone: admin.phone, password: admin.password },
      activate,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify("Villa created");
    setCreated({ villaId: result.villaId, name: villa.name.trim(), adminEmail: admin.email.trim().toLowerCase() });
  };

  if (created) {
    return (
      <div className="space-y-5 pt-2">
        <div className="flex items-start gap-3 rounded-card border border-sage/40 bg-sage-soft p-5 text-sage-deep">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0" />
          <div>
            <p className="text-lg font-semibold">Villa created successfully.</p>
            <p className="font-medium">Villa Admin account created successfully.</p>
          </div>
        </div>
        <div className="rounded-card border border-line bg-card p-5">
          <div className="text-sm text-muted">Give these sign-in details to the villa admin</div>
          <div className="mt-1 text-lg font-semibold">{created.name}</div>
          <div className="break-all">{created.adminEmail}</div>
          <div className="text-muted">Password: the one you just set{activate ? "" : ". The account is not active yet; enable it from the villa's Admin tab."}</div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button size="lg" onClick={() => { onClose(); router.push(`/admin/villas/${created.villaId}`); }}>
            Open villa
          </Button>
          <Button variant="secondary" size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Villa information</h3>
        <Field label="Villa name">{(id) => <Input id={id} value={villa.name} onChange={v("name")} placeholder="e.g. Ocean Breeze Villa" />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={villa.location} onChange={v("location")} placeholder="e.g. Mirissa, Matara" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={villa.phone} onChange={v("phone")} />}</Field>
          <Field label="Email" optional>{(id) => <Input id={id} type="email" value={villa.email} onChange={v("email")} />}</Field>
        </div>
        <Field label="Address" optional>{(id) => <Input id={id} value={villa.address} onChange={v("address")} />}</Field>
        <Field label="Description" optional>{(id) => <Textarea id={id} value={villa.description} onChange={v("description")} className="min-h-20" />}</Field>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Subscription</h3>
        <Field label="Monthly subscription amount">{(id) => <MoneyInput id={id} value={monthlyAmount} onChange={setMonthlyAmount} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subscription start date">
            {(id) => <Input id={id} type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (e.target.value) setNextPaymentDate(plusMonth(e.target.value)); }} />}
          </Field>
          <Field label="Next payment due">{(id) => <Input id={id} type="date" value={nextPaymentDate} min={startDate} onChange={(e) => setNextPaymentDate(e.target.value)} />}</Field>
        </div>
        <p className="text-sm text-muted">The villa admin pays this amount by card from their Subscription page. Payments are recorded by themselves.</p>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Villa admin account</h3>
        <Field label="Admin name">{(id) => <Input id={id} value={admin.name} onChange={a("name")} autoComplete="off" />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Admin email">{(id) => <Input id={id} type="email" value={admin.email} onChange={a("email")} autoComplete="off" />}</Field>
          <Field label="Admin phone" optional>{(id) => <Input id={id} type="tel" value={admin.phone} onChange={a("phone")} autoComplete="off" />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={admin.password} onChange={a("password")} autoComplete="new-password" />}</Field>
          <Field label="Confirm password">{(id) => <PasswordInput id={id} value={admin.confirm} onChange={a("confirm")} autoComplete="new-password" />}</Field>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} className="size-6 shrink-0 accent-[#252525]" />
          <span className="font-medium">Activate account immediately</span>
        </label>
      </section>

      <FormError message={error} />
      <Button type="submit" size="lg" block disabled={busy}>
        {busy ? "Creating" : "Create villa"}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------- edit a villa */

export function EditVillaSheet({ villa, open, onClose }: { villa: AdminVilla; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Edit villa" className="sm:w-[34rem]">
      {open ? <EditVillaForm key={villa.id} villa={villa} onClose={onClose} /> : null}
    </Sheet>
  );
}

function EditVillaForm({ villa, onClose }: { villa: AdminVilla; onClose: () => void }) {
  const paidByCard = ["active", "on_hold", "past_due", "paused"].includes(villa.card.status ?? "");
  const { act, notify } = useAdmin();
  const [draft, setDraft] = useState({
    name: villa.name, location: villa.location, phone: villa.phone, email: villa.email, address: villa.address, description: villa.description,
    plan: villa.plan, monthlyAmount: villa.monthlyAmount, subscriptionStartDate: villa.subscriptionStartDate, nextPaymentDate: villa.nextPaymentDate,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [key]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    // Only send what changed, so the activity log can tell a subscription change from a details change.
    const patch = Object.fromEntries(Object.entries(draft).filter(([k, val]) => val !== (villa as unknown as Record<string, unknown>)[k]));
    const result = Object.keys(patch).length === 0 ? { ok: true as const } : await act({ type: "updateVilla", id: villa.id, patch });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify("Villa updated");
    onClose();
  };

  return (
    <form onSubmit={save} className="space-y-8" noValidate>
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Villa information</h3>
        <Field label="Villa name">{(id) => <Input id={id} value={draft.name} onChange={set("name")} />}</Field>
        <Field label="Location">{(id) => <Input id={id} value={draft.location} onChange={set("location")} />}</Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">{(id) => <Input id={id} type="tel" value={draft.phone} onChange={set("phone")} />}</Field>
          <Field label="Email" optional>{(id) => <Input id={id} type="email" value={draft.email} onChange={set("email")} />}</Field>
        </div>
        <Field label="Address" optional>{(id) => <Input id={id} value={draft.address} onChange={set("address")} />}</Field>
        <Field label="Description" optional>{(id) => <Textarea id={id} value={draft.description} onChange={set("description")} className="min-h-20" />}</Field>
      </section>
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Subscription</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">{(id) => <Input id={id} value={draft.plan} onChange={set("plan")} />}</Field>
          <Field label="Monthly amount">{(id) => <MoneyInput id={id} value={draft.monthlyAmount} onChange={(n) => setDraft({ ...draft, monthlyAmount: n })} />}</Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subscription start date">{(id) => <Input id={id} type="date" value={draft.subscriptionStartDate} onChange={set("subscriptionStartDate")} />}</Field>
          <Field label="Next payment due" hint={paidByCard ? "Set by Dodo, as this villa pays by card." : undefined}>
            {(id) => <Input id={id} type="date" value={draft.nextPaymentDate} onChange={set("nextPaymentDate")} disabled={paidByCard} />}
          </Field>
        </div>
        {paidByCard ? <p className="text-sm text-muted">A new monthly amount is charged from the villa&apos;s next card payment. Nothing extra is charged now.</p> : null}
      </section>
      <FormError message={error} />
      <Button type="submit" size="lg" block disabled={busy || draft.name.trim().length < 2}>
        Save changes
      </Button>
    </form>
  );
}

/* --------------------------------------------------- enable / disable access */

export function AccessModal({ villa, open, onClose }: { villa: AdminVilla; open: boolean; onClose: () => void }) {
  const { act, notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabling = villa.accountStatus === "active";

  const confirm = async () => {
    setBusy(true);
    const result = await act({ type: "setVillaAccess", id: villa.id, status: disabling ? "disabled" : "active" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify(disabling ? "Villa access disabled" : "Villa access enabled");
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={disabling ? "Disable villa access?" : "Enable villa access?"}
      footer={<ConfirmButtons onCancel={onClose} onConfirm={confirm} confirmLabel={disabling ? "Disable access" : "Enable access"} danger={disabling} busy={busy} />}
    >
      {disabling ? (
        <>
          <p>{villa.name} will no longer be accessible to its admin users.</p>
          <p className="text-muted">The villa&apos;s bookings, guests, rooms and other data will remain stored.</p>
          <p className="text-muted">You can re-enable access at any time.</p>
        </>
      ) : (
        <p>The villa admin will be able to log in and use the system again.</p>
      )}
      <FormError message={error} />
    </Modal>
  );
}

/* ------------------------------------------------------------- admin users */

export function AdminUserModal({ villaId, user, open, onClose }: { villaId: string; user?: AdminUser; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title={user ? "Edit admin" : "Add admin"} footer={null}>
      {open ? <AdminUserForm key={user?.id ?? "new"} villaId={villaId} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function AdminUserForm({ villaId, user, onClose }: { villaId: string; user?: AdminUser; onClose: () => void }) {
  const { act, notify } = useAdmin();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    const result = user ? await act({ type: "updateAdmin", id: user.id, name, email, phone }) : await act({ type: "createAdmin", villaId, name, email, phone, password });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify(user ? "Admin updated" : "Admin added");
    onClose();
  };

  return (
    <>
      <Field label="Name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}</Field>
      <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}</Field>
      <Field label="Phone" optional>{(id) => <Input id={id} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />}</Field>
      {user ? null : (
        <Field label="Password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}</Field>
      )}
      <FormError message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || name.trim().length < 2 || !email.includes("@") || (!user && password.length < 8)}>
          {user ? "Save changes" : "Add admin"}
        </Button>
      </div>
    </>
  );
}

export function ResetPasswordModal({ user, open, onClose }: { user: AdminUser; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="Reset password" footer={null}>
      {open ? <ResetPasswordForm key={user.id} user={user} onClose={onClose} /> : null}
    </Modal>
  );
}

function ResetPasswordForm({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { act, notify } = useAdmin();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const result = await act({ type: "resetPassword", id: user.id, password });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify("Password reset");
    onClose();
  };

  return (
    <>
      <p className="text-muted">Set a new password for {user.name}. They are signed out everywhere and must use the new one.</p>
      <Field label="New password" hint="At least 8 characters">{(id) => <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}</Field>
      <Field label="Confirm new password">{(id) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />}</Field>
      <FormError message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} disabled={busy || password.length < 8}>
          Reset password
        </Button>
      </div>
    </>
  );
}

export function AdminStatusModal({ user, open, onClose }: { user: AdminUser; open: boolean; onClose: () => void }) {
  const { act, notify } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disabling = user.status === "active";

  const confirm = async () => {
    setBusy(true);
    const result = await act({ type: "setAdminStatus", id: user.id, status: disabling ? "disabled" : "active" });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    notify(disabling ? "Admin disabled" : "Admin enabled");
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={disabling ? "Disable this admin?" : "Enable this admin?"}
      footer={<ConfirmButtons onCancel={onClose} onConfirm={confirm} confirmLabel={disabling ? "Disable admin" : "Enable admin"} danger={disabling} busy={busy} />}
    >
      {disabling ? (
        <>
          <p>{user.name} will not be able to log in.</p>
          <p className="text-muted">The villa stays active and its data is untouched.</p>
        </>
      ) : (
        <p>{user.name} will be able to log in again.</p>
      )}
      <FormError message={error} />
    </Modal>
  );
}
