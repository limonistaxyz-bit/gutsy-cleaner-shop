"use client";
import {FormEvent,useState} from "react";

export default function BatchControls({pickupDate,capacity,cutoffLabel}:{pickupDate:string;capacity:number;cutoffLabel:string}){
 const [date,setDate]=useState(pickupDate); const [limit,setLimit]=useState(capacity); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");const r=await fetch("/api/admin/batches",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pickupDate:date,capacity:limit})});const data=await r.json() as {error?:string};if(!r.ok){setMessage(data.error||"Could not open this batch.");setBusy(false);return;}location.reload();}
 return <section className="batchControls"><div><p className="kicker">Weekly setup</p><h2>Open the next batch</h2><p>Choose a Saturday. The order cutoff will automatically be the Thursday before at 6:00 PM.</p></div><form onSubmit={submit}><label>Saturday pickup date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Total item limit<input type="number" min="1" max="100" required value={limit} onChange={e=>setLimit(Number(e.target.value))}/></label><button disabled={busy}>{busy?"Opening…":"Open this batch"}</button>{message&&<p role="alert">{message}</p>}<small>Current cutoff: {cutoffLabel}</small></form></section>
}
