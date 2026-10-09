import type { Metadata } from "next";import "./globals.css";import "./kingsway.css";import "./design-preview.css";
export const metadata:Metadata={title:"Harbour Auto | Car care & online booking",description:"Car care, indicative pricing and online appointments. A classroom demonstration.",icons:{icon:"/favicon.svg"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
