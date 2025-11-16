/* Shared NS2 play logic extracted from editor.html and reader.html */
(function(){
    // Shared play logic; waits for Module readiness via custom event.
    const g = (typeof window !== 'undefined') ? window : globalThis;
    function ensureModule(){ return g.Module || null; }
    // Fallback helpers if host page did not define them
    function escapeHtml(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
    function normalizeForMatching(s){ if(!s) return ''; return String(s).replace(/\s+/g,' ').trim(); }
    function allocateUTF8(str){ const Module = ensureModule(); if(!Module) return 0; const size = Module.lengthBytesUTF8(str)+1; const ptr = Module._malloc(size); Module.stringToUTF8(str,ptr,size); return ptr; }
    function getLastError(engine){ const Module = ensureModule(); if(!Module || !engine) return ''; try{ const ptr = Module._GetStoryLastError(engine); const err = Module.UTF8ToString(ptr); Module._FreeString(ptr); return err; }catch(e){ return String(e); } }
    function setStatus(msg,isErr){ const el = document.getElementById('status-content'); if(!el) return; el.innerHTML = escapeHtml(msg||'Ready'); el.style.color = isErr ? '#ff6b6b' : '#D4D4D4'; }

    // Public state
    g.playEngine = g.playEngine || null;
    let playAvailabilityInterval = null;

    function generateNS2Content(){ const Module = ensureModule(); if(!Module) return ''; try{ const ptr = Module._GenerateNS2Content(g.editorEngine || g.playEngine); const content = Module.UTF8ToString(ptr); Module._FreeString(ptr); return content; }catch(e){ return ''; } }

    async function startPlayEngine(){ const Module = ensureModule(); if(!Module){ return; } try{
        if(g.playEngine){ if(playAvailabilityInterval){ clearInterval(playAvailabilityInterval); playAvailabilityInterval=null; } Module._DestroyEngine(g.playEngine); g.playEngine=null; }
        g.playEngine = Module._CreateEngine();
        // Load story from localStorage when no editorEngine present (reader.html scenario)
        let content = ''; if(g.editorEngine){ content = generateNS2Content(); } else { content = localStorage.getItem('ns2_content') || ''; }
        if(content){ Module.FS.writeFile('/story.ns2', content); const pathPtr = allocateUTF8('/story.ns2'); Module._LoadFromFile(g.playEngine, pathPtr); Module._free(pathPtr); }
        Module._Start(g.playEngine); updatePlay(); setStatus((g.languages && g.languages[g.currentLanguage] && g.languages[g.currentLanguage]['playEngineStarted']) || 'Play engine started');
    }catch(e){ const errMsg = 'Error: '+e.message; const pe = document.getElementById('play-error'); if(pe) pe.textContent = errMsg; setStatus(errMsg,true); }}

    function restartStory(){ startPlayEngine(); setStatus((g.languages && g.languages[g.currentLanguage] && g.languages[g.currentLanguage]['storyRestarted']) || 'Story restarted'); }

    function saveProgress(){ const Module = ensureModule(); if(!Module || !g.playEngine){ setStatus('No play engine running',true); return; } try{ const savePath='/save.save'; const p=allocateUTF8(savePath); Module._SaveProgress(g.playEngine,p); Module._free(p); const saveContent = Module.FS.readFile(savePath,{encoding:'utf8'}); const blob=new Blob([saveContent],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='story.save'; a.click(); URL.revokeObjectURL(url); const err=getLastError(g.playEngine); if(err) setStatus('Error saving progress: '+err,true); else setStatus('Progress saved'); }catch(e){ setStatus('Save failed: '+e.message,true); }}

    function loadProgress(file){ const Module = ensureModule(); if(!Module || !g.playEngine){ setStatus('No play engine running',true); return; } try{ const reader = new FileReader(); reader.onload = ev => { try{ const saveContent = ev.target.result; const savePath='/save.save'; Module.FS.writeFile(savePath, saveContent); const p=allocateUTF8(savePath); Module._LoadProgress(g.playEngine,p); Module._free(p); updatePlay(); const err=getLastError(g.playEngine); if(err) setStatus('Error loading progress: '+err,true); else setStatus('Progress loaded successfully'); }catch(er){ setStatus('Load failed: '+er.message,true); } }; reader.readAsText(file); }catch(e){ setStatus('Load init failed: '+e.message,true); }}

    function setVariableValue(name,value){ const Module = ensureModule(); if(!Module || !g.playEngine) return; const namePtr = allocateUTF8(name); const valuePtr = allocateUTF8(value); Module._SetVariableValue(g.playEngine,namePtr,valuePtr); Module._free(valuePtr); Module._free(namePtr); updatePlay(); const err=getLastError(g.playEngine); if(err) setStatus('Error setting variable: '+err,true); }

    function performChoice(index){ const Module = ensureModule(); if(!Module || !g.playEngine) return; try{ Module._Choose(g.playEngine, index); updatePlay(); }catch(e){ setStatus('Choice failed: '+e.message,true); }}

    function refreshPlayChoiceAvailability(){ const Module = ensureModule(); if(!Module || !g.playEngine) return; const pActionsPtr=Module._malloc(4); const countAvailable=Module._GetAvailableActions(g.playEngine,pActionsPtr); const actionsArrayPtr=Module.getValue(pActionsPtr,'i32'); const map = new Map(); for(let ai=0; ai<countAvailable; ai++){ const strPtr = Module.getValue(actionsArrayPtr + ai*4,'i32'); const txt = Module.UTF8ToString(strPtr); const key=normalizeForMatching(txt); if(!map.has(key)) map.set(key,[]); map.get(key).push(ai); } const choicesDiv=document.getElementById('play-choices'); if(choicesDiv){ [...choicesDiv.querySelectorAll('button')].forEach(btn=>{ const text = btn.dataset.choiceText || btn.textContent || ''; const key=normalizeForMatching(text); const arr = map.get(key); if(!arr || !arr.length){ btn.classList.add('disabled'); btn.title='Choice unavailable'; btn.onclick=null; } else { btn.classList.remove('disabled'); btn.onclick=()=>performChoice(parseInt(btn.dataset.choiceIndex||'0',10)); } }); } Module._FreeStrings(actionsArrayPtr,countAvailable); Module._free(pActionsPtr); }

    function filterPlayVars(){ const searchInput = document.getElementById('play-var-search'); if(!searchInput) return; const q = normalizeForMatching(searchInput.value||'').toLowerCase(); const rows = document.querySelectorAll('#play-variables tbody tr'); rows.forEach(row=>{ try{ const name=normalizeForMatching(row.cells[0].textContent||'').toLowerCase(); row.style.display = name.includes(q) ? '' : 'none'; }catch(e){ row.style.display=''; } }); }

    function filterPlayChoices(){ const searchInput = document.getElementById('choice-search-play'); if(!searchInput) return; const q = normalizeForMatching(searchInput.value||'').toLowerCase(); const buttons = document.querySelectorAll('#play-choices button'); buttons.forEach(btn=>{ const txt=normalizeForMatching(btn.textContent||'').toLowerCase(); btn.style.display = txt.includes(q) ? '' : 'none'; }); }

    function updatePlay(){ const Module = ensureModule(); if(!Module || !g.playEngine){ const t=document.getElementById('play-title'); if(t) t.textContent=''; const d=document.getElementById('play-desc'); if(d) d.innerHTML='<em>Click "Start" to begin.</em>'; const c=document.getElementById('play-choices'); if(c) c.innerHTML=''; const v=document.getElementById('play-variables'); if(v) v.innerHTML=''; return; } const stateCount = Module._GetStateCount(g.playEngine); if(stateCount===0){ const t=document.getElementById('play-title'); if(t) t.textContent='No Story Loaded'; const d=document.getElementById('play-desc'); if(d) d.innerHTML='<em>Create states and set a start state.</em>'; return; }
        const titlePtr = Module._GetCurrentTitle(g.playEngine); const title = Module.UTF8ToString(titlePtr); Module._FreeString(titlePtr); const t=document.getElementById('play-title'); if(t) t.textContent=title; const descPtr = Module._GetCurrentDescription(g.playEngine); const desc = Module.UTF8ToString(descPtr); Module._FreeString(descPtr); const d=document.getElementById('play-desc'); if(d) d.textContent=desc; const errorPtr = Module._GetStoryLastError(g.playEngine); const error = Module.UTF8ToString(errorPtr); Module._FreeString(errorPtr); const pe=document.getElementById('play-error'); if(pe) pe.innerHTML=escapeHtml(error).replace(/\n/g,'<br>'); if(error) setStatus(error,true);
        // Variables table
        const variablesDiv=document.getElementById('play-variables'); if(variablesDiv){ variablesDiv.innerHTML=''; const table=document.createElement('table'); table.innerHTML='<thead><tr><th>Variable</th><th>Value</th></tr></thead><tbody></tbody>'; const tbody=table.querySelector('tbody'); const count=Module._GetVariableCount(g.playEngine); for(let i=0;i<count;i++){ const namePtr=Module._GetVariableName(g.playEngine,i); const name=Module.UTF8ToString(namePtr); Module._FreeString(namePtr); const namePtrVal=allocateUTF8(name); const valuePtr=Module._GetVariableValue(g.playEngine,namePtrVal); const value=Module.UTF8ToString(valuePtr); Module._FreeString(valuePtr); Module._free(namePtrVal); const tr=document.createElement('tr'); tr.innerHTML = '<td>'+escapeHtml(name)+'</td><td><input value="'+escapeHtml(value)+'" onchange="setVariableValue(\''+escapeHtml(name)+'\', this.value)" onblur="setVariableValue(\''+escapeHtml(name)+'\', this.value)"></td>'; tbody.appendChild(tr); } variablesDiv.appendChild(table); }
        filterPlayVars();
        // Choices
        const pActionsPtr=Module._malloc(4); const countAvailable=Module._GetAvailableActions(g.playEngine,pActionsPtr); const actionsArrayPtr=Module.getValue(pActionsPtr,'i32'); const choicesDiv=document.getElementById('play-choices'); if(choicesDiv){ choicesDiv.innerHTML=''; const totalChoices=Module._GetCurrentChoicesCount(g.playEngine); for(let ci=0; ci<totalChoices; ci++){ const textPtr=Module._GetChoiceText(g.playEngine,ci); const text=Module.UTF8ToString(textPtr); Module._FreeString(textPtr); const btn=document.createElement('button'); btn.textContent = text; btn.dataset.choiceText = text; btn.dataset.choiceIndex = String(ci); btn.onclick = ()=>performChoice(ci); choicesDiv.appendChild(btn); } }
        Module._FreeStrings(actionsArrayPtr,countAvailable); Module._free(pActionsPtr); refreshPlayChoiceAvailability(); filterPlayChoices(); if(playAvailabilityInterval) clearInterval(playAvailabilityInterval); playAvailabilityInterval = setInterval(()=>{ if(!g.playEngine){ clearInterval(playAvailabilityInterval); playAvailabilityInterval=null; return; } refreshPlayChoiceAvailability(); },500); if(Module._IsEnded(g.playEngine)){ if(d) d.textContent += '\n\nThe story has ended.'; }
    }

    // Expose API
    g.startPlayEngine = startPlayEngine;
    g.restartStory = restartStory;
    g.saveProgress = saveProgress;
    g.loadProgress = function(){ const inp=document.getElementById('load-save'); if(inp && inp.files && inp.files[0]) loadProgress(inp.files[0]); };
    g.updatePlay = updatePlay;
    g.filterPlayVars = filterPlayVars;
    g.filterPlayChoices = filterPlayChoices;
    g.refreshPlayChoiceAvailability = refreshPlayChoiceAvailability;
    g.setVariableValue = setVariableValue;
    g.performChoice = performChoice;
    // Auto-start when module becomes ready (editor dispatches 'ns2-module-ready').
    function maybeAutoStart(){
        if(!ensureModule() || g.__playAutoStarted) return;
        // Start only if play tab markup present
        if(document.getElementById('play-title')){
            g.__playAutoStarted = true;
            startPlayEngine();
        }
    }
    if(g.addEventListener){
        g.addEventListener('ns2-module-ready', maybeAutoStart);
        // Fallback polling in case event not dispatched (e.g., reader.html standalone timing)
        let tries = 0;
        const poll = setInterval(()=>{ tries++; maybeAutoStart(); if(g.__playAutoStarted || tries>20) clearInterval(poll); },250);
    }
})();
