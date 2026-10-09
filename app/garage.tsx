"use client";
import {useEffect, useRef, useState} from "react";
import {House, CarFront, Wrench, CalendarDays, UserRound, MessageCircle, Clock3, ShieldCheck, Info, BatteryCharging, ScanLine, CircleDot, Wind} from "lucide-react";
import {services} from "@/lib/catalog";
import {useLanguage} from "@/lib/client";
import Booking from "@/components/booking";
import Chat from "@/components/chat";
import WheelShowcase from "@/components/wheel-showcase";
import BackgroundPaths from "@/components/background-paths";
import ServicesBackground from "@/components/services-background";

const serviceIcons = [Wrench, ShieldCheck, BatteryCharging, ScanLine, CircleDot, Wind];

export default function Garage() {
  const [lang, setLang] = useLanguage();
  const [chat, setChat] = useState(false);
  const [chosen, setChosen] = useState("service");
  const [active, setActive] = useState(0);
  const wheelArea = useRef<HTMLDivElement>(null);
  function setRotation(degrees:number) {
    wheelArea.current?.style.setProperty("--wheel-rotation", `${degrees}deg`);
  }
  const [compact, setCompact] = useState(false);
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const t = (zh:string, en:string) => lang === "zh" ? zh : en;
  const titles = [t("首页", "Overview"), t("故障排查", "Diagnostics"), t("行车安全", "Safety"), t("日常保养", "Servicing")];

  function choose(id:string) {
    setChosen(id);
    document.getElementById("booking")?.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
  }
  function goToPanel(index:number) {
    if (compact) { setActive(index); setRotation(index * 90); return; }
    if (!track.current || !stage.current) return;
    const top = track.current.getBoundingClientRect().top + window.scrollY;
    const span = track.current.offsetHeight - stage.current.offsetHeight;
    window.scrollTo({top: top + span * index / 3, behavior:"smooth"});
  }
  useEffect(() => {
    // Small preview windows still use the original scroll-driven wheel.
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    function update() {
      if (query.matches || !track.current || !stage.current) return;
      const span = track.current.offsetHeight - stage.current.offsetHeight;
      const progress = Math.max(0, Math.min(3, -track.current.getBoundingClientRect().top / Math.max(span,1) * 3));
      setActive(Math.round(progress)); setRotation(progress * 90);
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    function mode() {setCompact(query.matches); setActive(0); setRotation(0); schedule();}
    mode(); query.addEventListener("change",mode);
    window.addEventListener("scroll",schedule,{passive:true}); window.addEventListener("resize",schedule);
    return () => {cancelAnimationFrame(frame); query.removeEventListener("change",mode); window.removeEventListener("scroll",schedule); window.removeEventListener("resize",schedule);};
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12 });
    document.querySelectorAll(".ui-reveal").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(context.registerTool({name:"start_service_booking", title:"Start a service booking", description:"Select a workshop service and open the booking form. Does not create a reservation.",inputSchema:{type:"object",properties:{service:{type:"string",enum:services.map(s=>s.id)}},required:["service"],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:any)=>{if(!input||!services.some(s=>s.id===input.service))throw new Error("Invalid service");choose(input.service);return {selectedService:input.service,bookingCreated:false};}},{signal:lifecycle.signal})).catch(()=>{});
    return()=>lifecycle.abort();
  }, []);

  return <>
    <a className="skip-link" href="#booking">{t("跳转到预约", "Skip to booking")}</a>
    <header className="kw-ribbon">
      <a className="kw-brand" href="/"><span className="kw-brand-symbol" aria-hidden="true">H<span> /</span></span><span className="kw-brand-name">Harbour<span> AUTO WORKSHOP</span></span></a>
      <nav aria-label={t("主导航", "Main navigation")}>
        <a href="#home" aria-label={t("首页", "Home")} className="kw-home"><House size={23}/><span className="kw-tip">{t("首页", "Home")}</span></a>
        <a href="#services" aria-label={t("服务与价格", "Services & prices")}><CarFront size={23}/><span className="kw-tip">{t("服务与价格", "Services & prices")}</span></a>
        <a href="#booking" aria-label={t("预约到店", "Book a visit")}><CalendarDays size={23}/><span className="kw-tip">{t("预约到店", "Book a visit")}</span></a>
        <a href="#about" aria-label={t("营业时间", "Workshop information")}><Info size={23}/><span className="kw-tip">{t("营业时间", "Workshop information")}</span></a>
        <a href="/manage" aria-label={t("管理预约", "Manage booking")}><UserRound size={23}/><span className="kw-tip">{t("管理预约", "Manage booking")}</span></a>
        <button className="kw-language" aria-label="Switch language" onClick={()=>setLang(lang==="zh"?"en":"zh")}>{lang==="zh"?"English":"中文"}</button>
      </nav>
    </header>
    <main>
      <section id="home" className={"kw-track"+(compact?" is-compact":"")} ref={track} aria-label={t("车辆服务介绍", "Explore car care")}>
        <div className="kw-stage" ref={stage}>
          <BackgroundPaths/>
          <div className="kw-wheel-area" ref={wheelArea}>
            <WheelShowcase active={active} titles={titles} onSelect={goToPanel}/>
            <div className="kw-dial-caption"><span>0{active+1} / 04</span><span>{titles[active]}</span></div>
          </div>
          <div className="kw-copy">
            <p className="kw-kicker"><span className="kw-status-dot" aria-hidden="true"/>{t("悉尼 · 课堂演示店铺", "SYDNEY · CLASSROOM WORKSHOP")}</p>
            <div className="kw-panel" key={active}>
              {active===0 ? <>
                <h1>{t("了解车况。", "Know your car.")}<br/><span className="kw-highlight">{t("从容出发。", "Own the road.")}</span></h1>
                <p className="kw-lede">{t("从日常保养到故障排查，先了解服务与参考费用，再安排到店检查。", "From routine servicing to a worrying warning light. Explore your options, get an indicative estimate and plan your next visit.")}</p>
                <div className="actions"><button className="primary" onClick={()=>choose("service")}><CalendarDays size={18}/>{t("预约到店", "Book a visit")}</button><button className="secondary" onClick={()=>setChat(true)}><MessageCircle size={18}/>{t("咨询助手", "Ask the assistant")}</button></div>
              </> : active===1 ? <>
                <h2>{t("发现异常？", "Something")}<br/>{t("先查明原因。", "not quite right?")}</h2>
                <p className="kw-lede">{t("故障灯亮起、启动困难或出现异响？描述症状，获取初步建议，再由到店检查确认原因。", "A warning light, a slow start or an unfamiliar noise? Describe the symptoms for initial guidance, then book an inspection.")}</p>
                <ul className="kw-features"><li>{t("故障灯与诊断扫描", "Warning lights & scans")}</li><li>{t("电瓶与启动系统", "Battery & starting")}</li><li>{t("症状与系统检查", "Symptom investigation")}</li><li>{t("空调系统排查", "Air conditioning checks")}</li></ul>
                <div className="actions"><button className="primary" onClick={()=>choose("diagnostic")}>{t("预约故障检查", "Book diagnostics")}</button><button className="secondary" onClick={()=>setChat(true)}>{t("描述车辆症状", "Describe a symptom")}</button></div>
              </> : active===2 ? <>
                <h2>{t("安心制动。", "Stop safely.")}<br/>{t("平稳行驶。", "Drive steadily.")}</h2>
                <p className="kw-lede">{t("刹车、轮胎与定位检查，帮助了解磨损和异常。维修项目与最终费用在检查后确认。", "Brake, tyre and alignment checks to understand wear and unusual behaviour. Repair scope and final cost are confirmed after inspection.")}</p>
                <ul className="kw-features"><li>{t("刹车异响与震动", "Brake noise & vibration")}</li><li>{t("刹车系统检查", "Brake system checks")}</li><li>{t("轮胎磨损检查", "Tyre wear checks")}</li><li>{t("定位与更换建议", "Alignment advice")}</li></ul>
                <div className="actions"><button className="primary" onClick={()=>choose("brakes")}>{t("预约刹车检查", "Book a brake check")}</button><button className="secondary" onClick={()=>choose("tyres")}>{t("轮胎与定位", "Tyres & alignment")}</button></div>
              </> : <>
                <h2>{t("按时保养。", "Stay on top")}<br/>{t("从容出发。", "of the essentials.")}</h2>
                <p className="kw-lede">{t("机油、滤芯和基础车辆检查。随时在线选择到店时间，无需等待营业时间再预约。", "Oil, filters and the checks your car needs. Choose your check-in time online, whenever it suits you.")}</p>
                <ul className="kw-features"><li>{t("机油与滤芯更换", "Oil & filter change")}</li><li>{t("基础车辆检查", "Essential vehicle checks")}</li><li>{t("全天在线预约", "Book online, anytime")}</li><li>{t("在线改期或取消", "Reschedule or cancel online")}</li></ul>
                <div className="actions"><button className="primary" onClick={()=>choose("service")}>{t("预约常规保养", "Book a service")}</button><a className="secondary" href="/manage">{t("管理预约", "Manage booking")}</a></div>
              </>}
            </div>
            <div className="kw-topic-label">{t("探索车辆养护", "EXPLORE CAR CARE")}<span>0{active+1} / 04</span></div>
            <div className="kw-section-tabs" aria-label={t("选择服务介绍", "Choose a care topic")}>{titles.map((label,i)=><button key={i} aria-pressed={active===i} onClick={()=>goToPanel(i)}>{label}</button>)}</div>
          </div>
          {!compact&&<p className="kw-scroll-hint">{t("滚动了解服务", "Scroll to explore")}</p>}
        </div>
      </section>
      <div className="kw-assurance-bar"><span><Clock3 size={16}/>{t("全天在线预约", "Book online, anytime")}</span><span><ShieldCheck size={16}/>{t("透明参考价格", "Clear, indicative pricing")}</span><span><MessageCircle size={16}/>{t("英文与中文支持", "English & 中文")}</span></div>
      <section className="kw-services" id="services">
        <ServicesBackground lang={lang}/>
        <div className="services-content">
        <div className="section-heading"><div><p className="eyebrow">{t("服务与参考费用", "SERVICES & ESTIMATES")}</p><h2>{t("适合你的车辆服务", "The right care for your car.")}</h2></div><p>{t("澳元演示价格，实际维修以检查后报价为准。", "Fictional AUD ranges for this class project. Final quotes require an inspection.")}</p></div>
        <div className="service-grid">{services.map((s,i)=>{const Icon=serviceIcons[i];return <article className="service-card ui-reveal" key={s.id}><div className="kw-service-top"><Icon size={26}/><span className="service-number">0{i+1}</span></div><h3>{s[lang]}</h3><p>{lang==="zh"?s.detailZh:s.detailEn}</p><div className="price">A$ {s.min}–{s.max}<span>{t("参考区间", "estimate")}</span></div><button className="secondary" onClick={()=>choose(s.id)}>{t("预约此服务", "Book this service")}</button></article>})}</div>
        </div>
      </section>
      <section className="kw-booking-section" id="booking">
        <div className="kw-booking-copy ui-reveal"><p className="eyebrow">{t("安排下一次到店", "YOUR NEXT VISIT")}</p><h2>{t("选好时间。", "Pick a time.")}<br/>{t("我们到时见。", "We'll see you then.")}</h2><p className="kw-lede">{t("选择服务和到店时段，填写车辆资料，再确认预约。", "Choose a service and check-in time, add your vehicle details and review your booking.")}</p><div className="kw-booking-benefits"><p><Clock3 size={22}/>{t("24 小时在线预约", "Online booking, 24 hours a day")}</p><p><ShieldCheck size={22}/>{t("私人链接管理预约", "A private link to manage your visit")}</p></div><p className="small muted">{t("到店接待时段不代表维修完成时间。课堂演示请使用虚构联系资料。", "Appointments reserve a check-in time, not a repair completion time. Use fictional contact details for this class demo.")}</p></div>
        <div className="booking-card ui-reveal"><h3>{t("预约到店", "Book your visit")}</h3><div className="summary"><CalendarDays size={22}/><div><b>{t("悉尼当地时间", "Sydney local time")}</b><p>{t("周一至周五 09:00–17:00 · 周六 09:00–12:00", "Mon–Fri 09:00–17:00 · Sat 09:00–12:00")}</p></div></div><Booking lang={lang} initialService={chosen}/></div>
      </section>
    </main>
    <footer className="kw-footer" id="about"><div><strong>Harbour Auto Workshop</strong><p>{t("车辆咨询、参考费用和在线预约。", "Car care advice, indicative estimates and online appointments.")}</p><p className="kw-demo-note">{t("课堂演示项目 · 店铺与价格为模拟资料", "Classroom project · fictional workshop and pricing")}</p></div><div><strong>{t("营业时间", "Workshop hours")}</strong><p>{t("周一至周五 09:00–17:00", "Monday–Friday 09:00–17:00")}<br/>{t("周六 09:00–12:00 · 周日休息", "Saturday 09:00–12:00 · Sunday closed")}</p><p>{t("悉尼时间 · 无真实营业地址或电话", "Sydney time · no real trading address or phone")}</p></div><div><strong>{t("在线服务", "Your workshop, online")}</strong><a href="#booking">{t("预约到店", "Book a visit")}</a><a href="/manage">{t("管理预约", "Manage booking")}</a><a href="/admin">{t("店铺管理", "Workshop admin")}</a></div></footer>
    <Chat open={chat} setOpen={setChat} lang={lang}/>
  </>;
}
