'use client';
import {useState} from 'react';
import portraits from '../data/player-portraits.json';
type Portrait = {src:string;x:number;y:number;size:number};
/** Crop the original screenshot in the viewport, preserving the actual character. */
export default function PlayerAvatar({player,className=''}:{player:{name:string;proName:string};className?:string}) {
 const [failed,setFailed]=useState<string|null>(null);
 const photo=(portraits as Record<string,Portrait>)[player.name.trim().toLowerCase()];
 return <span className={`avatar playerPortrait ${className}`} aria-hidden="true">
  {photo && failed!==photo.src ? <img src={photo.src} alt="" width={1600} height={900} loading="eager" decoding="async" onError={()=>setFailed(photo.src)} style={{position:'absolute',width:`${1600/photo.size*100}%`,maxWidth:'none',height:'auto',left:`${-photo.x/photo.size*100}%`,top:`${-photo.y/photo.size*100}%`}}/> : player.proName.slice(0,2).toUpperCase()}
 </span>;
}
