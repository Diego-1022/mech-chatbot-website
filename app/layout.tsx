import type { Metadata } from "next";import "./globals.css";import "./kingsway.css";import "./design-preview.css";
export const metadata:Metadata={title:"Harbour Auto | Car care & online booking",description:"Car care, an experienced workshop team, indicative pricing and online appointments in Sydney.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
