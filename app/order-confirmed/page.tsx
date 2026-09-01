"use client";
import {useEffect,useState} from 'react';
type Order={order_number:string;amount_cents:number;pickup_label:string};
export default function Confirmed(){
 const [state,setState]=useState<{loading:boolean;error?:string;order?:Order}>({loading:true});
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;const id=new URLSearchParams(location.search).get('order');setState({loading:true});fetch(`/api/checkout/confirm?order=${encodeURIComponent(id??'')}`,{cache:'no-store'}).then(async r=>{const j=await r.json() as {error?:string;order?:Order};if(!r.ok)throw new Error(j.error);if(active)setState({loading:false,order:j.order});}).catch(e=>{if(active)setState({loading:false,error:e.message});});return()=>{active=false;};},[attempt]);
 return <main className="confirmation"><div className="confirmCard"><p className="kicker">Market pickup</p>{state.loading?<h1>Confirming your order…</h1>:state.error?<><h1>We’re checking your payment.</h1><p>{state.error}</p><button className="checkout" onClick={()=>setAttempt(x=>x+1)}>Check again</button></>:<><h1>You’re on the pickup list.</h1><p>Your order number is <strong>{state.order?.order_number}</strong>.</p><dl><div><dt>Pickup</dt><dd>{state.order?.pickup_label}, 8:30 AM–1:00 PM</dd></div><div><dt>Where</dt><dd>Senoia Farmers Market, Stall 33, 40 Travis St, Senoia, GA 30276-1811</dd></div><div><dt>Paid</dt><dd>${((state.order?.amount_cents??0)/100).toFixed(2)} through Square</dd></div></dl></>}<a className="shopLink" href="/">Back to Gutsy Cleaner</a></div></main>;
}
