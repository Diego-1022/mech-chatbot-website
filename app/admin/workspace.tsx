"use client";

import {createContext, useContext, type ReactNode} from "react";
import {usePathname} from "next/navigation";
import {CalendarDays, ChevronRight, CircleDollarSign, ExternalLink, House, LogOut, Mail, Settings, UsersRound} from "lucide-react";
import {standalone} from "@/lib/deployment";
import {useLanguage} from "@/lib/client";
import {type Lang} from "@/lib/catalog";
import {workshopContact} from "@/lib/workshop-info";
import {CommentsModeration} from "@/components/comments";
import {AppointmentWorkspace} from "./admin";
import {WorkshopAnalytics} from "./analytics";
import {EmailWorkspace} from "./email-workspace";
import {WorkshopExpenses} from "./expenses";
import {WorkshopFinancials} from "./financials";
import {HomeDashboard} from "./home-dashboard";
import {PriceSettings} from "./price-settings";
import {RosterWorkspace} from "./roster-workspace";
import {WorkshopSettings} from "./workshop-tools";

const areas = [
  {id:"home", href:"/admin", label:{en:"Home", zh:"首页"}, Icon:House},
  {id:"email", href:"/admin/email", label:{en:"Email", zh:"邮件"}, Icon:Mail},
  {id:"roster", href:"/admin/roster", label:{en:"Roster", zh:"排班"}, Icon:UsersRound},
  {id:"appointments", href:"/admin/appointments", label:{en:"Appointments", zh:"预约"}, Icon:CalendarDays},
  {id:"settings", href:"/admin/settings", label:{en:"Settings", zh:"设置"}, Icon:Settings},
] as const;

type Area = typeof areas[number]["id"] | "financials";
const AdminContext = createContext<{lang:Lang;email:string}>({lang:"en",email:""});

export function AdminWorkspace({email,children}: {email:string;children:ReactNode}) {
  const pathname = usePathname();
  const [lang,setLang] = useLanguage();
  const t = (en:string,zh:string) => lang === "zh" ? zh : en;
  const home = pathname === "/admin" || pathname === "/admin/";
  function clearPrivateDrafts() {
    try {
      sessionStorage.removeItem("harbour-admin-inbox-v1");
      sessionStorage.removeItem("harbour-email-booking");
    } catch {}
  }

  return <AdminContext.Provider value={{lang,email}}>
    <div className={home ? "admin-workspace admin-workspace--home" : "admin-workspace"}>
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin" aria-label="Harbour Auto workshop home">
          <span aria-hidden="true">H <b>/</b></span>
          <span><strong>Harbour</strong><small>AUTO WORKSHOP</small></span>
        </a>
        <nav aria-label={t("Workshop navigation","后台导航")}>
          {areas.map(({href,label,Icon})=>{
            const active = href === "/admin" ? home : pathname === href || pathname?.startsWith(href+"/");
            return <a key={href} href={href} aria-current={active?"page":undefined} title={label[lang]}>
              <Icon size={20}/><span>{label[lang]}</span>
            </a>;
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <a href="/" className="admin-public-link"><ExternalLink size={17}/><span>{t("Public website","公开网站")}</span></a>
          <button type="button" className="admin-locale" aria-label="Switch language" onClick={()=>setLang(lang==="en"?"zh":"en")}>{lang==="en"?"中文":"EN"}</button>
          {standalone
            ? <form action="/api/admin-session" method="post" onSubmit={clearPrivateDrafts}>
              <input type="hidden" name="action" value="logout"/>
              <button aria-label={t("Sign out","退出")} title={t("Sign out","退出")}><LogOut size={18}/></button>
            </form>
            : <a href="/signout-with-chatgpt?return_to=/" onClick={clearPrivateDrafts} aria-label={t("Sign out","退出")}><LogOut size={18}/></a>}
        </div>
      </aside>
      <main className="admin-content workshop-admin" id="admin-content">{children}</main>
    </div>
  </AdminContext.Provider>;
}

export function AdminScreen({area,composeId}: {area:Area;composeId?:string}) {
  const {email,lang} = useContext(AdminContext);
  const t = (en:string,zh:string) => lang === "zh" ? zh : en;
  if (area === "home") return <HomeDashboard lang={lang}/>;
  if (area === "email") return <EmailWorkspace lang={lang} composeId={composeId}/>;
  if (area === "roster") return <RosterWorkspace lang={lang}/>;
  if (area === "appointments") return <AppointmentWorkspace lang={lang}/>;
  if (area === "financials") return <div className="admin-view">
    <a className="admin-backlink" href="/admin/settings">{t("Settings","设置")}</a>
    <div className="admin-view-header"><h1>{t("Financials","财务")}</h1></div>
    <WorkshopFinancials lang={lang} revision={0}/>
    <WorkshopExpenses lang={lang}/>
  </div>;

  return <div className="admin-view">
    <div className="admin-view-header"><h1>{t("Settings","设置")}</h1></div>
    <section className="panel admin-profile">
      <h2>{t("Account & contact","账户与联系方式")}</h2>
      <dl>
        <div><dt>{t("Administrator email","管理员邮箱")}</dt><dd>{email}</dd></div>
        <div><dt>{t("Workshop phone","店铺电话")}</dt><dd><a href={workshopContact.phoneHref}>{workshopContact.phone}</a></dd></div>
        <div><dt>{t("Workshop address","店铺地址")}</dt><dd>{workshopContact.address}</dd></div>
      </dl>
      <a className="admin-settings-link" href="/admin/settings/financials">
        <CircleDollarSign size={21}/><span>{t("Financials","财务")}</span><ChevronRight size={17}/>
      </a>
    </section>
    <WorkshopSettings lang={lang}/>
    <PriceSettings lang={lang} onSaved={()=>{}}/>
    <WorkshopAnalytics lang={lang}/>
    <div id="reviews"><CommentsModeration lang={lang}/></div>
  </div>;
}
