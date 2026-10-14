'use client';
export default function Companion({person='maya',gesture='welcome'}:{person?:'maya'|'arjun';gesture?:'welcome'|'thinking'|'celebrate'}){
 const girl=person==='maya';
 return <svg className={`companion ${person} gesture-${gesture}`} viewBox="0 0 180 230" role="img" aria-label={girl?'Maya, a friendly Nepali guide in a red gunyo cholo':'Arjun, a friendly Nepali guide in daura suruwal and Dhaka topi'}>
 <defs><linearGradient id={`cloth-${person}`} x2="1" y2="1"><stop stopColor={girl?'#e96146':'#f4e7cc'}/><stop offset="1" stopColor={girl?'#b93832':'#d5c5a7'}/></linearGradient></defs>
 <ellipse cx="90" cy="219" rx="46" ry="7" fill="#314e3b" opacity=".09"/>
 {girl?<><path d="M60 144L45 209Q90 224 135 209L120 144" fill="#bf4236"/><path d="M52 202Q90 214 128 202" stroke="#e8b957" strokeWidth="8"/><path d="M70 210v8m40-8v8" stroke="#8a4533" strokeWidth="11" strokeLinecap="round"/></>:<><path d="M61 151l5 59 19 1 5-43 6 43 20-1 5-59" fill="#e4d7bd"/><path d="M63 214h22m12 0h22" stroke="#493f36" strokeWidth="11" strokeLinecap="round"/></>}
 <path d="M62 99Q90 89 118 99l12 59q-40 22-80 0z" fill={`url(#cloth-${person})`}/>
 {!girl&&<><path d="M65 103l43 47M111 102l-39 48" stroke="#bca786" strokeWidth="2"/><path d="M51 153q39 14 78 0" stroke="#8f6851" strokeWidth="7"/><path d="M58 101l-8 42 15 6 12-48M119 101l13 41-15 7-14-49" fill="#375b4a"/></>}
 {girl&&<><path d="M108 98l-45 62 17 8 43-56" fill="#edbd5b"/><path d="M74 99q16 19 32 0" fill="none" stroke="#e9b747" strokeWidth="4"/><circle cx="90" cy="112" r="5" fill="#e9b747"/></>}
 <path d="M81 79v19q9 10 18 0V79" fill="#c78e65"/>
 <path d="M57 41q-7 41 15 50l35 0q22-15 15-50z" fill="#302d29"/>
 {girl&&<path d="M56 57q-11 50 11 58l6-36 35 0 9 36q18-12 6-60" fill="#302d29"/>}
 <ellipse cx="90" cy="57" rx="29" ry="35" fill="#e8b78a"/>
 <ellipse cx="60" cy="61" rx="5" ry="8" fill="#e0a878"/><ellipse cx="120" cy="61" rx="5" ry="8" fill="#e0a878"/>
 <path d="M62 43q6-32 35-23 23 2 23 26-13-3-24-18-11 14-34 15" fill="#302d29"/>
 {!girl&&<><path d="M59 32l4-22q25-15 54 1l5 22-31-6z" fill="#bd6154"/><path d="M61 23l12-8 11 9 11-10 11 10 12-7" stroke="#f0d2aa" strokeWidth="4" fill="none"/><path d="M60 31q30-9 61 1" stroke="#774c45" strokeWidth="4"/></>}
 <g className="companion-eyes"><path d="M73 56q4-5 8 0M100 56q4-5 8 0" fill="none" stroke="#443a31" strokeWidth="2.7" strokeLinecap="round"/></g>
 <path d="M88 61l-2 7h5" fill="none" stroke="#c58a62" strokeWidth="2" strokeLinecap="round"/><path d="M80 75q10 10 20-1" fill="#fff9eb" stroke="#a76a51" strokeWidth="1.3"/>
 <ellipse cx="70" cy="67" rx="6" ry="3" fill="#dc8d75" opacity=".55"/><ellipse cx="110" cy="67" rx="6" ry="3" fill="#dc8d75" opacity=".55"/>
 {girl&&<><circle cx="90" cy="46" r="2.5" fill="#b34237"/><circle cx="61" cy="73" r="4" fill="#e9b747"/><circle cx="119" cy="73" r="4" fill="#e9b747"/></>}
 <g className="companion-left-arm"><path d="M62 104q-15 8-18 31l12 3 16-22" fill={girl?'#cf493a':'#e7d8b9'}/><path d="M48 134q18 9 34-15" fill="none" stroke="#e8b78a" strokeWidth="10" strokeLinecap="round"/><path d="M82 122l7-13" stroke="#e8b78a" strokeWidth="9" strokeLinecap="round"/></g>
 <g className="companion-wave"><path d="M117 104q13 9 18 30l-13 4-15-23" fill={girl?'#cf493a':'#e7d8b9'}/><path d="M130 133q11-12 3-34" fill="none" stroke="#e8b78a" strokeWidth="10" strokeLinecap="round"/><path d="M133 101l-2-14m2 11 5-12m-7 12-6-10" stroke="#e8b78a" strokeWidth="5" strokeLinecap="round"/></g>
 </svg>;
}
