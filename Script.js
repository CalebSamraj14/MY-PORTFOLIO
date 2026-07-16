/* =========================================================================
   Caleb Samraj D — Portfolio
   -------------------------------------------------------------------------
   EMAIL DELIVERY SETUP (read this first — this is why mail wasn't arriving)
   -------------------------------------------------------------------------
   A static site cannot send email by itself — there is no backend here to
   do it. Both forms below are wired to Formspree, a hosted form-to-email
   service that works with zero server code. To receive real emails:

     1. Go to https://formspree.io and create a free account with
        calebsamrajedith@gmail.com (or whichever inbox should receive mail).
     2. Create a new form. Formspree gives you an endpoint that looks like
        https://formspree.io/f/abcdwxyz
     3. Paste that ID into GATE_FORM_ID and CONTACT_FORM_ID below
        (you can use the same ID for both, or create two forms to keep
        visitor-intros and messages separate).
     4. Confirm the verification email Formspree sends you — until you do,
        submissions are held and won't reach your inbox.

   That's it — no public/private key pair, no template setup. Until you add
   an ID below, submissions are still validated and safely stored in the
   visitor's browser (localStorage) as a fallback, but nothing is emailed.

   Optional — Supabase persistence:
   Fill in SUPABASE_URL / SUPABASE_ANON_KEY to also log every submission to
   a `visitors` / `messages` table (create these tables first; anon key is
   safe for client-side use, never use the service-role key here).
   ========================================================================= */
const CONFIG = {
  GATE_FORM_ID: "maqrqpab",     // e.g. "abcdwxyz"  →  https://formspree.io/f/abcdwxyz
  CONTACT_FORM_ID: "maqrqpab",  // can be the same ID as above

  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  NOTIFY_EMAIL: "calebsamrajedith@gmail.com",
};

/* ---------------------------------------------------------------------- */
/* Delivery helpers                                                      */
/* ---------------------------------------------------------------------- */
async function sendViaFormspree(formId, payload){
  if (!formId) return { ok:false, reason:'not-configured' };
  try{
    const res = await fetch(`https://formspree.io/f/${formId}`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok };
  }catch(e){
    console.error('Formspree submission failed', e);
    return { ok:false, reason:'network' };
  }
}

