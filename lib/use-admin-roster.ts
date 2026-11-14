"use client";

import {useCallback,useEffect,useState} from "react";
import {rosterWeekStart,type RosterWeek} from "./admin-roster";

const emptyWeek: RosterWeek = {shifts:[],requests:[],revision:0};

export function useRosterShifts(date:string) {
  const week=rosterWeekStart(date);
  const [reload,setReload]=useState(0);
  const [result,setResult]=useState<{week:string;reload:number;data:RosterWeek | null}>();
  const refresh=useCallback(()=>setReload(value=>value+1),[]);

  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/admin-roster?week="+encodeURIComponent(week),{signal:controller.signal,cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw Error("Roster unavailable");
        const data=await response.json() as RosterWeek;
        if(!controller.signal.aborted)setResult({week,reload,data});
      })
      .catch(()=>{
        if(!controller.signal.aborted)setResult({week,reload,data:null});
      });
    return ()=>controller.abort();
  },[week,reload]);

  const sameWeek=result?.week===week;
  const data=sameWeek?result.data:null;
  const loading=!sameWeek || result.reload!==reload;
  return {...(data??emptyWeek),loading,error:!loading&&!data,refresh};
}
