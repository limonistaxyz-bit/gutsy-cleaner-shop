"use client";
import {FormEvent,useEffect,useMemo,useState} from "react";

const products=[
 {id:"starter",name:"Gutsy Cleaner Starter Kit",price:25,tag:"The whole shebang",copy:"Includes one 8 oz bottle of concentrate, one 16 oz spray bottle filled with ready-to-use Gutsy Cleaner, and one cleaning cloth.",color:"yellow"},
 {id:"concentrate",name:"Gutsy Concentrate",price:7,tag:"Refill, not landfill",copy:"8 oz concentrate. Spray bottle not included. Mix equal parts concentrate and water. For a bottle smaller than 16 oz, fill it halfway with concentrate and halfway with water.",color:"green"},
 {id:"bottle",name:"Ready-to-Use Gutsy Cleaner",price:9,tag:"No mixing needed",copy:"16 oz of Gutsy Cleaner in a reusable spray bottle. No mixing or added water needed—just spray and clean.",color:"blue"},
] as const;
type Id=(typeof products)[number]["id"];
type Cart=Record<Id,number>;
const empty:Cart={starter:0,concentrate:0,bottle:0};
const BATCH_LIMIT=12;
const initialBatch={remaining:12,capacity:12,pickupLabel:"Saturday, October 3, 2026",cutoffLabel:"Thursday, October 1, 6:00 PM",isOpen:true};

