import {type ReactNode} from "react";
import {env} from "cloudflare:workers";
import {requireChatGPTUser} from "@/app/chatgpt-auth";
import {AdminWorkspace} from "@/app/admin/workspace";
import "@/app/admin/workspace.css";

export const dynamic = "force-dynamic";

export default async function Layout({children}: {children:ReactNode}) {
  const user = await requireChatGPTUser("/admin");
  const adminEmail = env.ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail || user.email.toLowerCase() !== adminEmail.trim().toLowerCase()) {
    return <main className="screen">
      <section className="panel">
        <h2>Access restricted</h2>
        <p>This page is only available to the designated workshop administrator.</p>
        <a className="link" href="/">Back home</a>
      </section>
    </main>;
  }
  return <AdminWorkspace email={user.email}>{children}</AdminWorkspace>;
}
