(()=>{
const $=s=>document.querySelector(s);
const list=$("#tracks"),status=$("#status"),nowTitle=$("#now-title"),time=$("#time");
const playBtn=$("#play"),playIcon=$("#play-icon"),prevBtn=$("#prev"),nextBtn=$("#next");
const back10=$("#back10"),fwd10=$("#fwd10"),shuffleBtn=$("#shuffle"),repeatBtn=$("#repeat");
const bar=$("#bar"),fill=$("#fill");
const audio=new Audio();
audio.preload="metadata";
let tracks=[],index=-1,ready=false,shuffle=false,repeat=false;

const setTitle=text=>{
  nowTitle.classList.remove("scroll");
  nowTitle.innerHTML="";
  const track=document.createElement("span");
  track.className="mq";
  const span=document.createElement("span");
  span.textContent=text;
  track.append(span);
  nowTitle.append(track);
  if(span.offsetWidth>nowTitle.clientWidth){
    nowTitle.classList.add("scroll");
    track.append(span.cloneNode(true));
    track.style.animationDuration=`${Math.max(8,span.offsetWidth/30)}s`;
  }
};

const EXCLUDE=/ma3ho|mazno|\u041c\u0430\u0437\u043d\u043e|sunset[ _-]?cruise/i;
const KEEP=/sunset_cruise-(atmosphere|central_6)/i;
const slugify=t=>t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"track";
const clock=s=>Number.isFinite(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`:"-:--";

const paint=()=>{
  tracks.forEach((t,i)=>t.link.setAttribute("aria-current",i===index?"true":"false"));
  const playing=index>=0&&!audio.paused;
  playIcon.className=playing?"fa-solid fa-pause":"fa-solid fa-play";
  playBtn.setAttribute("aria-label",playing?"Pause":"Play");
};
const tick=()=>{
  const ratio=audio.duration?Math.min(1,audio.currentTime/audio.duration):0;
  fill.style.width=`${ratio*100}%`;
  bar.setAttribute("aria-valuetext",`${clock(audio.currentTime)} of ${clock(audio.duration)}`);
  time.textContent=`${clock(audio.currentTime)}/${clock(audio.duration)}`;
};
const load=(i,hash=true)=>{
  if(i<0||i>=tracks.length)return;
  index=i;
  const t=tracks[i];
  setTitle(`${t.title}${t.year?` (${t.year})`:""}`);
  status.textContent="";fill.style.width="0";
  audio.src=t.src;
  if(hash&&location.hash.slice(1)!==t.slug)history.replaceState(null,"",`#${t.slug}`);
  audio.play().catch(()=>{});
  paint();tick();
};
const durationKey="music-durations";
let cache={};
try{cache=JSON.parse(sessionStorage.getItem(durationKey)||"{}")}catch{}
const probe=async()=>{
  for(const t of tracks){
    if(cache[t.slug]){t.len.textContent=cache[t.slug];continue}
    await new Promise(resolve=>{
      const meta=new Audio();
      meta.preload="metadata";
      const done=()=>{meta.src="";resolve()};
      meta.onloadedmetadata=()=>{t.len.textContent=cache[t.slug]=clock(meta.duration);done()};
      meta.onerror=done;
      meta.src=t.src;
    });
  }
  try{sessionStorage.setItem(durationKey,JSON.stringify(cache))}catch{}
};
const step=d=>{
  if(!tracks.length)return;
  if(shuffle&&d>0&&tracks.length>1){let n;do{n=Math.floor(Math.random()*tracks.length)}while(n===index);return load(n)}
  load((index+d+tracks.length)%tracks.length);
};
const nudge=seconds=>{if(audio.duration)audio.currentTime=Math.min(audio.duration,Math.max(0,audio.currentTime+seconds))};

playBtn.onclick=()=>{if(index<0)return load(0);audio.paused?audio.play().catch(()=>{}):audio.pause()};
prevBtn.onclick=()=>{audio.currentTime>3?audio.currentTime=0:step(-1)};
nextBtn.onclick=()=>step(1);
back10.onclick=()=>nudge(-10);
fwd10.onclick=()=>nudge(10);
shuffleBtn.onclick=()=>{shuffle=!shuffle;shuffleBtn.setAttribute("aria-pressed",shuffle)};
repeatBtn.onclick=()=>{repeat=!repeat;repeatBtn.setAttribute("aria-pressed",repeat)};
const scrub=e=>{const r=bar.getBoundingClientRect();if(audio.duration)audio.currentTime=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width))*audio.duration};
bar.onclick=scrub;
bar.onkeydown=e=>{if(!audio.duration)return;if(e.key==="ArrowRight"){e.preventDefault();audio.currentTime=Math.min(audio.duration,audio.currentTime+5)}else if(e.key==="ArrowLeft"){e.preventDefault();audio.currentTime=Math.max(0,audio.currentTime-5)}};

audio.addEventListener("timeupdate",tick);
audio.addEventListener("loadedmetadata",()=>{if(index>=0)tracks[index].len.textContent=cache[tracks[index].slug]=clock(audio.duration);tick()});
audio.addEventListener("play",paint);
audio.addEventListener("pause",paint);
audio.addEventListener("ended",()=>{if(repeat){audio.currentTime=0;audio.play().catch(()=>{});return}step(1)});
audio.addEventListener("error",()=>{if(index>=0){status.textContent="Could not play this track.";paint()}});
addEventListener("hashchange",()=>{
  if(!ready)return;
  const i=tracks.findIndex(t=>t.slug===decodeURIComponent(location.hash.slice(1)));
  if(i>=0&&i!==index)load(i);
});

fetch("/archive/music/").then(r=>r.text()).then(html=>{
  const doc=new DOMParser().parseFromString(html,"text/html");
  const fragment=document.createDocumentFragment(),used=new Set();
  const anchors=[...doc.querySelectorAll('a[href$=".mp3"]')]
    .filter(a=>{const href=decodeURIComponent(a.getAttribute("href"));
      if(KEEP.test(href))return true;
      return !EXCLUDE.test(href)&&!EXCLUDE.test(a.textContent)});
  anchors.forEach((anchor,i)=>{
    const label=anchor.textContent.trim(),match=label.match(/^\[(\d{4})\]\s*(.*)$/);
    const title=(match?match[2]:label).replace(/\.mp3(?=\s*(?:\[|$))/i,"").replaceAll("_"," ").trim();
    const year=match?match[1]:"";
    const src=new URL(anchor.getAttribute("href"),location.origin+"/archive/music/").href;
    let slug=slugify(title),n=2;
    while(used.has(slug))slug=`${slugify(title)}-${n++}`;
    used.add(slug);
    const item=document.createElement("li"),link=document.createElement("a");
    link.className="track";link.href=`#${slug}`;link.setAttribute("aria-current","false");
    link.innerHTML='<span class="t"></span>';
    link.querySelector(".t").textContent=title;
    if(year){const y=document.createElement("span");y.className="year";y.textContent=year;link.append(y)}
    const len=document.createElement("span");len.className="len";len.textContent="--:--";link.append(len);
    link.onclick=e=>{e.preventDefault();index===i?playBtn.click():load(i)};
    item.append(link);fragment.append(item);
    tracks.push({title,year,src,slug,link,len});
  });
  list.append(fragment);
  ready=true;
  tick();
  probe();
  const wanted=tracks.findIndex(t=>t.slug===decodeURIComponent(location.hash.slice(1)));
  if(wanted>=0)load(wanted);
}).catch(()=>{status.innerHTML='Could not load the catalogue. <a href="/archive/music/">Browse the archive directly.</a>'});
})();
