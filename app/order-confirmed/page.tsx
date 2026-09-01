"use client";
import {useEffect,useState} from "react";
export default function Confirmed(){
 const [state,setState]=useState<{loading:boolean;error?:string;order?:{order_number:string;customer_name:string;email:string;amount_cents:number}}>({loading:true});
 useEffect(()=>{const id=new URLSearchParams(location.search).get("session_id");fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(id??"")}`).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setState({loading:false,order:j.order});}).catch(e=>setState({loading:false,error:e.message}));},[]);
 return <main className="confirmation"><div className="confirmCard"><p className="kicker">October 3 market pickup</p>{state.loading?<h1>Confirming your order…</h1>:state.error?<><h1>We’re checking your payment.</h1><p>{state.error}</p></>:<><h1>You’re on the pickup list.</h1><p>Thanks, {state.order?.customer_name}. Your order number is <strong>{state.order?.order_number}</strong>.</p><dl><div><dt>Pickup</dt><dd>Saturday, October 3, 2026, 8:30 AM–1:00 PM</dd></div><div><dt>Where</dt><dd>Senoia Farmers Market, 40 Travis Street, Senoia, GA — Stall 33</dd></div><div><dt>Receipt</dt><dd>Sent by Stripe to {state.order?.email}</dd></div></dl></>}<a className="shopLink" href="/">Back to Gutsy Cleaner</a></div></main>
}
