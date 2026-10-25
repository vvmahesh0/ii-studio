"use strict";
const button=document.getElementById("copy-prompt");
const feedback=document.getElementById("copy-feedback");
const dialog=document.getElementById("prompt-dialog");
const field=document.getElementById("prompt-text");
const label=button.lastChild;
let prompt="",timer;
function announce(message){clearTimeout(timer);feedback.textContent=message;feedback.hidden=false;timer=setTimeout(()=>{feedback.hidden=true;},4500);}
fetch("/setup-prompt.txt").then(response=>{if(!response.ok)throw new Error("Prompt unavailable");return response.text();}).then(text=>{if(!text.trim())throw new Error("Prompt empty");prompt=text;field.value=text;button.disabled=false;}).catch(()=>{button.disabled=false;button.onclick=()=>announce("The setup prompt could not load. Please refresh and try again.");});
button.addEventListener("click",()=>{
 if(!prompt)return;
 // Begin the clipboard write directly in the click handler to retain activation.
 if(!navigator.clipboard?.writeText){dialog.showModal();field.focus();field.select();return;}
 button.disabled=true;
 let write;
 try { write=navigator.clipboard.writeText(prompt); }
 catch { button.disabled=false;announce("Clipboard access was unavailable. Copy the prompt below.");dialog.showModal();field.focus();field.select();return; }
 let deadline;
 Promise.race([write,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error("Clipboard timeout")),8000);})]).then(()=>{announce("Setup prompt copied. Paste it into your AI agent.");label.textContent="Copied";setTimeout(()=>{label.textContent="Copy prompt for AI agent";},2500);}).catch(()=>{announce("Clipboard access was unavailable. Copy the prompt below.");dialog.showModal();field.focus();field.select();}).finally(()=>{clearTimeout(deadline);button.disabled=false;});
});
document.getElementById("close-prompt").addEventListener("click",()=>dialog.close());
document.getElementById("select-prompt").addEventListener("click",()=>{field.focus();field.select();});
