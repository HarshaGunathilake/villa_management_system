import { redirect } from "next/navigation";

/*
 * app.lankastay.com/ opens the dashboard (or sign-in, when signed out: proxy.ts).
 * The public website is a separate project on its own domain.
 */
export default function Home() {
  redirect("/dashboard");
}
