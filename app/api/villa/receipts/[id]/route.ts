import { NextResponse } from "next/server";
import { requireVillaAdmin } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { notFound, recordId, route } from "@/lib/server/http";
import { receiptLink } from "@/lib/server/storage";

/**
 * Open an expense's receipt. Only the villa that owns the expense can, even
 * while its payment is due (looking is always allowed). Sends the browser to a
 * link that works for 5 minutes.
 */
export const GET = route(async (request) => {
  const { villaId } = await requireVillaAdmin({ allowLapsed: true, allowUnpaid: true });
  const id = recordId(new URL(request.url).pathname.split("/").pop(), "Expense");
  const row = await db.one<{ receipt_key: string | null; receipt_name: string | null }>("SELECT receipt_key, receipt_name FROM expenses WHERE villa_id = ? AND id = ?", [villaId, id]);
  if (!row?.receipt_key) throw notFound("Receipt");
  const url = await receiptLink(row.receipt_key, row.receipt_name);
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
});
