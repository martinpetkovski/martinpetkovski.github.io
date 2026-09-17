(()=>{
const list=document.querySelector("#tracks"),status=document.querySelector("#status"),stop=document.querySelector("#stop");
let context,source,request,active;
const halt=()=>{if(source){source.onended=null;try{source.stop()}catch{}source.disconnect();source=null}if(active){active.removeAttribute("aria-current");active=null}stop.hidden=true};
const play=async button=>{
  halt();
  request?.abort();
  request=new AbortController();
  active=button;
  button.setAttribute("aria-current","true");
  status.textContent=`Loading ${button.textContent.trim()}…`;
  try{
    context??=new(window.AudioContext||window.webkitAudioContext)();
    if(context.state==="suspended")await context.resume();
    const response=await fetch(button.dataset.src,{signal:request.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const buffer=await context.decodeAudioData(await response.arrayBuffer());
    if(active!==button)return;
    source=context.createBufferSource();
    source.buffer=buffer;
    source.connect(context.destination);
    source.onended=()=>{if(active===button){halt();status.textContent="Finished."}};
    source.start();
    stop.hidden=false;
    status.textContent=`Playing ${button.textContent.trim()}`;
  }catch(error){
    if(error.name!=="AbortError"){halt();status.textContent="Could not play this track."}
  }
};
stop.onclick=()=>{request?.abort();halt();status.textContent="Stopped."};
fetch("/archive/music/").then(response=>response.text()).then(html=>{
  const documentCopy=new DOMParser().parseFromString(html,"text/html");
  const tracks=[...documentCopy.querySelectorAll('a[href$=".mp3"]')];
  const fragment=document.createDocumentFragment();
  for(const track of tracks){
    const item=document.createElement("li"),button=document.createElement("button");
    const label=track.textContent.trim(),match=label.match(/^\[(\d{4})\]\s*(.*)$/);
    button.type="button";
    button.className="track";
    button.dataset.src=new URL(track.getAttribute("href"),location.origin+"/archive/music/").href;
    button.textContent=(match?match[2]:label).replace(/\.mp3(?=\s*(?:\[|$))/i,"").replaceAll("_"," ");
    button.onclick=()=>play(button);
    item.append(button);
    if(match){const year=document.createElement("span");year.className="year";year.textContent=` · ${match[1]}`;item.append(year)}
    fragment.append(item);
  }
  list.append(fragment);
  status.textContent=`${tracks.length} tracks.`;
}).catch(()=>{status.innerHTML='Could not load the catalogue. <a href="/archive/music/">Browse the archive directly.</a>'});
})();
