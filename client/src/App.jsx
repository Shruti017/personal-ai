import React, { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import {
  Activity, Archive, ArrowDown, ArrowUp, Bot, Check, CheckCircle2, ChevronDown,
  CircleHelp, FileImage, FileText, FolderOpen, Globe, Menu, MessageSquare,
  Moon, MoreHorizontal, Paperclip, Plus, Search, Send, Settings, Sparkles,
  Sun, Trash2, UploadCloud, X, Brain, ListTodo, LogOut, PanelLeftClose
} from "lucide-react";
import { api, getToken, setToken, streamChat } from "./api";

marked.setOptions({ gfm: true, breaks: true });

function Markdown({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || "")), [text]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Landing({ onChat, prompt, setPrompt }) {
  const [deepThink, setDeepThink] = useState(false);
  const [searchEnabled, setSearchEnabled] = useState(false);
  return <main className="landing-shell">
    <div className="landing-grid" />
    <header className="landing-nav">
      <a className="landing-brand" href="#home" aria-label="Personal AI home"><span className="landing-brand-mark"><Sparkles size={19}/></span><strong>Personal AI</strong></a>
      <div className="landing-nav-right"><span className="landing-powered">PERSONAL AI AGENT</span><button className="landing-get-started" onClick={onChat}>Get started <ArrowUpRightIcon/></button></div>
    </header>
    <section className="landing-hero" id="home">
      <p className="landing-announcement"><Sparkles size={14}/> A personal workspace for thinking, research, and getting things done</p>
      <h1>Into the <span>Unknown.</span></h1>
      <p className="landing-subtitle">Your ideas, files, research, and everyday work. All in one AI workspace.</p>
      <form className="landing-prompt-card" onSubmit={e=>{e.preventDefault();onChat();}}>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask anything, explore together" rows={2} aria-label="Your message" />
        <div className="landing-prompt-footer">
          <div className="landing-prompt-options">
            <button type="button" className={deepThink?"active":""} onClick={()=>setDeepThink(v=>!v)}><Brain size={14}/> DeepThink</button>
            <button type="button" className={searchEnabled?"active":""} onClick={()=>setSearchEnabled(v=>!v)}><Globe size={14}/> Search</button>
          </div>
          <button className="landing-send" type="submit" aria-label="Continue to chat"><ArrowUp size={19}/></button>
        </div>
      </form>
      <button className="landing-chat-cta" onClick={onChat}><MessageSquare size={17}/> Chat with AI <ArrowUpRightIcon/></button>
      <div className="landing-capabilities">
        <span><Bot size={15}/> Personal AI assistant</span><i />
        <span><FolderOpen size={15}/> Your files and knowledge</span><i />
        <span><Globe size={15}/> Research and tools</span>
      </div>
    </section>
    <footer className="landing-footer"><span>PERSONAL AI · YOUR PRIVATE WORKSPACE</span><span>Built for curious minds.</span></footer>
  </main>;
}

function ArrowUpRightIcon() { return <span aria-hidden="true" className="arrow-up-right">↗</span>; }

function Auth({ onLogin, onBack }) {
  const [mode,setMode] = useState("login");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const data = await api(`/auth/${mode}`, { method:"POST", body:JSON.stringify({name,email,password}) });
      setToken(data.token); onLogin(data.user);
    } catch(err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-glow" /><section className="auth-card">
    <button className="auth-back" onClick={onBack}>← Back to home</button><div className="brand-mark"><Sparkles size={22}/></div>
    <p className="eyebrow">YOUR PRIVATE WORKSPACE</p><h1>Think clearly.<br/><span>Get things done.</span></h1>
    <p className="muted">Your personal AI workspace for conversations, files, research, and everyday work.</p>
    <form onSubmit={submit} className="auth-form">
      {mode==="register" && <label>Your name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="Your name"/></label>}
      <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters"/></label>
      {error && <div className="error">{error}</div>}
      <button className="primary full" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"}</button>
    </form>
    <p className="auth-switch">{mode==="login"?"New here?":"Already have an account?"} <button className="link" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Create an account":"Sign in"}</button></p>
    <p className="tiny muted center">Your account and files are stored by the server you configure. Do not upload sensitive material to an untrusted deployment.</p>
  </section></main>;
}

export default function App() {
  const [user,setUser] = useState(null);
  const [checking,setChecking] = useState(true);
  const [showAuth,setShowAuth] = useState(false);
  const [landingPrompt,setLandingPrompt] = useState("");
  const [theme,setTheme] = useState(localStorage.getItem("pia_theme") || "dark");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [active,setActive] = useState("chat");
  const [conversations,setConversations] = useState([]);
  const [conversationId,setConversationId] = useState(null);
  const [messages,setMessages] = useState([]);
  const [files,setFiles] = useState([]);
  const [memories,setMemories] = useState([]);
  const [tasks,setTasks] = useState([]);
  const [input,setInput] = useState("");
  const [selectedFiles,setSelectedFiles] = useState([]);
  const [uploading,setUploading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [search,setSearch] = useState("");
  const [newMemory,setNewMemory] = useState("");
  const [newTask,setNewTask] = useState("");
  const [fileQuery,setFileQuery] = useState("");
  const [agentPrompt,setAgentPrompt] = useState("");
  const [agentBusy,setAgentBusy] = useState(false);
  const [agentResult,setAgentResult] = useState(null);
  const [agentApprovals,setAgentApprovals] = useState([]);
  const [agentActivity,setAgentActivity] = useState([]);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  const fileInput = useRef(null);

  useEffect(()=>{ document.documentElement.dataset.theme=theme; localStorage.setItem("pia_theme",theme); },[theme]);
  useEffect(()=>{
    if (!getToken()) { setChecking(false); return; }
    api("/me").then(d=>setUser(d.user)).catch(()=>setToken("")).finally(()=>setChecking(false));
  },[]);
  useEffect(()=>{ if(user) refreshAll(); },[user]);
  useEffect(()=>{ if(user && active==="agent") refreshAgent().catch(e=>setError(e.message)); },[user,active]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);
  async function refreshAgent() {
    const [a,p]=await Promise.all([api("/agent/activity"),api("/agent/approvals")]);
    setAgentActivity(a.activities); setAgentApprovals(p.approvals);
  }
  async function runAgentTask(e) {
    e.preventDefault(); if(!agentPrompt.trim()||agentBusy)return;
    setAgentBusy(true); setAgentResult(null); setError("");
    try { const result=await api("/agent/run",{method:"POST",body:JSON.stringify({prompt:agentPrompt})}); setAgentResult(result); setAgentPrompt(""); await refreshAgent(); await refreshAll(); }
    catch(err){setError(err.message);} finally{setAgentBusy(false);}
  }
  async function decideAgentApproval(id,decision) {
    try { const result=await api(`/agent/approvals/${id}/decision`,{method:"POST",body:JSON.stringify({decision})}); setAgentResult(result.continuation || {status:result.status,answer:result.status==="executed"?"Approved action completed.":"Action rejected.",steps:result.result?[{tool:"approved_action",result:result.result}]:[]}); await refreshAgent(); await refreshAll(); } catch(err){setError(err.message);} 
  }
  async function refreshAll() {
    try {
      const [c,f,m,t] = await Promise.all([api("/conversations"),api("/files"),api("/memory"),api("/tasks")]);
      setConversations(c.conversations); setFiles(f.files); setMemories(m.memories); setTasks(t.tasks);
    } catch(e) { setError(e.message); }
  }
  async function openConversation(id) {
    try {
      const d=await api(`/conversations/${id}`);
      setConversationId(id); setMessages(d.conversation.messages || []); setActive("chat"); setMobileOpen(false);
    } catch(e) { setError(e.message); }
  }
  async function newChat() { setConversationId(null); setMessages([]); setInput(""); setActive("chat"); setMobileOpen(false); }
  async function sendMessage(e) {
    e?.preventDefault();
    if ((!input.trim() && selectedFiles.length===0) || busy) return;
    const text=input.trim() || "Please analyze the attached file(s).";
    const attachments=selectedFiles;
    setInput(""); setSelectedFiles([]); setError("");
    setMessages(prev=>[...prev,{role:"user",content:text,attachments:attachments.map(f=>({name:f.name}))},{role:"assistant",content:""}]);
    setBusy(true);
    const controller=new AbortController(); abortRef.current=controller;
    let currentId=conversationId;
    try {
      await streamChat({conversationId:currentId,message:text,attachmentIds:attachments.map(f=>f.id)},{
        signal:controller.signal,
        onMeta:meta=>{ currentId=meta.conversationId; setConversationId(meta.conversationId); },
        onDelta:delta=>setMessages(prev=>{const copy=[...prev];copy[copy.length-1]={...copy[copy.length-1],content:(copy[copy.length-1].content||"")+delta};return copy;}),
        onError:err=>setError(err)
      });
      await refreshAll();
    } catch(err) { if(err.name!=="AbortError") setError(err.message); }
    finally { setBusy(false); abortRef.current=null; }
  }
  function stopGeneration(){abortRef.current?.abort();setBusy(false);}
  async function uploadFiles(list) {
    if(!list.length) return;
    setUploading(true); setError("");
    try {
      const form=new FormData(); list.forEach(f=>form.append("files",f));
      const d=await api("/files",{method:"POST",body:form});
      const good=d.files.filter(f=>f.status==="ready");
      setSelectedFiles(prev=>[...prev,...good.map(f=>({id:f.id,name:f.name}))]);
      const failed=d.files.filter(f=>f.status!=="ready");
      if(failed.length) setError(failed.map(f=>`${f.name}: ${f.error||"Could not process"}`).join(" · "));
      await refreshAll();
    } catch(e){setError(e.message);} finally{setUploading(false);}
  }
  async function createMemory(e){e.preventDefault();if(!newMemory.trim())return;await api("/memory",{method:"POST",body:JSON.stringify({text:newMemory})});setNewMemory("");await refreshAll();}
  async function deleteMemory(id){await api(`/memory/${id}`,{method:"DELETE"});await refreshAll();}
  async function createTask(e){e.preventDefault();if(!newTask.trim())return;await api("/tasks",{method:"POST",body:JSON.stringify({title:newTask})});setNewTask("");await refreshAll();}
  async function updateTask(id,status){await api(`/tasks/${id}`,{method:"PATCH",body:JSON.stringify({status})});await refreshAll();}
  async function deleteTask(id){await api(`/tasks/${id}`,{method:"DELETE"});await refreshAll();}
  async function deleteFile(id){await api(`/files/${id}`,{method:"DELETE"});await refreshAll();}
  async function deleteConversation(id){await api(`/conversations/${id}`,{method:"DELETE"});if(conversationId===id)newChat();await refreshAll();}
  function logout(){setToken("");setUser(null);setMessages([]);setConversationId(null);setShowAuth(false);}
  if(checking) return <div className="loading">Preparing your workspace…</div>;
  if(!user) return showAuth
    ? <Auth onLogin={u=>{setUser(u);setInput(landingPrompt);}} onBack={()=>setShowAuth(false)}/>
    : <Landing prompt={landingPrompt} setPrompt={setLandingPrompt} onChat={()=>setShowAuth(true)}/>;

  const nav=[["chat","Chat",MessageSquare],["agent","Agent",Bot],["files","Files",FolderOpen],["memory","Memory",Brain],["tasks","Tasks",ListTodo],["settings","Settings",Settings]];
  const filteredConversations=conversations.filter(c=>c.title.toLowerCase().includes(search.toLowerCase()));
  const filteredFiles=files.filter(f=>f.originalName.toLowerCase().includes(fileQuery.toLowerCase()));
  return <div className="app-shell">
    <div className="atmos"><div className="planet-band band-one"/><div className="planet-band band-two"/><div className="planet-band band-three"/></div>
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`sidebar ${mobileOpen?"open":""}`}>
      <div className="sidebar-head"><div className="brand-mark small"><Sparkles size={18}/></div><div><strong>Personal AI</strong><small>YOUR WORKSPACE</small></div><button className="icon-btn mobile-only" onClick={()=>setMobileOpen(false)} aria-label="Close menu"><X/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={17}/> New chat <span>⌘ K</span></button>
      <div className="nav-group">
        {nav.map(([key,label,Icon])=><button key={key} className={`nav-item ${active===key?"active":""}`} onClick={()=>{setActive(key);setMobileOpen(false);}}><Icon size={17}/>{label}</button>)}
      </div>
      <div className="side-section"><div className="side-label">RECENT CONVERSATIONS</div><div className="search-box"><Search size={14}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats"/></div>
        <div className="conversation-list">{filteredConversations.map(c=><div className={`conversation-row ${conversationId===c._id?"selected":""}`} key={c._id}><button onClick={()=>openConversation(c._id)}><MessageSquare size={14}/><span>{c.title}</span></button><button className="tiny-icon" onClick={()=>deleteConversation(c._id)} aria-label="Delete conversation"><Trash2 size={13}/></button></div>)}</div>
      </div>
      <div className="sidebar-bottom"><div className="user-chip"><div className="avatar">{user.name.slice(0,1).toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><small>{user.email}</small></div><button className="tiny-icon" onClick={logout} aria-label="Sign out"><LogOut size={15}/></button></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="top-left"><button className="icon-btn mobile-only" onClick={()=>setMobileOpen(true)} aria-label="Open navigation"><Menu/></button><span className="crumb">Workspace</span><span className="slash">/</span><strong>{nav.find(n=>n[0]===active)?.[1] || "Chat"}</strong></div><div className="top-actions"><div className="model-pill"><span className="live-dot"/>{import.meta.env.VITE_MODEL_LABEL || "AI assistant"}</div><button className="icon-btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} aria-label="Toggle theme">{theme==="dark"?<Sun size={17}/>:<Moon size={17}/>}</button></div></header>
      {error && <div className="error-banner"><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
      {active==="chat" && <section className="chat-view">
        {messages.length===0 ? <div className="welcome"><div className="welcome-orb"><Sparkles size={28}/></div><p className="eyebrow">A LITTLE MORE CAPABLE, EVERY DAY</p><h1>What can I help<br/><span>you work through?</span></h1><p className="muted">Ask a question, bring a file, or pick up where you left off.</p>
          <div className="suggestion-grid"><button onClick={()=>setInput("Help me understand a difficult topic in simple steps.")}><Brain/><span><b>Learn something</b><small>Break down a complex topic</small></span></button><button onClick={()=>setInput("Help me research and compare these ideas.")}><Globe/><span><b>Research a topic</b><small>Organize information and sources</small></span></button><button onClick={()=>setInput("Review my project and help me debug it.")}><Activity/><span><b>Work on a project</b><small>Think through code and problems</small></span></button><button onClick={()=>setActive("files")}><FolderOpen/><span><b>Explore my files</b><small>Ask questions about documents</small></span></button></div>
        </div> : <div className="message-list">{messages.map((m,i)=><article className={`message ${m.role}`} key={i}><div className="message-avatar">{m.role==="assistant"?<Sparkles size={16}/>:user.name.slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-author">{m.role==="assistant"?"Personal AI":"You"}</div>{m.attachments?.length>0&&<div className="inline-attachments">{m.attachments.map((a,j)=><span key={j}><FileText size={13}/>{a.name}</span>)}</div>}<Markdown text={m.content}/></div></article>)}<div ref={bottomRef}/></div>}
        <form className="composer-wrap" onSubmit={sendMessage}><div className="composer">
          {selectedFiles.length>0&&<div className="attachment-row">{selectedFiles.map((f,i)=><span className="attachment-chip" key={i}><FileText size={13}/>{f.name}<button type="button" onClick={()=>setSelectedFiles(p=>p.filter((_,j)=>j!==i))}><X size={12}/></button></span>)}</div>}
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Message your assistant…" rows={2}/>
          <div className="composer-footer"><div className="composer-tools"><button type="button" className="tool-btn" onClick={()=>fileInput.current?.click()}><Paperclip size={16}/><span>Attach</span></button><input ref={fileInput} type="file" multiple hidden onChange={e=>uploadFiles([...e.target.files])}/><span className="composer-hint">{uploading?"Processing files…":"Enter to send · Shift + Enter for a new line"}</span></div><button className="send-btn" disabled={busy||(!input.trim()&&!selectedFiles.length)}>{busy?<span className="spinner"/>:<Send size={17}/>}</button></div>
        </div></form>
      </section>}
      {active==="agent" && <section className="workspace-page agent-page"><div className="page-heading"><div><p className="eyebrow">PLAN · USE TOOLS · VERIFY</p><h1>Agent workspace</h1><p className="muted">Give the assistant a task. It can research the web, read your files, calculate, and create tasks. Sensitive browser and code actions require your approval.</p></div></div>
        <form className="inline-form agent-form" onSubmit={runAgentTask}><textarea value={agentPrompt} onChange={e=>setAgentPrompt(e.target.value)} placeholder="Example: Research the latest developments in AI-powered network intrusion detection and compare five reliable sources…" rows={3}/><button className="primary" disabled={agentBusy||!agentPrompt.trim()}>{agentBusy?<span className="spinner"/>:<Sparkles size={16}/>} Run agent</button></form>
        {agentResult&&<div className="agent-result"><div className="agent-result-head"><strong>Agent result</strong><span className="status-label">{agentResult.status?.replaceAll("_"," ")}</span></div><Markdown text={agentResult.answer}/>{agentResult.steps?.length>0&&<div className="agent-steps"><b>Execution steps</b>{agentResult.steps.map((step,i)=><details key={i}><summary>{step.tool}</summary><pre>{JSON.stringify(step.result,null,2)}</pre></details>)}</div>}</div>}
        <div className="agent-section"><h2>Approval requests</h2>{agentApprovals.filter(a=>a.status==="pending").map(a=><div className="list-card" key={a._id}><div className="list-content"><p>{a.action.replaceAll("_"," ")}</p><small>{a.payload?.purpose||"Action requested by agent"}</small><details className="approval-details"><summary>Review exact action</summary><pre>{JSON.stringify(a.payload,null,2)}</pre></details></div><button className="secondary" onClick={()=>decideAgentApproval(a._id,"reject")}>Reject</button><button className="primary" onClick={()=>decideAgentApproval(a._id,"approve")}>Approve</button></div>)}{!agentApprovals.some(a=>a.status==="pending")&&<p className="muted">No pending approvals.</p>}</div>
        <div className="agent-section"><h2>Recent activity</h2><div className="stack-list">{agentActivity.slice(0,20).map(a=><div className="list-card" key={a._id}><div className="memory-icon"><Activity size={16}/></div><div className="list-content"><p>{a.message}</p><small>{a.type.replaceAll("_"," ")} · {new Date(a.createdAt).toLocaleString()}</small></div></div>)}</div>{!agentActivity.length&&<p className="muted">Agent activity will appear here.</p>}</div>
      </section>}
      {active==="files" && <section className="workspace-page"><div className="page-heading"><div><p className="eyebrow">YOUR KNOWLEDGE BASE</p><h1>Files</h1><p className="muted">Upload documents, images, presentations, spreadsheets, and code.</p></div><button className="primary" onClick={()=>fileInput.current?.click()}><UploadCloud size={16}/> Upload files</button></div><input ref={fileInput} type="file" multiple hidden onChange={e=>uploadFiles([...e.target.files])}/><div className="file-search"><Search size={16}/><input value={fileQuery} onChange={e=>setFileQuery(e.target.value)} placeholder="Find a file…"/></div><div className="file-grid">{filteredFiles.map(f=><div className="file-card" key={f._id}><div className="file-icon"><FileText/></div><div className="file-info"><strong>{f.originalName}</strong><small>{(f.size/1024).toFixed(0)} KB · {f.status}</small></div><button className="tiny-icon" onClick={()=>deleteFile(f._id)} aria-label="Delete file"><Trash2 size={15}/></button></div>)}</div>{!files.length&&<div className="empty-state"><FolderOpen size={30}/><b>No files yet</b><span>Upload a file to start building your searchable knowledge base.</span></div>}</section>}
      {active==="memory" && <section className="workspace-page"><div className="page-heading"><div><p className="eyebrow">PERSONAL CONTEXT</p><h1>Memory</h1><p className="muted">Information you choose to keep available across conversations.</p></div></div><form className="inline-form" onSubmit={createMemory}><input value={newMemory} onChange={e=>setNewMemory(e.target.value)} placeholder="Add a memory…"/><button className="primary"><Plus size={16}/> Save memory</button></form><div className="stack-list">{memories.map(m=><div className="list-card" key={m._id}><div className="memory-icon"><Brain size={17}/></div><div className="list-content"><p>{m.text}</p><small>{m.category} · Importance {m.importance}</small></div><button className="tiny-icon" onClick={()=>deleteMemory(m._id)} aria-label="Delete memory"><Trash2 size={15}/></button></div>)}</div>{!memories.length&&<div className="empty-state"><Brain size={30}/><b>No saved memories</b><span>Add information you want the assistant to remember.</span></div>}</section>}
      {active==="tasks" && <section className="workspace-page"><div className="page-heading"><div><p className="eyebrow">STAY ON TRACK</p><h1>Tasks</h1><p className="muted">Keep important work in one place.</p></div></div><form className="inline-form" onSubmit={createTask}><input value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="What needs to get done?"/><button className="primary"><Plus size={16}/> Add task</button></form><div className="stack-list">{tasks.map(t=><div className="list-card" key={t._id}><button className={`check-task ${t.status==="Done"?"checked":""}`} onClick={()=>updateTask(t._id,t.status==="Done"?"Todo":"Done")}><Check size={14}/></button><div className="list-content"><p className={t.status==="Done"?"done":""}>{t.title}</p><small>{t.priority} priority · {t.status}</small></div><button className="tiny-icon" onClick={()=>deleteTask(t._id)} aria-label="Delete task"><Trash2 size={15}/></button></div>)}</div>{!tasks.length&&<div className="empty-state"><ListTodo size={30}/><b>No tasks yet</b><span>Add your first task above.</span></div>}</section>}
      {active==="settings" && <section className="workspace-page"><div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p className="muted">Manage your workspace appearance and account.</p></div></div><div className="settings-card"><div><b>Appearance</b><small>Choose how your workspace looks.</small></div><button className="secondary" onClick={()=>setTheme(theme==="dark"?"light":"dark")}>{theme==="dark"?<Sun size={16}/>:<Moon size={16}/>} Switch to {theme==="dark"?"light":"dark"} mode</button></div><div className="settings-card"><div><b>Signed in as</b><small>{user.name} · {user.email}</small></div><button className="secondary danger-text" onClick={logout}><LogOut size={16}/> Sign out</button></div><div className="settings-card"><div><b>AI connection</b><small>The API key and model are configured on the backend.</small></div><span className="status-label"><span className="live-dot"/> Server managed</span></div><div className="settings-card"><div><b>Privacy</b><small>Files and personal data are stored by your configured server and MongoDB instance.</small></div></div></section>}
      <footer className="app-footer"><span><span className="live-dot"/> Workspace ready</span><span>Personal AI · Local-first foundation</span></footer>
    </main>
  </div>;
}
