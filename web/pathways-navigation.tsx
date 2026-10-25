import {useEffect,useState} from 'react';

export function pathwaysRouteFromHash(hash:string):string|null {
 if(hash==='#pathways')return '';
 if(!hash.startsWith('#pathways/update/'))return null;
 try{return decodeURIComponent(hash.slice('#pathways/update/'.length));}catch{return null;}
}
export function openPathways(id='') {
 const hash=id?'#pathways/update/'+encodeURIComponent(id):'#pathways';
 window.history.pushState(null,'',hash);window.dispatchEvent(new HashChangeEvent('hashchange'));
 requestAnimationFrame(()=>{const target=document.getElementById('pathways-title');target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});});
}
export function usePathwaysRoute() {
 const [route,setRoute]=useState(()=>pathwaysRouteFromHash(window.location.hash));
 useEffect(()=>{const change=()=>setRoute(pathwaysRouteFromHash(window.location.hash));window.addEventListener('hashchange',change);window.addEventListener('popstate',change);return()=>{window.removeEventListener('hashchange',change);window.removeEventListener('popstate',change);};},[]);
 useEffect(()=>{if(route===null)return;const frame=requestAnimationFrame(()=>{const target=document.getElementById('pathways-title');target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});});return()=>cancelAnimationFrame(frame);},[route]);
 return route;
}
