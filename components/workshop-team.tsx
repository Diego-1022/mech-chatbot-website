"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Lang } from "@/lib/catalog";

const team = [
  { name: "Frank Bennett", role: ["首席维修师傅", "Lead technician"], age: 56, years: 31, initials: "FB", specialty: ["复杂故障诊断 · 刹车与安全", "Complex diagnostics · brakes & safety"], bio: ["三十余年的实战经验，把复杂问题讲清楚，也带领团队认真做好每一次检查。", "Three decades of hands-on experience, a steady approach to complex faults, and a clear explanation of what your car needs."] },
  { name: "Daniel Park", role: ["车辆维修师傅", "Automotive technician"], age: 38, years: 14, initials: "DP", specialty: ["日常保养 · 电瓶与电气系统", "Routine servicing · battery & electrical"], bio: ["兼顾效率与细节，擅长常规保养、启动问题和电气检查，让日常用车更加省心。", "Detail-focused servicing, careful electrical checks and practical advice to make everyday car care easier."] },
  { name: "Alex Chen", role: ["实习维修师傅", "Apprentice technician"], age: 22, years: 1, initials: "AC", specialty: ["基础检查 · 轮胎养护", "Essential checks · tyre care"], bio: ["在资深师傅指导下学习车辆检查、轮胎养护和工坊流程，带着热情与耐心成长。", "Learning essential inspections, tyre care and workshop routines under the guidance of the senior team."] },
];
export default function WorkshopTeam({ lang }: { lang: Lang }) {
  const root = useRef<HTMLElement>(null);
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  useEffect(() => {
    if (!root.current || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cards = root.current.querySelectorAll(".team-card");
    cards.forEach(card => card.setAttribute("data-slide", "true"));
    const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } }); }, { threshold: .15 });
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, []);
  return <section className="kw-team" id="team" ref={root} aria-labelledby="team-title">
    <div className="section-heading"><div><p className="eyebrow">{t("认识我们的团队", "THE PEOPLE BEHIND THE CARE")}</p><h1 id="team-title">{t("经验，传承与热情。", "Experience. Care. A fresh perspective.")}</h1></div><p>{t("不同阶段的经验，同样认真对待你的车辆。", "Different generations of experience. The same care for your car.")}</p></div>
    <div className="team-photo"><img src="/media/workshop-team.jpg" width={1774} height={887} loading="lazy" alt={t("维修团队：Frank、Daniel 和 Alex", "Our workshop team: Frank, Daniel and Alex")} /><div className="team-photo-caption">HARBOUR / OUR CREW<span>01 — 03</span></div></div>
    <div className="team-grid">{team.map((person, index) => <article className="team-card" key={person.name} style={{ "--team-delay": `${index * 140}ms` } as CSSProperties}><div className="team-card-top"><span>{person.role[lang === "zh" ? 0 : 1]}</span><span className="team-initials" aria-hidden="true">{person.initials}</span></div><h3>{person.name}</h3><div className="team-facts"><span>{person.age}{t(" 岁", " years old")}</span><span>{person.years}{t(" 年经验", person.years === 1 ? " year learning" : " years of experience")}</span></div><p className="team-specialty">{person.specialty[lang === "zh" ? 0 : 1]}</p><p className="team-bio">{person.bio[lang === "zh" ? 0 : 1]}</p><a href="/#booking" className="team-book">{t("安排到店", "Plan your visit")}<ArrowUpRight size={17} aria-hidden="true" /></a></article>)}</div>
  </section>;
}
