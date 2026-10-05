import {redirect} from "next/navigation";
import {standalone} from "@/lib/deployment";
import Login from "./login";
export default function Page(){if(!standalone)redirect("/signin-with-chatgpt?return_to=/admin");return <Login/>;}
