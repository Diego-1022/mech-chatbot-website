"use client";
import Link from "@/components/page-link";
import {SitePage} from "@/components/site-shell";
import WorkshopTeam from "@/components/workshop-team";
export default function TeamPage(){return <SitePage active="team">{lang=><><WorkshopTeam lang={lang}/><div className="page-container team-next"><Link className="primary" href="/#booking">{lang==="zh"?"安排一次到店":"Arrange your next visit"}</Link></div></>}</SitePage>}