export default function Home(){
 const [cart,setCart]=useState<Cart>(empty); const [open,setOpen]=useState(false);
 const [step,setStep]=useState<"bag"|"details">("bag");
 const [batch,setBatch]=useState(initialBatch); const available=batch.remaining;
 const [form,setForm]=useState({name:"",email:"",mobile:""});
 const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 useEffect(()=>{fetch("/api/inventory").then(r=>r.json()).then(x=>setBatch(x)).catch(()=>{});},[]);
 const count=Object.values(cart).reduce((a,b)=>a+b,0);
 const total=useMemo(()=>products.reduce((s,p)=>s+p.price*cart[p.id],0),[cart]);
 const remaining=Math.max(0,available-count);
 const change=(id:Id,n:number)=>setCart(c=>{
  const currentTotal=Object.values(c).reduce((a,b)=>a+b,0);
  if(n>0&&currentTotal>=available)return c;
  return {...c,[id]:Math.max(0,c[id]+n)};
 });
 const checkout=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError("");try{const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,cart})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Checkout could not start.");location.href=data.url;}catch(e){setError(e instanceof Error?e.message:"Checkout could not start.");setBusy(false);}};
 return <main>
  <header><a className="brand" href="#top"><b>G</b><span>Gutsy Cleaner<small>by Limonista</small></span></a><button className="bag" onClick={()=>setOpen(true)}>Your bag <i>{count}</i></button></header>
  <section className="hero" id="top"><div className="heroCopy"><p className="kicker">Made from lemonade&apos;s leftovers</p><h1>Turns out,<br/>lemon guts<br/><em>have purpose.</em></h1><p className="intro">A small-batch lemon-vinegar surface cleaner made from the peels and guts left behind when Limonista makes real lemonade.</p><a className="shopLink" href="#shop">Shop the first batch ↓</a></div><div className="heroImage"><img src="/gutsy-still-life.png" alt="Lemon peels and lemon vinegar infusion in a sunny kitchen"/></div></section>
  <div className="band"><span>{batch.pickupLabel} pickup</span><b>✦</b><span>Senoia Farmers Market</span><b>✦</b><span>{batch.capacity}-item batch</span></div>
  <section className="batchFacts" aria-label="Current preorder batch details"><div><p className="kicker">Current preorder batch</p><h2>Order now. Pick up at the market.</h2></div><dl><div><dt>Pickup</dt><dd>{batch.pickupLabel}, between 8:30 AM and 1:00 PM</dd></div><div><dt>Location</dt><dd>Senoia Farmers Market, 40 Travis Street, Senoia, GA — Stall 33</dd></div><div><dt>Order cutoff</dt><dd>{batch.cutoffLabel}</dd></div><div><dt>Batch size</dt><dd>{batch.capacity} total items</dd></div></dl></section>
  <section className="shop" id="shop"><div className="heading"><div><p className="kicker">Meet the Gutsy lineup</p><h2>Clean with a little backbone.</h2></div><p>Choose what you need, then pick up at Senoia Farmers Market, 40 Travis Street, Senoia, GA, Stall 33, between 8:30 AM and 1:00 PM. Preorders close {batch.cutoffLabel} or when the batch is full.</p></div><div className="capacity"><span>Current batch capacity</span><strong>{available} of {batch.capacity} items still available</strong></div><div className="grid">{products.map((p,i)=><article className={p.color} key={p.id}><span className="num">0{i+1}</span><p className="tag">{p.tag}</p><h3>{p.name}</h3><p className="copy">{p.copy}</p><div className="productFoot"><strong>${p.price}</strong>{cart[p.id]===0?<button disabled={remaining===0||!batch.isOpen} onClick={()=>change(p.id,1)}>{!batch.isOpen?"Preorders closed":remaining===0?"Batch limit reached":"Add to bag"}</button>:<div className="qty"><button onClick={()=>change(p.id,-1)}>−</button><span>{cart[p.id]}</span><button disabled={remaining===0} onClick={()=>change(p.id,1)}>+</button></div>}</div></article>)}</div></section>
  <section className="note"><div className="stamp">GOOD<br/>GUTS</div><div><p className="kicker">Know before you spray</p><h2>For everyday surface cleaning.</h2></div><p>Use on counters, sinks, refrigerator doors, stovetops and mirrors. Do not drink. Do not use on marble or natural stone. Ingredients: lemon peel, lemon pith and vinegar.</p></section>
  <footer><span>Gutsy Cleaner by Limonista</span><span>Made in Georgia with leftover lemons &amp; good sense.</span></footer>
  {open&&<div className="overlay" onMouseDown={()=>setOpen(false)}><aside onMouseDown={e=>e.stopPropagation()}><div className="cartHead"><div><p className="kicker">{batch.pickupLabel} market pickup</p><h2>{step==="bag"?"Your bag":"Pickup details"}</h2></div><button aria-label="Close bag" onClick={()=>setOpen(false)}>×</button></div><div className="pickupMini"><strong>Senoia Farmers Market · Stall 33</strong><span>40 Travis Street, Senoia, GA · 8:30 AM–1:00 PM</span></div>{step==="bag"?<>{count===0?<p className="empty">Your bag has plenty of room—and zero guts.</p>:<div className="lines">{products.filter(p=>cart[p.id]>0).map(p=><div className="line" key={p.id}><div><strong>{p.name}</strong><small>${p.price} each</small></div><div className="qty"><button onClick={()=>change(p.id,-1)}>−</button><span>{cart[p.id]}</span><button disabled={remaining===0} onClick={()=>change(p.id,1)}>+</button></div></div>)}</div>}<div className="total"><span>Total</span><strong>${total.toFixed(2)}</strong></div><button className="checkout" disabled={!count||!batch.isOpen} onClick={()=>setStep("details")}>Continue to pickup details</button></>:<form className="checkoutForm" onSubmit={checkout}><button type="button" className="backButton" onClick={()=>setStep("bag")}>← Back to bag</button><label>Name<input required autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Mobile number<input required type="tel" autoComplete="tel" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/></label><label>Email<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><div className="total"><span>Total</span><strong>${total.toFixed(2)}</strong></div>{error&&<p className="formError" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy?"Opening secure payment…":"Pay securely with Stripe"}</button><p className="secureNote">Your items are held for 30 minutes while you pay.</p></form>}</aside></div>}
 </main>
}
