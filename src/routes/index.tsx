import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Brain, CalendarDays, Calculator, Check, CheckCircle2, ChevronDown, Clock3, Dna, FileText, FlaskConical, GraduationCap, History, Laptop, Lightbulb, LoaderCircle, LogOut, Menu, MessageCircle, Paperclip, Pause, PenLine, Play, Plus, Puzzle, Send, Sparkles, Target, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateStudyContent } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@supabase/supabase-js";

type StudyClass = { id: string; name: string; code: string | null; color: string; description: string | null; goal_percentage: number; subject: string; goal_text: string | null; user_id: string; archived: boolean; created_at: string; updated_at: string };
type Task = { id: string; title: string; completed: boolean; due_at: string | null; class_id: string | null; user_id: string; created_at: string };
type Material = { id: string; name: string; mime_type: string | null; content: string | null };
type GeneratedItem = { id: string; kind: Mode; title: string; content: { text?: string }; created_at: string };
type Mode = "plan" | "summary" | "flashcards" | "test" | "tutor";

function classStorageKey(ownerId: string) { return `studiai.classes.${ownerId}`; }
function readStoredClasses(ownerId: string): StudyClass[] {
  try {
    const raw = localStorage.getItem(classStorageKey(ownerId));
    return raw ? JSON.parse(raw) as StudyClass[] : [];
  } catch { return []; }
}
function writeStoredClasses(ownerId: string, classes: StudyClass[]) {
  localStorage.setItem(classStorageKey(ownerId), JSON.stringify(classes));
}
function makeClass(values: { name: string; subject: string; goal: string }, userId: string): StudyClass {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: values.name, code: values.subject, color: "teal", description: null, goal_percentage: 80, subject: values.subject, goal_text: values.goal || null, user_id: userId, archived: false, created_at: now, updated_at: now };
}

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "StudiAI — Smarter studying" },
    { name: "description", content: "Build personalized study plans, practice tests, flashcards, and get help from an AI tutor." },
    { property: "og:title", content: "StudiAI — Smarter studying" },
    { property: "og:description", content: "Build personalized study plans, practice tests, flashcards, and get help from an AI tutor." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuest] = useState(false);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setChecking(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setChecking(false); });
    return () => data.subscription.unsubscribe();
  }, []);
  if (checking) return <div className="grid min-h-screen place-items-center"><Brain className="size-8 animate-pulse text-primary" /></div>;
  if (!user && !guest) return <AuthScreen onGuest={() => setGuest(true)} />;
  return <Workspace user={user} guest={guest} onExit={() => setGuest(false)} />;
}

function AuthScreen({ onGuest }: { onGuest: () => void }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const result = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    setMessage(result.error ? result.error.message : signup && !result.data.session ? "Check your email to confirm your account." : "Welcome back!");
  }
  async function google() {
    setGoogleBusy(true); setMessage("");
    const result = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" }, skipBrowserRedirect: true },
    });
    if (result.error || !result.data.url) {
      setGoogleBusy(false);
      setMessage(result.error?.message ?? "Google sign-in could not start.");
      return;
    }
    try {
      const probe = await fetch(result.data.url);
      if (!probe.ok) {
        const body = await probe.json().catch(() => null) as { msg?: string } | null;
        setGoogleBusy(false);
        setMessage(body?.msg?.toLowerCase().includes("missing oauth secret")
          ? "Google sign-in needs your Google client ID and secret in the Supabase Auth settings."
          : body?.msg ?? "Google sign-in could not start.");
        return;
      }
    } catch {
      // A configured Google provider redirects to accounts.google.com, which the browser blocks from fetch.
    }
    window.location.assign(result.data.url);
  }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_45%,var(--color-background),var(--color-secondary))] px-4 py-10">
    <section className="animate-studiai-fade w-full max-w-[425px] rounded-xl border bg-card px-8 py-10 shadow-2xl shadow-foreground/10 sm:px-10">
      <BrandMark className="justify-center" />
      <p className="mt-4 text-center text-sm text-muted-foreground">AI-powered studying, personalized for you.</p>
      <div className="mt-7 grid grid-cols-2 rounded-md bg-muted p-1">
        <Button type="button" variant={signup ? "ghost" : "secondary"} onClick={() => setSignup(false)}>Log In</Button>
        <Button type="button" variant={signup ? "secondary" : "ghost"} onClick={() => setSignup(true)}>Sign Up</Button>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {signup && <Field label="DISPLAY NAME"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></Field>}
        <Field label="EMAIL"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></Field>
        <Field label="PASSWORD"><Input type="password" minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></Field>
        <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create Account" : "Log In"}</Button>
      </form>
      {message && <p className="mt-3 text-center text-xs text-muted-foreground">{message}</p>}
      <Divider />
      <Button variant="outline" className="w-full" onClick={google} disabled={googleBusy}><span className="font-extrabold text-primary">G</span> {googleBusy ? "Opening Google…" : "Continue with Google"}</Button>
      <Divider />
      <Button variant="outline" className="w-full border-dashed text-muted-foreground" onClick={onGuest}>Try as Guest</Button>
    </section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-[11px] font-extrabold tracking-wider text-foreground">{label}<span className="mt-1 block">{children}</span></label>; }
