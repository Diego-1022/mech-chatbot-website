"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {ArrowDown, CalendarDays, MessageCircle, Clock3, ShieldCheck, Mouse, RotateCw, MoveDown} from "lucide-react";
import {services} from "@/lib/catalog";
import {useLanguage} from "@/lib/client";
import Booking from "@/components/booking";
import Chat from "@/components/chat";
import WheelShowcase from "@/components/wheel-showcase";
import BackgroundPaths from "@/components/background-paths";
import Comments from "@/components/comments";
import {SiteHeader,SiteFooter} from "@/components/site-shell";


export default function Garage() {
  const [lang, setLang] = useLanguage();
  const [chat, setChat] = useState(false);
  const [chosen, setChosen] = useState("service");
  const [active, setActive] = useState(0);
  const [wheelHovered, setWheelHovered] = useState(false);
  const wheelArea = useRef<HTMLDivElement>(null);
  const wheelAngle = useRef(0);
  const setRotation = useCallback((degrees:number) => {
    wheelAngle.current = degrees;
    wheelArea.current?.style.setProperty("--wheel-rotation", `${degrees}deg`);
    wheelArea.current?.setAttribute("data-wheel-angle", String(degrees));
    setActive(((Math.round(degrees / 90) % 4) + 4) % 4);
  }, []);
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
    // Select the nearest equivalent angle without moving the page or losing
    // accumulated turns after using the wheel's local scroll interaction.
    const current = ((wheelAngle.current % 360) + 360) % 360;
    const delta = ((index * 90 - current + 540) % 360) - 180;
    setRotation(wheelAngle.current + delta);
  }
  useEffect(()=>{
    const requested=new URL(window.location.href).searchParams.get("service");
    if(requested&&services.some(s=>s.id===requested))setChosen(requested);
    if(window.location.hash==="#booking")requestAnimationFrame(()=>document.getElementById("booking")?.scrollIntoView({behavior:"auto"}));
  },[]);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wheel = wheelArea.current?.querySelector<HTMLElement>(".kw-wheel");
    let frame = 0;
    let rotationFrame = 0;
    let pendingRotation = 0;
    let previousScrollAngle = 0;
    function update() {
      if (query.matches || !track.current || !stage.current) return;
      const span = track.current.offsetHeight - stage.current.offsetHeight;
      if (span <= 1) { previousScrollAngle = 0; return; }
      const progress = Math.max(0, Math.min(3, -track.current.getBoundingClientRect().top / Math.max(span,1) * 3));
      const scrollAngle = progress * 90;
      // Only add the page's movement, preserving manual turns when the pointer
      // leaves the tyre. Resizing must not reset an accumulated rotation.
      setRotation(wheelAngle.current + scrollAngle - previousScrollAngle);
      previousScrollAngle = scrollAngle;
    }
    function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }
    function resize() {
      if (!track.current || !stage.current) return;
      const span = track.current.offsetHeight - stage.current.offsetHeight;
      if (span <= 1) { previousScrollAngle = 0; return; }
      previousScrollAngle = Math.max(0, Math.min(3, -track.current.getBoundingClientRect().top / Math.max(span,1) * 3)) * 90;
    }
    function mode() {setCompact(query.matches); resize();}
    function overTyre(event: MouseEvent) {
      if (!wheel) return false;
      const rect = wheel.getBoundingClientRect();
      const radius = Math.min(rect.width, rect.height) * .42;
      return Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2) <= radius;
    }
    function pointerMove(event: PointerEvent) { setWheelHovered(event.pointerType !== "touch" && overTyre(event)); }
    function pointerLeave() { setWheelHovered(false); }
    function rotate(event: WheelEvent) {
      // Pinch-to-zoom and the transparent square corners retain native input.
      if (event.ctrlKey || !event.cancelable || !event.deltaY || !overTyre(event)) return;
      event.preventDefault();
      setWheelHovered(true);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      pendingRotation += event.deltaY * unit * .18;
      if (!rotationFrame) rotationFrame = requestAnimationFrame(() => {
        rotationFrame = 0;
        setRotation(wheelAngle.current + pendingRotation);
        pendingRotation = 0;
      });
    }
    mode(); query.addEventListener("change",mode);
    schedule();
    wheel?.addEventListener("wheel",rotate,{passive:false});
    wheel?.addEventListener("pointermove",pointerMove);
    wheel?.addEventListener("pointerleave",pointerLeave);
    window.addEventListener("scroll",schedule,{passive:true}); window.addEventListener("resize",resize);
    return () => {
      cancelAnimationFrame(frame); cancelAnimationFrame(rotationFrame);
      query.removeEventListener("change",mode);
      wheel?.removeEventListener("wheel",rotate); wheel?.removeEventListener("pointermove",pointerMove); wheel?.removeEventListener("pointerleave",pointerLeave);
      window.removeEventListener("scroll",schedule); window.removeEventListener("resize",resize);
    };
  }, [setRotation]);
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
    <SiteHeader lang={lang} setLang={setLang}/>
    <main>
      <section id="home" className={"kw-track"+(compact?" is-compact":"")} ref={track} aria-label={t("车辆服务介绍", "Explore car care")}>
        <div className="kw-stage" ref={stage}>
          <BackgroundPaths/>
          <div className="kw-wheel-area" ref={wheelArea} data-wheel-hovered={wheelHovered}>
            <WheelShowcase active={active} titles={titles} onSelect={goToPanel}/>
            <div className="kw-dial-caption"><span>0{active+1} / 04</span><span>{titles[active]}</span></div>
            <div className="wheel-input-guide" id="wheel-input-guide">
              <p className="wheel-mouse-guide"><span className="wheel-rotate-cue"><RotateCw size={15}/>{t("轮胎上滚动 · 循环旋转", "Scroll on wheel · Rotate freely")}</span><span className="wheel-page-cue"><Mouse size={15}/>{t("移开指针 · 滚动页面", "Move off wheel · Scroll page")}</span></p>
              <p className="wheel-touch-guide"><MoveDown size={15}/>{t("滑动浏览页面 · 点图标切换介绍", "Swipe to scroll · Tap icons to explore")}</p>
            </div>
          </div>
          <div className="kw-copy">
            <p className="kw-kicker"><span className="kw-status-dot" aria-hidden="true"/>{t("悉尼 · 专注车辆养护", "SYDNEY · AUTOMOTIVE CARE")}</p>
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
                <div className="actions"><button className="primary" onClick={()=>choose("service")}>{t("预约常规保养", "Book a service")}</button><a className="secondary" href="/account">{t("我的账户", "My account")}</a></div>
              </>}
            </div>
            <div className="kw-topic-label">{t("探索车辆养护", "EXPLORE CAR CARE")}<span>0{active+1} / 04</span></div>
            <div className="kw-section-tabs" aria-label={t("选择服务介绍", "Choose a care topic")}>{titles.map((label,i)=><button key={i} aria-pressed={active===i} onClick={()=>goToPanel(i)}>{label}</button>)}</div>
          </div>
          <a className="kw-scroll-hint" href="#booking"><ArrowDown size={18}/><strong>{t("向下滑动，预约到店", "Scroll down to book a visit")}</strong><span>{t("在轮胎以外的区域滚动", "Scroll outside the wheel")}</span></a>
        </div>
      </section>
      <section className="kw-booking-section" id="booking">
        <div className="kw-booking-copy ui-reveal"><p className="eyebrow">{t("安排下一次到店", "YOUR NEXT VISIT")}</p><h2>{t("选好时间。", "Pick a time.")}<br/>{t("我们到时见。", "We'll see you then.")}</h2><p className="kw-lede">{t("选择服务和到店时段，填写车辆资料，再确认预约。", "Choose a service and check-in time, add your vehicle details and review your booking.")}</p><div className="kw-booking-benefits"><p><Clock3 size={22}/>{t("24 小时在线预约", "Online booking, 24 hours a day")}</p><p><ShieldCheck size={22}/>{t("私人链接管理预约", "A private link to manage your visit")}</p></div><p className="small muted">{t("到店接待时段不代表维修完成时间。", "Appointments reserve a check-in time, not a repair completion time.")}</p></div>
        <div className="booking-card ui-reveal"><h3>{t("预约到店", "Book your visit")}</h3><div className="summary"><CalendarDays size={22}/><div><b>{t("悉尼当地时间", "Sydney local time")}</b><p>{t("周一至周五 09:00–17:00 · 周六 09:00–12:00", "Mon–Fri 09:00–17:00 · Sat 09:00–12:00")}</p></div></div><Booking lang={lang} initialService={chosen}/></div>
      </section>
    </main>
    <details className="feedback-drawer" id="feedback"><summary>{t("留言与反馈", "Messages & feedback")}<span>{t("分享你的体验", "Share your experience")}</span></summary><Comments lang={lang}/></details>
    <SiteFooter lang={lang}/>
    <Chat open={chat} setOpen={setChat} lang={lang}/>
  </>;
}
