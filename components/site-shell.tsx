"use client";
import Link from "@/components/page-link";
import {useState} from "react";
import {House,CarFront,UsersRound,CalendarDays,Info,UserRound,Menu,X,ArrowUpRight} from "lucide-react";
import {type Lang} from "@/lib/catalog";
import {useLanguage} from "@/lib/client";
import {workshopContact,workshopHours} from "@/lib/workshop-info";
import Chat from "./chat";

export function SiteHeader({lang,setLang,active="home"}:{lang:Lang;setLang:(lang:Lang)=>void;active?:string}) {
  const [expanded,setExpanded]=useState(false);
  const t=(z:string,e:string)=>lang==="zh"?z:e;
  const links=[{id:"home",href:"/",Icon:House,label:t("首页","Home")},{id:"services",href:"/services",Icon:CarFront,label:t("服务与价格","Services")},{id:"team",href:"/team",Icon:UsersRound,label:t("维修团队","Our team")},{id:"booking",href:"/#booking",Icon:CalendarDays,label:t("预约到店","Book a visit")},{id:"contact",href:"/contact",Icon:Info,label:t("联系与营业时间","Contact")},{id:"account",href:"/account",Icon:UserRound,label:t("我的账户","My account")}];
  return <header className="kw-ribbon site-header">
    <Link className="kw-brand" href="/"><span className="kw-brand-symbol" aria-hidden="true">H<span> /</span></span><span className="kw-brand-name">Harbour<span> AUTO WORKSHOP</span></span></Link>
    <div className="mobile-controls"><button className="kw-language" aria-label="Switch language" onClick={()=>setLang(lang==="zh"?"en":"zh")}>{lang==="zh"?"English":"中文"}</button><button className="menu-toggle" aria-label={t("打开导航","Open navigation")} aria-expanded={expanded} aria-controls="site-navigation" onClick={()=>setExpanded(!expanded)}>{expanded?<X/>:<Menu/>}</button></div>
    <nav id="site-navigation" className={expanded?"is-expanded":""} aria-label={t("主导航","Main navigation")}>
      {links.map(({id,href,Icon,label})=><Link key={id} href={href} aria-label={label} aria-current={active===id?"page":undefined} className={active===id?"nav-active":""}><Icon size={21}/><span className="nav-label">{label}</span></Link>)}
      <button className="kw-language desktop-language" aria-label="Switch language" onClick={()=>setLang(lang==="zh"?"en":"zh")}>{lang==="zh"?"English":"中文"}</button>
    </nav>
  </header>;
}
export function Hours({lang}:{lang:Lang}) {
  return <dl className="daily-hours">{workshopHours.map(day=><div key={day.en}><dt>{day[lang]}</dt><dd>{day.hours||(lang==="zh"?"休息":"Closed")}</dd></div>)}</dl>;
}
export function SiteFooter({lang}:{lang:Lang}) {
  const t=(z:string,e:string)=>lang==="zh"?z:e;
  return <footer className="kw-footer" id="about"><div><strong>Harbour Auto Workshop</strong><p>{t("车辆养护，从了解车况开始。","Car care starts with understanding your car.")}</p><p>{workshopContact.address}</p><a href={workshopContact.phoneHref}>{workshopContact.phone}</a><a href={workshopContact.mapUrl} target="_blank" rel="noopener noreferrer">{t("查看 Chatswood 地图","Explore Chatswood")} <ArrowUpRight size={13}/></a></div><div><strong>{t("营业时间","Workshop hours")}</strong><Hours lang={lang}/><p className="small">{t("悉尼当地时间","Sydney local time")}</p></div><div><strong>{t("在线服务","Your workshop, online")}</strong><Link href="/services">{t("服务与参考费用","Services & estimates")}</Link><Link href="/team">{t("认识维修团队","Meet our team")}</Link><Link href="/#booking">{t("预约到店","Book a visit")}</Link><Link href="/account">{t("我的账户","My account")}</Link><Link href="/manage">{t("使用私人预约链接","Use a private booking link")}</Link><Link href="/terms">{t("条款与隐私","Terms & privacy")}</Link><Link href="/admin">{t("店铺管理","Workshop admin")}</Link></div><div className="footer-bottom">© {new Date().getFullYear()} Harbour Auto Workshop <span>{t("先检查，再确认维修项目与报价。","Inspection first. Clear scope and pricing before repairs.")}</span></div></footer>;
}
export function SitePage({active,children}:{active:string;children:(lang:Lang)=>React.ReactNode}) {
  const [lang,setLang]=useLanguage();const [chat,setChat]=useState(false);
  return <><a className="skip-link" href="#page-content">{lang==="zh"?"跳转到内容":"Skip to content"}</a><SiteHeader lang={lang} setLang={setLang} active={active}/><main id="page-content" className="standalone-page">{children(lang)}</main><SiteFooter lang={lang}/><Chat open={chat} setOpen={setChat} lang={lang}/></>;
}