async function saveToSupabase(table, payload){
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY){
    console.warn(`[Supabase not configured] Would insert into "${table}":`, payload);
    return { ok:false, reason:'not-configured' };
  }
  try{
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${table}`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'Prefer':'return=minimal',
      },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok };
  }catch(e){
    console.error('Supabase insert failed', e);
    return { ok:false, reason:'network' };
  }
}

function logLocally(key, record){
  try{
    const log = JSON.parse(localStorage.getItem(key) || '[]');
    log.push(record);
    localStorage.setItem(key, JSON.stringify(log));
  }catch(_){}
}

/* =========================================================================
   ENTRY GATE — visitor capture
   ========================================================================= */
(function gateLogic(){
  const gate = document.getElementById('gate');
  const form = document.getElementById('gate-form');
  const errorEl = document.getElementById('gate-error');
  const submitBtn = document.getElementById('gate-submit');
  const submitLabel = document.getElementById('gate-submit-label');

  if (sessionStorage.getItem('cs_gate_passed') === '1'){
    gate.style.display = 'none';
    document.body.style.overflow = '';
  } else {
    document.body.style.overflow = 'hidden';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');
    const data = new FormData(form);
    const visitor = {
      name: data.get('name')?.trim(),
      email: data.get('email')?.trim(),
      company: data.get('company')?.trim() || null,
      role: data.get('role')?.trim(),
      purpose: data.get('purpose'),
      consent: form.consent.checked,
    };

    if (!visitor.name || !visitor.email || !visitor.role || !visitor.purpose || !visitor.consent){
      errorEl.textContent = 'Please complete all required fields and accept the consent checkbox.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitor.email)){
      errorEl.textContent = 'Please enter a valid email address.';
      errorEl.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitLabel.textContent = 'Submitting…';

    const now = new Date();
    const record = {
      name: visitor.name, email: visitor.email, company: visitor.company,
      role: visitor.role, purpose: visitor.purpose,
      created_at: now.toISOString(), user_agent: navigator.userAgent,
    };

    logLocally('cs_visitor_log', record);
    await saveToSupabase('visitors', record);
    await sendViaFormspree(CONFIG.GATE_FORM_ID, {
      _subject: `Portfolio visitor: ${visitor.name} (${visitor.purpose})`,
      to: CONFIG.NOTIFY_EMAIL,
      name: visitor.name, email: visitor.email, company: visitor.company || '—',
      role: visitor.role, purpose: visitor.purpose,
      visited_at: now.toLocaleString(), browser: navigator.userAgent,
    });

    sessionStorage.setItem('cs_gate_passed', '1');
    submitLabel.textContent = 'Welcome ✓';

    gsap.to('#gate-card', { opacity:0, y:-20, duration:.45, ease:'power2.in' });
    gsap.to('#gate', {
      opacity:0, duration:.8, delay:.2, ease:'power2.inOut',
      onStart: () => gate.classList.add('hidden-gate'),
      onComplete: () => { gate.style.display = 'none'; document.body.style.overflow = ''; playIntroTimeline(); }
    });
  });
})();

/* =========================================================================
   CONTACT FORM
   ========================================================================= */
(function contactLogic(){
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = document.getElementById('contact-status');
  const label = document.getElementById('contact-submit-label');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const msg = {
      name: data.get('name')?.trim(), email: data.get('email')?.trim(),
      subject: data.get('subject')?.trim(), message: data.get('message')?.trim(),
    };
    if (!msg.name || !msg.email || !msg.subject || !msg.message){
      status.textContent = 'Please fill in every field.';
      status.classList.add('text-red-400');
      return;
    }

    label.textContent = 'Sending…';
    await saveToSupabase('messages', { ...msg, created_at: new Date().toISOString() });
    const result = await sendViaFormspree(CONFIG.CONTACT_FORM_ID, {
      _subject: `Portfolio contact: ${msg.subject}`,
      to: CONFIG.NOTIFY_EMAIL, ...msg,
    });

    label.textContent = 'Send Message';
    status.classList.remove('text-red-400');

    if (result.ok){
      status.textContent = "Message sent — thank you! I'll get back to you soon.";
      form.reset();
    } else if (result.reason === 'not-configured'){
      status.textContent = "Saved — email delivery isn't configured yet on this deployment.";
    } else {
      status.textContent = "Something went wrong sending that — please email me directly instead.";
      status.classList.add('text-red-400');
    }
  });
})();

/* =========================================================================
   TYPEWRITER
   ========================================================================= */
(function typewriter(){
  const el = document.getElementById('typewriter');
  const words = ['Python Developer', 'React Developer', 'AI Engineer', 'Machine Learning Enthusiast', 'Java Developer'];
  let wi = 0, ci = 0, deleting = false;
  function tick(){
    const word = words[wi];
    ci += deleting ? -1 : 1;
    el.textContent = word.slice(0, ci);
    let delay = deleting ? 35 : 70;
    if (!deleting && ci === word.length){ delay = 1400; deleting = true; }
    else if (deleting && ci === 0){ deleting = false; wi = (wi + 1) % words.length; delay = 300; }
    setTimeout(tick, delay);
  }
  tick();
})();

/* =========================================================================
   DATA — SKILLS / TIMELINE / PROJECTS (from resume)
   ========================================================================= */
const skillGroups = [
  { title:'Programming', items:['Python','JavaScript','SQL','HTML5','CSS3'] },
  { title:'AI &amp; Automation', items:['AI API Integration','Prompt Engineering','Generative AI Fundamentals','Power Apps','Power Automate'] },
  { title:'Database &amp; Backend', items:['Supabase','SQL','REST APIs','Authentication','CRUD Operations'] },
  { title:'Infrastructure', items:['Windows','Linux Basics','Networking Fundamentals'] },
  { title:'Digital Design', items:['Verilog','VHDL','Digital Logic Design','FPGA Basics'] },
  { title:'Tools', items:['Git','GitHub','VS Code','Postman'] },
];

const skillsGrid = document.getElementById('skills-grid');
skillGroups.forEach((g, i) => {
  const card = document.createElement('div');
  card.className = 'card glass p-7 tilt reveal';
  card.setAttribute('data-reveal', '');
  card.innerHTML = `
    <div class="font-mono text-[.62rem] tracking-widest uppercase text-muted mb-4">0${i+1}</div>
    <h3 class="font-display text-lg font-medium mb-4">${g.title}</h3>
    <div class="flex flex-wrap gap-2">
      ${g.items.map(it => `<span class="text-xs px-2.5 py-1 rounded-full border border-white/10 text-muted">${it}</span>`).join('')}
    </div>`;
  skillsGrid.appendChild(card);
});

const timeline = [
  { year:'2022', title:'Engineering Journey Begins', desc:'Started B.E. in Electronics & Communication Engineering, building a foundation in digital logic and systems thinking.' },
  { year:'2023', title:'Frontend Development', desc:'Picked up HTML, CSS, and JavaScript — building responsive, usable interfaces.' },
  { year:'2024', title:'AI & Machine Learning', desc:'Explored AI API integration, prompt engineering, and generative AI fundamentals.' },
  { year:'2024–25', title:'Backend Development', desc:'Built REST APIs, authentication, and CRUD systems with Supabase and SQL.' },
  { year:'2025', title:'Software Developer Intern — L&T', desc:'Shipped web app features, Power Apps dashboards, and AI-assisted functionality in a production SDLC.' },
  { year:'2026', title:'Future Goals', desc:'Graduating and growing into a full-time Software Developer / AI Engineer role, deepening ML and systems expertise.' },
];
const timelineEl = document.getElementById('timeline-items');
timeline.forEach(t => {
  const item = document.createElement('div');
  item.className = 'relative reveal';
  item.setAttribute('data-reveal', '');
  item.innerHTML = `
    <span class="absolute -left-10 top-1.5 w-3.5 h-3.5 rounded-full dot-glow"></span>
    <div class="font-mono text-xs text-muted tracking-widest mb-1">${t.year}</div>
    <h3 class="font-display text-xl font-medium mb-2">${t.title}</h3>
    <p class="text-muted leading-relaxed max-w-xl">${t.desc}</p>`;
  timelineEl.appendChild(item);
});

const projects = [
  { title:'AI Water Leakage Detection System', tags:['Python','Machine Learning','IoT Simulation'],
    desc:'Machine learning solution for detecting water leakage using simulated IoT sensor data — from signal preprocessing to anomaly classification.', link:null },
  { title:'Enterprise E-Doc Approval System', tags:['Supabase','REST APIs','Auth','Workflow Logic'],
    desc:'Backend-driven document approval dashboard with authentication, role-based access, database design, and workflow automation.', link:'https://dashboard-eta-wheat-69.vercel.app/' },
  { title:'Expense Tracker', tags:['React','Charts','Dark Mode','Local Storage'],
    desc:'Modern React-based expense tracking app with charts, filters, dark mode, and persistent local storage.', link:null },
];
const projGrid = document.getElementById('projects-grid');
projects.forEach((p) => {
  const card = document.createElement('div');
  card.className = 'card glass-strong p-7 flex flex-col reveal';
  card.setAttribute('data-reveal', '');
  card.innerHTML = `
    <div class="w-10 h-10 rounded-lg mb-6 flex items-center justify-center bg-accent/10 border border-white/10">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" stroke="#6E93FF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <h3 class="font-display text-xl font-medium mb-3">${p.title}</h3>
    <p class="text-muted text-sm leading-relaxed mb-5 flex-1">${p.desc}</p>
    <div class="flex flex-wrap gap-2 mb-6">
      ${p.tags.map(t => `<span class="text-[.66rem] font-mono px-2.5 py-1 rounded-full border border-white/10 text-muted">${t}</span>`).join('')}
    </div>
    ${p.link ? `<a href="${p.link}" target="_blank" rel="noopener" class="btn-ghost !py-2 !px-4 !text-xs self-start">Live Site ↗</a>` : `<span class="font-mono text-[.66rem] text-muted">Case study on request</span>`}
  `;
  projGrid.appendChild(card);
});

function animateCounters(){
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const obj = { val:0 };
    gsap.to(obj, { val:target, duration:1.4, ease:'power2.out', onUpdate: () => el.textContent = Math.round(obj.val) });
  });
}

/* =========================================================================
   NAV + SCROLL REVEALS
   ========================================================================= */
gsap.registerPlugin(ScrollTrigger);

const nav = document.getElementById('site-nav');
ScrollTrigger.create({ start:60, end:99999, toggleClass: { targets: nav, className:'scrolled' } });

document.getElementById('back-to-top').addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

function setupReveals(){
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    gsap.to(el, { opacity:1, y:0, duration:.8, ease:'power3.out', scrollTrigger:{ trigger: el, start:'top 88%' } });
  });
  ScrollTrigger.create({ trigger:'#about', start:'top 75%', once:true, onEnter: animateCounters });
}

function playIntroTimeline(){
  gsap.to('#hero [data-reveal]', { opacity:1, y:0, duration:.9, stagger:.1, ease:'power3.out' });
  ScrollTrigger.refresh();
  setupReveals();
}
if (sessionStorage.getItem('cs_gate_passed') === '1'){
  window.addEventListener('load', () => { gsap.set('#hero [data-reveal]', { opacity:1, y:0 }); setupReveals(); });
}

/* subtle card tilt on hover (quiet, professional — not exaggerated) */
document.addEventListener('mousemove', (e) => {
  document.querySelectorAll('.tilt').forEach(card => {
    const r = card.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `perspective(800px) rotateX(${py * -3}deg) rotateY(${px * 3}deg) translateY(-2px)`;
  });
});
document.addEventListener('mouseleave', () => {
  document.querySelectorAll('.tilt').forEach(card => card.style.transform = '');
});

/* =========================================================================
   THREE.JS — restrained cinematic scenes (single accent, lower density)
   ========================================================================= */
import('three').then((THREE) => {

  function makeParticleField(count, spread, color, size){
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++){
      pos[i*3] = (Math.random() - .5) * spread;
      pos[i*3+1] = (Math.random() - .5) * spread;
      pos[i*3+2] = (Math.random() - .5) * spread;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, transparent:true, opacity:.55, depthWrite:false, blending: THREE.AdditiveBlending });
    return new THREE.Points(geo, mat);
  }

  function makeNeuralNet(nodeCount, spread, color){
    const group = new THREE.Group();
    const nodes = [];
    for (let i = 0; i < nodeCount; i++) nodes.push(new THREE.Vector3((Math.random()-.5)*spread,(Math.random()-.5)*spread,(Math.random()-.5)*spread));
    const lineMat = new THREE.LineBasicMaterial({ color, transparent:true, opacity:.12 });
    for (let i = 0; i < nodeCount; i++){
      for (let j = i+1; j < nodeCount; j++){
        if (nodes[i].distanceTo(nodes[j]) < spread * .2){
          group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([nodes[i], nodes[j]]), lineMat));
        }
      }
    }
    const nodeGeo = new THREE.SphereGeometry(.035, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color });
    nodes.forEach(p => { const m = new THREE.Mesh(nodeGeo, nodeMat); m.position.copy(p); group.add(m); });
    return group;
  }

  function buildScene(canvas, opts){
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, canvas.clientWidth / canvas.clientHeight, .1, 100);
    camera.position.z = opts.camZ || 7;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize(); window.addEventListener('resize', resize);

    const icoGeo = new THREE.IcosahedronGeometry(opts.icoSize || 1.6, 2);
    const icoMat = new THREE.MeshBasicMaterial({ color:0x4C7CFF, wireframe:true, transparent:true, opacity:.34 });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    scene.add(ico);

    const icoGeo2 = new THREE.IcosahedronGeometry((opts.icoSize || 1.6) * 1.4, 1);
    const icoMat2 = new THREE.MeshBasicMaterial({ color:0x4C7CFF, wireframe:true, transparent:true, opacity:.1 });
    scene.add(new THREE.Mesh(icoGeo2, icoMat2));

    scene.add(makeParticleField(opts.particles || 650, opts.spread || 16, 0x6E93FF, .024));
    const neural = makeNeuralNet(opts.nodes || 22, opts.icoSize ? (opts.icoSize*4.2) : 6.5, 0x4C7CFF);
    scene.add(neural);

    const glassGroup = new THREE.Group();
    const sphereGeo = new THREE.SphereGeometry(.14, 18, 18);
    for (let i = 0; i < (opts.glassSpheres || 6); i++){
      const mat = new THREE.MeshBasicMaterial({ color:0x4C7CFF, transparent:true, opacity:.22, wireframe: i % 3 === 0 });
      const m = new THREE.Mesh(sphereGeo, mat);
      m.position.set((Math.random()-.5)*6, (Math.random()-.5)*6, (Math.random()-.5)*4);
      m.userData.speed = .2 + Math.random()*.35;
      m.userData.offset = Math.random()*Math.PI*2;
      glassGroup.add(m);
    }
    scene.add(glassGroup);

    const mouse = { x:0, y:0 };
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    });

    const clock = new THREE.Clock();
    function animate(){
      const t = clock.getElapsedTime();
      ico.rotation.y = t * .1; ico.rotation.x = t * .05;
      neural.rotation.y = t * .03;
      glassGroup.children.forEach((m) => {
        m.position.y += Math.sin(t * m.userData.speed + m.userData.offset) * .0012;
        m.rotation.y = t * .25;
      });
      camera.position.x += (mouse.x * .4 - camera.position.x) * .04;
      camera.position.y += (-mouse.y * .3 - camera.position.y) * .04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();
  }

  const heroCanvas = document.getElementById('hero-canvas');
  if (heroCanvas) buildScene(heroCanvas, { camZ:7, icoSize:1.6, particles:750, spread:18, nodes:24, glassSpheres:7 });

  const gateCanvas = document.getElementById('gate-canvas');
  if (gateCanvas && document.getElementById('gate').style.display !== 'none'){
    buildScene(gateCanvas, { camZ:6, icoSize:1.2, particles:450, spread:14, nodes:16, glassSpheres:4 });
  }
}).catch(err => console.warn('Three.js failed to load — decorative 3D scenes skipped.', err));