function SelectField({ label, value, setValue, options }: { label:string; value:string; setValue:(value:string)=>void; options:string[] }) { return <label className="block text-[11px] font-extrabold tracking-wider text-foreground">{label}<select className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm font-medium" value={value} onChange={event=>setValue(event.target.value)}>{options.map(option=><option key={option} value={option}>{option}{label==="NUMBER OF QUESTIONS"?" questions":""}</option>)}</select></label>; }
function Divider() { return <div className="my-4 flex items-center gap-3 text-[10px] text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>; }
function BrandMark({ className = "" }: { className?: string }) { return <div className={`flex items-center gap-2.5 ${className}`} aria-label="StudiAI"><span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Brain className="size-6" /></span><span className="text-2xl font-extrabold text-foreground">Studi<span className="text-primary">AI</span></span></div>; }

function Workspace({ user, guest, onExit }: { user: User | null; guest: boolean; onExit: () => void }) {
  const [classes, setClasses] = useState<StudyClass[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<StudyClass | null>(null);
  const [showClass, setShowClass] = useState(false);
  const [mobileRail, setMobileRail] = useState(false);
  const [seconds, setSeconds] = useState(1500);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const name = user?.user_metadata?.['display_name'] ?? user?.email?.split("@")[0] ?? "Guest";
  useEffect(() => { if (!running || seconds <= 0) return; const timer = window.setInterval(() => setSeconds(v => v - 1), 1000); return () => clearInterval(timer); }, [running, seconds]);
  useEffect(() => {
    const ownerId = user?.id ?? "guest";
    if (!user) { setClasses(readStoredClasses(ownerId)); return; }
    Promise.all([supabase.from("classes").select("*").eq("archived", false).order("created_at"), supabase.from("tasks").select("*").order("created_at")]).then(([c, t]) => {
      if (c.error) { setClasses(readStoredClasses(ownerId)); setNotice("Classes are saved on this device. Your Supabase project does not have a classes table yet."); }
      else setClasses(c.data ?? []);
      if (!t.error) setTasks(t.data ?? []);
    });
  }, [user]);
  const due = useMemo(() => tasks.filter(t => t.due_at && !t.completed), [tasks]);
  async function addClass(values: { name:string; subject:string; goal:string }) {
    const ownerId = user?.id ?? "guest";
    if (guest || !user) {
      setClasses(current => { const next = [...current, makeClass(values, ownerId)]; writeStoredClasses(ownerId, next); return next; });
      setShowClass(false);
      return;
    }
    const { data, error } = await supabase.from("classes").insert({ name: values.name, code: values.subject, subject: values.subject, goal_text: values.goal || null, user_id: user.id }).select().single();
    if (error || !data) {
      setClasses(current => { const next = [...current, makeClass(values, ownerId)]; writeStoredClasses(ownerId, next); return next; });
      setNotice(error?.message ?? "The class was saved on this device, but the database did not accept it.");
      setShowClass(false);
      return;
    }
    setClasses(current => [...current, data]);
    setNotice("");
    setShowClass(false);
  }
  async function addTask(title: string, classId: string | null) {
    if (!title.trim()) return;
    if (guest) { setTasks(v => [...v, { id: crypto.randomUUID(), title, class_id: classId, completed: false, due_at: null, user_id: "guest", created_at: new Date().toISOString() }]); return; }
    if (!user) return; const { data } = await supabase.from("tasks").insert({ title, class_id: classId, user_id: user.id }).select().single(); if (data) setTasks(v => [...v, data]);
  }
  async function toggleTask(task: Task) { const completed = !task.completed; setTasks(v => v.map(t => t.id === task.id ? { ...t, completed } : t)); if (!guest) await supabase.from("tasks").update({ completed }).eq("id", task.id); }
  async function exit() { if (guest) return onExit(); await supabase.auth.signOut(); }
  const timer = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  return <div className="min-h-screen bg-background">
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center border-b bg-card px-4 sm:px-6">
      <Button variant="ghost" size="icon" className="mr-2 md:hidden" onClick={() => setMobileRail(true)} aria-label="Open planner"><Menu /></Button>
      <BrandMark />
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 font-extrabold"><span>{timer}</span><Button size="icon" variant="secondary" className="rounded-full" onClick={() => setRunning(v => !v)} aria-label={running ? "Pause timer" : "Start timer"}>{running ? <Pause /> : <Play />}</Button><Button size="icon" variant="ghost" className="rounded-full" onClick={() => {setSeconds(1500);setRunning(false)}} aria-label="Reset timer"><Clock3 /></Button></div>
      <div className="ml-auto flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{name[0]?.toUpperCase()}</span><span className="hidden text-sm sm:block">{name}</span>{guest && <Button size="sm" variant="outline" onClick={() => {onExit()}}>Create Account</Button>}<Button size="icon" variant="ghost" onClick={exit} aria-label="Log out"><LogOut /></Button></div>
    </header>
    <Sidebar open={mobileRail} close={() => setMobileRail(false)} tasks={tasks} classes={classes} due={due} addTask={addTask} toggleTask={toggleTask} />
    <main className="min-h-screen pt-16 md:pl-72">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-accent-foreground"><Sparkles className="size-3" /> AI-POWERED LEARNING</span>
        <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Welcome back, {name} 👋</h1>
        <p className="mt-2 text-muted-foreground">{classes.length ? "Ready to make progress today?" : "Create your first class to get started."}</p>
        {notice && <p className="mt-3 max-w-xl text-sm text-destructive" role="status">{notice}</p>}
        <div className="mt-4 flex gap-2"><Button size="sm" variant="outline">Give Feedback</Button><Button size="sm" variant="secondary">Take Our Survey</Button></div>
        {classes.length === 0 ? <EmptyClasses onAdd={() => setShowClass(true)} /> : <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{classes.map((item, index) => <button key={item.id} onClick={() => setSelected(item)} className="animate-studiai-fade group min-h-48 rounded-lg border bg-card p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg" style={{animationDelay:`${index*60}ms`}}><span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground"><BookOpen /></span><h2 className="mt-6 text-xl font-extrabold">{item.name}</h2><p className="mt-1 text-sm text-muted-foreground">{item.code || "Personal study space"}</p><p className="mt-5 flex items-center gap-1 text-xs font-bold text-primary">Open class <ChevronDown className="size-3 -rotate-90" /></p></button>)}<button onClick={() => setShowClass(true)} className="min-h-48 rounded-lg border border-dashed bg-card p-6 text-primary transition hover:bg-accent"><Plus className="mx-auto" /><span className="mt-3 block text-sm font-bold">Add New Class</span></button></div>}
      </div>
    </main>
    {showClass && <ClassDialog close={() => setShowClass(false)} add={addClass} />}
    {selected && <ClassStudio item={selected} user={user} guest={guest} close={() => setSelected(null)} updateItem={updated => { setSelected(updated); setClasses(values => values.map(value => value.id === updated.id ? updated : value)); }} />}
  </div>;
}

function EmptyClasses({ onAdd }: { onAdd: () => void }) { return <section className="mx-auto mt-24 max-w-2xl text-center"><span className="mx-auto grid size-16 place-items-center rounded-xl bg-accent"><GraduationCap className="size-8" /></span><h2 className="mt-5 text-xl font-extrabold">No classes yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Add your first class and unlock AI-powered study plans, practice tests, and a personal tutor.</p><button onClick={onAdd} className="mt-10 w-full rounded-xl border-2 border-dashed border-border bg-card px-6 py-8 text-primary transition hover:border-primary"><Plus className="mx-auto" /><span className="mt-3 block text-sm font-bold">Add New Class</span></button></section>; }

function Sidebar({ open, close, tasks, classes, due, addTask, toggleTask }: { open:boolean;close:()=>void;tasks:Task[];classes:StudyClass[];due:Task[];addTask:(t:string,c:string|null)=>void;toggleTask:(t:Task)=>void }) {
  const [title,setTitle]=useState(""); const [classId,setClassId]=useState("");
  return <aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed bottom-0 left-0 top-16 z-40 w-72 border-r bg-card transition md:translate-x-0`}><Button className="absolute right-2 top-2 md:hidden" variant="ghost" size="icon" onClick={close}><X /></Button><section className="h-[48%] border-b p-4"><div className="flex items-center justify-between text-[11px] font-extrabold text-muted-foreground"><span className="flex items-center gap-1"><CalendarDays className="size-3" /> DEADLINES</span><Button size="icon" variant="ghost"><Plus /></Button></div>{due.length ? due.map(t=><p key={t.id} className="mt-3 text-sm">{t.title}</p>) : <p className="mt-3 text-xs leading-5 text-muted-foreground">No deadlines yet. Add one with + or sync from a study plan.</p>}</section><section className="p-4"><h2 className="flex items-center gap-1 text-[11px] font-extrabold text-muted-foreground"><Check className="size-3" /> TO-DO</h2><Input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Add a task..." className="mt-3"/><div className="mt-2 flex gap-2"><select value={classId} onChange={e=>setClassId(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs"><option value="">No class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><Button size="sm" onClick={()=>{addTask(title,classId||null);setTitle("")}}>Add</Button></div><div className="mt-4 space-y-2">{tasks.length ? tasks.map(t=><button key={t.id} onClick={()=>toggleTask(t)} className="flex w-full items-center gap-2 text-left text-sm"><span className={`grid size-5 place-items-center rounded border ${t.completed ? "bg-primary text-primary-foreground" : "bg-background"}`}>{t.completed && <Check className="size-3" />}</span><span className={t.completed ? "text-muted-foreground line-through" : ""}>{t.title}</span></button>) : <p className="text-xs text-muted-foreground">No tasks yet.</p>}</div></section></aside>;
}

function ClassDialog({ close, add }: { close:()=>void; add:(values:{name:string;subject:string;goal:string})=>void }) {
  const [name,setName]=useState("");const [subject,setSubject]=useState("");const [goal,setGoal]=useState("");
  const subjects=[{name:"Math",icon:<Calculator/>},{name:"Chemistry",icon:<FlaskConical/>},{name:"Biology",icon:<Dna/>},{name:"Coding",icon:<Laptop/>},{name:"History",icon:<BookOpen/>},{name:"English",icon:<PenLine/>},{name:"Other",icon:<Puzzle/>}];
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-foreground/35 p-4" onMouseDown={close}><form onSubmit={event=>{event.preventDefault();if(subject)add({name:name.trim(),subject,goal:goal.trim()})}} onMouseDown={event=>event.stopPropagation()} className="my-6 w-full max-w-2xl rounded-xl bg-card p-6 shadow-2xl sm:p-10"><div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold">Create a New Class</h2><Button type="button" size="icon" variant="secondary" onClick={close} aria-label="Close"><X/></Button></div><div className="mt-8 space-y-7"><Field label="CLASS NAME"><Input value={name} onChange={event=>setName(event.target.value)} placeholder="e.g. AP Chemistry, Calculus II, English Lit" required className="h-14 text-base"/></Field><fieldset><legend className="text-[11px] font-extrabold tracking-wider">SUBJECT</legend><div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">{subjects.map(option=><Button key={option.name} type="button" variant={subject===option.name?"secondary":"outline"} className={`h-20 flex-col gap-1 ${subject===option.name?"border-primary ring-2 ring-primary/20":""}`} onClick={()=>setSubject(option.name)}>{option.icon}<span>{option.name}</span></Button>)}</div></fieldset><Field label="SET A GOAL (OPTIONAL)"><Input value={goal} onChange={event=>setGoal(event.target.value)} placeholder="Get an A, pass with 90%, master integration techniques" className="h-14"/></Field><Button className="h-13 w-full" disabled={!name.trim()||!subject}>Create Class</Button></div></form></div>;
}

function ClassStudio({ item, user, guest, close, updateItem }: { item:StudyClass; user:User|null; guest:boolean; close:()=>void; updateItem:(item:StudyClass)=>void }) {
  const callAI=useServerFn(generateStudyContent);
  const [mode,setMode]=useState<Mode|null>(null);
  const [notes,setNotes]=useState("");
  const [prompt,setPrompt]=useState("");
  const [output,setOutput]=useState("");
  const [busy,setBusy]=useState(false);
  const [materials,setMaterials]=useState<Material[]>([]);
  const [history,setHistory]=useState<GeneratedItem[]>([]);
  const [uploading,setUploading]=useState(false);
  const [uploadMessage,setUploadMessage]=useState("");
  const [goal,setGoal]=useState(item.goal_percentage ?? 80);
  const [editingGoal,setEditingGoal]=useState(false);
  const [planType,setPlanType]=useState<"course"|"exam">("course");
  const [testMode,setTestMode]=useState<"mock"|"quiz">("mock");
  const [questionCount,setQuestionCount]=useState("10");
  const [difficulty,setDifficulty]=useState("Mixed");
  const [questionFormat,setQuestionFormat]=useState("Mixed");
  const [tutorMessages,setTutorMessages]=useState<Array<{role:"assistant"|"user";text:string}>>([{role:"assistant",text:`Hi! I'm your AI tutor for ${item.name}. I won't just hand you answers — I'll guide you through problems step by step so you build real understanding.\n\nAsk me anything, share a problem, or attach your notes. What would you like to work on?`}]);
  const modes: Array<[Mode,string,React.ReactNode]> = [["plan","Study plan",<CalendarDays/>],["summary","Summary",<FileText/>],["flashcards","Flashcards",<BookOpen/>],["test","Practice test",<GraduationCap/>],["tutor","AI tutor",<MessageCircle/>]];
  const featured: Array<{id:Mode;title:string;description:string;action:string;icon:React.ReactNode}> = [
    {id:"plan",title:"Study Plan",description:"Turn your syllabus and notes into a structured, day-by-day study schedule with clear priorities.",action:"Generate Plan",icon:<CalendarDays/>},
    {id:"test",title:"Practice Test",description:"Create a custom quiz with multiple-choice and short-answer questions on key concepts.",action:"Create Test",icon:<GraduationCap/>},
    {id:"tutor",title:"AI Tutor",description:"Ask questions and get guided through problems with a tutor that helps you understand.",action:"Start Chatting",icon:<MessageCircle/>},
  ];
  useEffect(()=>{if(!user||guest)return; Promise.all([supabase.from("materials").select("id,name,mime_type,content").eq("class_id",item.id).order("created_at"),supabase.from("study_content").select("id,kind,title,content,created_at").eq("class_id",item.id).order("created_at",{ascending:false}).limit(12)]).then(([files,results])=>{if(files.error)setUploadMessage(`Could not load files: ${files.error.message}`);else setMaterials(files.data??[]);if(!results.error)setHistory((results.data??[]) as GeneratedItem[])});},[user,guest,item.id]);
  function openTool(nextMode:Mode){setMode(nextMode);setOutput("");setPrompt("");}
  async function saveGoal(){const normalized=Math.max(0,Math.min(100,goal));setGoal(normalized);const updated={...item,goal_percentage:normalized};updateItem(updated);setEditingGoal(false);if(!guest&&user)await supabase.from("classes").update({goal_percentage:normalized}).eq("id",item.id);}
  async function generate(overridePrompt?:string){
    if(!mode)return;
    if(guest){setOutput("Create a free account to use StudiAI and save your generated study tools.");return;}
    if(!user)return;
    const fileContext=materials.map(material=>material.content?`File: ${material.name}\n${material.content}`:`File attached without readable text: ${material.name}`).join("\n\n");
    setBusy(true);setOutput("");
    try{
      const configuredPrompt=overridePrompt??(mode==="plan"?`${planType==="course"?"Create a full course plan":"Create a focused test preparation plan"}. ${prompt}`:mode==="test"?`Create a ${testMode} practice test with ${questionCount} questions. Difficulty: ${difficulty}. Question format: ${questionFormat}. Topics: ${prompt||"all supplied materials"}. Additional instructions: ${notes||"none"}.`:prompt);
      const result=await callAI({data:{mode,className:item.name,context:[mode==="test"?"":notes,fileContext].filter(Boolean).join("\n\n"),prompt:configuredPrompt}});
      setOutput(result.content);
      if(mode==="tutor")setTutorMessages(values=>[...values,{role:"assistant",text:result.content}]);
      const {data}=await supabase.from("study_content").insert({user_id:user.id,class_id:item.id,kind:mode,title:`${item.name} ${modes.find(([id])=>id===mode)?.[1]??mode}`,content:{text:result.content}}).select("id,kind,title,content,created_at").single();
      if(data)setHistory(values=>[data as GeneratedItem,...values]);
    }catch(error){const message=error instanceof Error?error.message:"StudiAI could not complete this request.";setOutput(message);if(mode==="tutor")setTutorMessages(values=>[...values,{role:"assistant",text:`⚠️ ${message}`}]);}finally{setBusy(false)}
  }
  async function sendTutor(text=prompt){if(!text.trim()||busy)return;setTutorMessages(values=>[...values,{role:"user",text}]);setPrompt("");await generate(text);}
  async function upload(file:File){
    setUploadMessage("");
    if(file.size>20*1024*1024){setUploadMessage("This file is over the 20 MB limit.");return;}
    const textContent=file.type.startsWith("text/")||/\.(txt|md|csv)$/i.test(file.name)?(await file.text()).slice(0,24000):null;
    if(guest||!user){setMaterials(values=>[...values,{id:crypto.randomUUID(),name:file.name,mime_type:file.type||null,content:textContent}]);setUploadMessage("File added for this guest session. Create an account to save it.");return;}
    setUploading(true);
    const path=`${user.id}/${item.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
    try{
      const uploadOptions=file.type?{contentType:file.type}:undefined;
      const {error:storageError}=await supabase.storage.from("study-materials").upload(path,file,uploadOptions);
      if(storageError)throw storageError;
      const {data,error:recordError}=await supabase.from("materials").insert({user_id:user.id,class_id:item.id,name:file.name,storage_path:path,mime_type:file.type||null,content:textContent}).select("id,name,mime_type,content").single();
      if(recordError)throw recordError;
      setMaterials(values=>[...values,data]);setUploadMessage(textContent?`${file.name} uploaded and ready for StudiAI.`:`${file.name} saved. Paste its key text below when generating.`);
    }catch(error){setUploadMessage(error instanceof Error?`Upload failed: ${error.message}`:"Upload failed. Please try again.");}finally{setUploading(false)}
  }
  if(mode){
    const filePicker=<label className={`flex min-h-28 cursor-pointer items-center gap-4 rounded-lg border-2 border-dashed p-6 hover:bg-accent ${uploading?"pointer-events-none opacity-60":""}`}><span className="grid size-11 place-items-center rounded-md bg-secondary text-primary">{uploading?<LoaderCircle className="animate-spin"/>:<Upload/>}</span><span><strong className="block">{uploading?"Uploading…":"Upload study materials"}</strong><small className="text-muted-foreground">PDF, TXT, MD, CSV, DOC or DOCX · up to 20 MB</small></span><input className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" disabled={uploading} onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file);event.currentTarget.value=""}}/></label>;
    if(mode==="tutor")return <div className="fixed inset-0 z-50 flex flex-col bg-background"><header className="flex h-24 items-center border-b bg-card px-5 sm:px-10"><Button variant="ghost" onClick={()=>setMode(null)}><ArrowLeft/>Back to {item.name}</Button><div className="ml-5"><h1 className="font-extrabold">{item.name}</h1><p className="text-xs text-primary">{item.subject||item.code}</p></div><span className="ml-auto rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">AI Tutor</span></header><main className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto p-4 sm:p-8"><div className="space-y-4">{tutorMessages.map((message,index)=><div key={index} className={`flex ${message.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[85%] whitespace-pre-wrap rounded-lg p-4 text-sm leading-7 ${message.role==="user"?"bg-primary text-primary-foreground":"border bg-card"}`}>{message.text}</div></div>)}{busy&&<div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/>StudiAI is thinking…</div>}</div></main><footer className="border-t bg-card p-4"><div className="mx-auto max-w-5xl"><div className="mb-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>void sendTutor("Give me one helpful hint without revealing the answer.")}><Lightbulb/>Hint</Button><Button size="sm" variant="outline" onClick={()=>void sendTutor("Explain this concept step by step with a simple example.")}><BookOpen/>Explain</Button><Button size="sm" variant="outline" onClick={()=>void sendTutor("Show the full answer and explain why it is correct.")}><CheckCircle2/>Full answer</Button></div><div className="flex gap-2"><label className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-md border" aria-label="Attach notes"><Paperclip className="size-4"/><input className="hidden" type="file" accept=".pdf,.txt,.md,.csv,.doc,.docx" onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/></label><Input value={prompt} onChange={event=>setPrompt(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void sendTutor()}} placeholder="Ask a question or describe a problem…"/><Button size="icon" onClick={()=>void sendTutor()} disabled={busy||!prompt.trim()} aria-label="Send question"><Send/></Button></div>{uploadMessage&&<p role="status" className="mt-2 text-xs text-muted-foreground">{uploadMessage}</p>}</div></footer></div>;
    return <div className="fixed inset-0 z-50 overflow-y-auto bg-background"><main className="mx-auto max-w-6xl p-5 sm:p-10"><Button variant="ghost" onClick={()=>setMode(null)}><ArrowLeft/>Back to {item.name}</Button><div className="mt-6 flex items-center gap-4"><span className="grid size-16 place-items-center rounded-lg bg-secondary text-primary">{mode==="plan"?<CalendarDays/>:mode==="test"?<PenLine/>:mode==="summary"?<FileText/>:<BookOpen/>}</span><div><h1 className="text-3xl font-extrabold">{item.name}</h1><p className="text-sm text-primary">{item.subject||item.code||"Independent study"}</p></div></div><section className="mt-8 rounded-lg border bg-card p-5 shadow-sm sm:p-8"><h2 className="text-xl font-extrabold">{mode==="plan"?"Study Plan Generator":mode==="test"?"Practice Test Generator":mode==="summary"?"Summary Generator":"Flashcard Generator"}</h2><p className="mt-1 text-sm text-muted-foreground">{mode==="plan"?"Upload your syllabus and get a complete study schedule.":mode==="test"?`Configure your test and generate custom questions tailored to ${item.name}.`:"Turn your notes and materials into an effective study resource."}</p>{mode==="plan"&&<><div className="mt-7 grid grid-cols-2 gap-3"><Button className="h-12" variant={planType==="course"?"default":"outline"} onClick={()=>setPlanType("course")}><CalendarDays/>Full Course Plan</Button><Button className="h-12" variant={planType==="exam"?"default":"outline"} onClick={()=>setPlanType("exam")}><Target/>Test Prep Plan</Button></div><div className="mt-6">{filePicker}</div><Textarea className="mt-4" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Or paste your syllabus and important dates here…"/></>}{mode==="test"&&<><p className="mt-7 text-[11px] font-extrabold">TEST MODE</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><Button className="h-24 justify-start" variant={testMode==="mock"?"secondary":"outline"} onClick={()=>setTestMode("mock")}><FileText/><span className="text-left"><strong className="block">Mock Test</strong><small>All questions at once with a final answer key.</small></span></Button><Button className="h-24 justify-start" variant={testMode==="quiz"?"secondary":"outline"} onClick={()=>setTestMode("quiz")}><Puzzle/><span className="text-left"><strong className="block">Quiz Mode</strong><small>Questions with hints and instant explanations.</small></span></Button></div><Field label="TOPICS TO FOCUS ON (OPTIONAL)"><Input className="mt-2" value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="e.g. Newton's laws, Chapter 4, photosynthesis…"/></Field><div className="mt-5 grid gap-4 sm:grid-cols-3"><SelectField label="NUMBER OF QUESTIONS" value={questionCount} setValue={setQuestionCount} options={["5","10","15","20"]}/><SelectField label="DIFFICULTY" value={difficulty} setValue={setDifficulty} options={["Mixed","Easy","Medium","Hard"]}/><SelectField label="QUESTION FORMAT" value={questionFormat} setValue={setQuestionFormat} options={["Mixed","Multiple choice","Short answer"]}/></div><Field label="ADDITIONAL INSTRUCTIONS (OPTIONAL)"><Textarea className="mt-2" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Include application questions, focus on formulas…"/></Field><div className="mt-5">{filePicker}</div></>}{(mode==="summary"||mode==="flashcards")&&<><Textarea className="mt-6 min-h-40" value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Paste your notes or key topics here…"/><div className="mt-4">{filePicker}</div></>} {uploadMessage&&<p role="status" className="mt-3 text-xs text-muted-foreground">{uploadMessage}</p>}<Button className="mt-6 h-12 w-full" onClick={()=>void generate()} disabled={busy}><Sparkles/>{busy?"StudiAI is thinking…":mode==="plan"?"Generate Study Plan":mode==="test"?"Generate Practice Test":"Generate"}</Button>{output&&<article className="mt-8 whitespace-pre-wrap rounded-lg border bg-background p-6 text-sm leading-7">{output}</article>}</section></main></div>;
  }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-background"><main className="mx-auto max-w-7xl px-5 py-8 sm:px-10 sm:py-12"><Button variant="ghost" onClick={close}><ArrowLeft/>All classes</Button><section className="mt-8 flex items-center gap-5"><span className="grid size-20 place-items-center rounded-lg bg-secondary text-primary"><Laptop className="size-9"/></span><div><h1 className="text-4xl font-extrabold">{item.name}</h1><p className="mt-2 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm font-bold text-primary"><BookOpen className="size-4"/>{item.code||"Independent study"}</p></div></section><div className="my-10 h-px bg-border"/><section className="rounded-lg border border-primary/20 bg-secondary p-6"><div className="flex flex-wrap items-center gap-4"><Target className="size-7 text-primary"/><div><p className="text-xs font-extrabold text-primary">YOUR GOAL</p>{editingGoal?<div className="mt-2 flex items-center gap-2"><Input type="number" min={0} max={100} value={goal} onChange={event=>setGoal(Number(event.target.value))} className="w-24"/><Button size="sm" onClick={saveGoal}>Save</Button></div>:<button className="mt-1 text-left text-2xl font-extrabold" onClick={()=>setEditingGoal(true)} aria-label="Edit study goal">{goal}%</button>}</div><div className="ml-auto h-2 w-full overflow-hidden rounded-full bg-card sm:w-72"><div className="h-full bg-primary transition-all" style={{width:`${goal}%`}}/></div></div></section><p className="mt-10 text-xs font-extrabold text-muted-foreground">STUDY TOOLS</p><section className="mt-4 grid gap-5 md:grid-cols-3">{featured.map(tool=><article key={tool.id} className="flex min-h-80 flex-col rounded-lg border bg-card p-7 shadow-sm"><span className="grid size-14 place-items-center rounded-lg bg-secondary text-primary">{tool.icon}</span><h2 className="mt-6 text-xl font-extrabold">{tool.title}</h2><p className="mt-2 text-sm leading-7 text-muted-foreground">{tool.description}</p><Button variant="outline" className="mt-auto w-fit border-primary text-primary" onClick={()=>openTool(tool.id)}>{tool.action}<ArrowRight/></Button></article>)}</section><section className="mt-8 grid gap-5 lg:grid-cols-2"><div><h2 className="flex items-center gap-2 font-extrabold"><BookOpen className="size-5 text-primary"/>More study tools</h2><div className="mt-3 flex gap-3"><Button variant="secondary" onClick={()=>openTool("summary")}><FileText/>Create summary</Button><Button variant="secondary" onClick={()=>openTool("flashcards")}><BookOpen/>Make flashcards</Button></div></div><div><h2 className="flex items-center gap-2 font-extrabold"><History className="size-5 text-primary"/>Recent work</h2>{history.length?<div className="mt-3 space-y-2">{history.slice(0,4).map(entry=><button key={entry.id} className="flex w-full items-center justify-between rounded-md border bg-card p-3 text-left text-sm" onClick={()=>{setMode(entry.kind);setOutput(entry.content.text??"")}}><span className="truncate font-bold">{entry.title}</span><span className="ml-3 text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span></button>)}</div>:<p className="mt-3 text-sm text-muted-foreground">Your generated plans, tests, and tutor answers will appear here.</p>}</div></section></main></div>;
}
