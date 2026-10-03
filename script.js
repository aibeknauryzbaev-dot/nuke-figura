(() => {
  const $ = (id) => document.getElementById(id);
  const screens = { start: $('startScreen'), play: $('playScreen') };
  const ui = {
    score: $('score'), label: $('levelLabel'), title: $('levelTitle'), task: $('taskText'),
    fill: $('progressFill'), progress: $('progressLabel'), board: $('board'), feedback: $('feedback'),
    tip: $('mascotTip'), next: $('nextQuestionBtn'), modal: $('modalBackdrop'), modalTitle: $('modalTitle'),
    modalKicker: $('modalKicker'), modalText: $('modalText'), modalScore: $('modalScore'), modalAction: $('modalAction'),
    toast: $('toastStars')
  };
  const levelNames = ['НҮКТЕНІ ТАП!', 'СЫЗЫҚТЫҢ ТҮРІН ТАП!', 'ТҰЙЫҚ ПА?', 'МАТЕМАТИКАЛЫҚ ДЕТЕКТИВ'];
  const levelCongrats = ['Сен нүктені жақсы ажырата аласың!', 'Сызықтардың түрін тамаша ажыраттың!', 'Тұйық сызықтарды оңай таныдың!', 'Нағыз математикалық детективсің!'];
  const state = { currentLevel: 0, questionIndex: 0, score: 0, rounds: [], locked: false, audio: null, timer: null };

  // Сызба түрлері: жауаптың дұрыстығы суретке емес, осы белгілерге сүйенеді.
  const shapes = [
    { id:'straight', name:'Түзу сызық', kind:'line', family:'straight', closed:false, path:'M12 52 L188 52', color:'blue' },
    { id:'curvy', name:'Қисық сызық', kind:'line', family:'curve', closed:false, path:'M12 57 C37 6 61 106 89 53 S140 10 188 58', color:'coral' },
    { id:'zigzag', name:'Сынық сызық', kind:'line', family:'broken', closed:false, path:'M12 77 L53 27 L94 73 L137 25 L188 76', color:'green' },
    { id:'circle', name:'Тұйық қисық сызық', kind:'line', family:'curve', closed:true, path:'M100 15 C148 15 179 36 179 55 S148 95 100 95 21 74 21 55 52 15 100 15 Z', color:'purple' },
    { id:'triangle', name:'Тұйық сынық сызық', kind:'line', family:'broken', closed:true, path:'M100 13 L181 91 L19 91 Z', color:'green' },
    { id:'square', name:'Тұйық сынық сызық', kind:'line', family:'broken', closed:true, path:'M35 20 L165 20 L165 90 L35 90 Z', color:'blue' },
    { id:'open-angle', name:'Ашық сынық сызық', kind:'line', family:'broken', closed:false, path:'M24 83 L78 25 L119 65 L178 20', color:'purple' },
    { id:'s-curve', name:'Қисық сызық', kind:'line', family:'curve', closed:false, path:'M20 28 C64 98 136 4 180 78', color:'blue' },
    { id:'oval', name:'Сопақша', kind:'oval', family:'curve', closed:true, path:'', color:'purple' },
    { id:'dot', name:'Нүкте', kind:'dot', family:'other', closed:false, path:'', color:'blue' },
    { id:'dots', name:'Бірнеше нүкте', kind:'dots', family:'other', closed:false, path:'', color:'blue' }
  ];
  const byId = (id) => shapes.find(s => s.id === id);
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
    return copy;
  };
  const choose = (items, count) => shuffle(items).slice(0, count);

  function svgFor(shape) {
    const stroke = shape.color === 'purple' ? 'shape-purple' : shape.color === 'green' ? 'shape-green' : shape.color === 'coral' ? 'shape-coral' : '';
    if (shape.kind === 'dot') return '<svg viewBox="0 0 200 110" aria-hidden="true"><circle class="shape-dot" cx="100" cy="55" r="17"/></svg>';
    if (shape.kind === 'dots') return '<svg viewBox="0 0 200 110" aria-hidden="true"><circle class="shape-dot" cx="48" cy="57" r="9"/><circle class="shape-dot" cx="101" cy="30" r="9"/><circle class="shape-dot" cx="149" cy="71" r="9"/><circle class="shape-dot" cx="83" cy="88" r="8"/><circle class="shape-dot" cx="155" cy="21" r="7"/></svg>';
    if (shape.kind === 'oval') return '<svg viewBox="0 0 200 110" aria-hidden="true"><ellipse class="shape-line shape-purple" cx="100" cy="55" rx="72" ry="34"/></svg>';
    return `<svg viewBox="0 0 200 110" aria-hidden="true"><path class="shape-line ${stroke}" d="${shape.path}"/></svg>`;
  }
  function objectCard(shape, label = '', index = 0) {
    const tag = label ? `<span class="choice-label">${label}</span>` : '';
    return `<button type="button" class="answer-card" data-choice="${shape.id}" aria-label="${shape.name || label || 'Суретті таңдау'}">${tag}${svgFor(shape)}</button>`;
  }
  function sound(correct) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      state.audio ||= new Ctx();
      if (state.audio.state === 'suspended') state.audio.resume();
      const osc = state.audio.createOscillator(); const gain = state.audio.createGain();
      osc.connect(gain); gain.connect(state.audio.destination); osc.type = 'sine';
      const now = state.audio.currentTime; osc.frequency.setValueAtTime(correct ? 680 : 280, now);
      osc.frequency.exponentialRampToValueAtTime(correct ? 940 : 190, now + .16);
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.1, now + .025); gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      osc.start(now); osc.stop(now + .21);
    } catch (_) { /* Дыбыс қолжетімсіз болса да ойын толық жұмыс істейді. */ }
  }
  function celebrate() {
    ui.toast.classList.remove('show'); void ui.toast.offsetWidth; ui.toast.classList.add('show');
    const box = document.createElement('div'); box.className = 'confetti';
    const colors = ['#ffcc38','#58cda4','#63c4f2','#a87ae7','#ff7888'];
    for (let i = 0; i < 34; i++) { const bit = document.createElement('i'); bit.style.left = `${Math.random()*100}%`; bit.style.background = colors[i%colors.length]; bit.style.animationDelay = `${Math.random()*.4}s`; box.append(bit); }
    document.body.append(box); window.setTimeout(() => box.remove(), 2900);
  }
  function switchScreen(which) { screens.start.classList.toggle('active', which === 'start'); screens.play.classList.toggle('active', which === 'play'); }
  function updateScore() { ui.score.textContent = state.score; }
  function makeRounds() {
    const l2pool = [byId('straight'),byId('curvy'),byId('zigzag'),byId('s-curve'),byId('open-angle')];
    const l3pool = [byId('circle'),byId('triangle'),byId('open-angle'),byId('curvy'),byId('square')];
    const missions = [
      {text:'Жалғыз нүктені тап!', test:s=>s.kind==='dot', target:['dot']},
      {text:'Бірнеше нүктені тап!', test:s=>s.kind==='dots', target:['dots']},
      {text:'Түзу сызықты тап!', test:s=>s.kind==='line'&&s.family==='straight', target:['straight']},
      {text:'Ашық қисық сызықты тап!', test:s=>s.kind==='line'&&s.family==='curve'&&!s.closed, target:['curvy','s-curve']},
      {text:'Ашық сынық сызықты тап!', test:s=>s.kind==='line'&&s.family==='broken'&&!s.closed, target:['zigzag','open-angle']},
      {text:'Тұйықталған қисық сызықты тап!', test:s=>s.kind==='line'&&s.family==='curve'&&s.closed, target:['circle','oval']},
      {text:'Тұйықталған сынық сызықты тап!', test:s=>s.kind==='line'&&s.family==='broken'&&s.closed, target:['triangle','square']},
      {text:'Ұштары қосылмаған сызықты тап!', test:s=>s.kind==='line'&&!s.closed, target:['straight','curvy','zigzag','open-angle','s-curve']},
      {text:'Төрт қабырғалы тұйық сынық сызықты тап!', test:s=>s.id==='square', target:['square']}
    ];
    const round4 = shuffle(missions);
    return [null, shuffle(l2pool), shuffle(l3pool), round4.map(m => {
      const correct = byId(m.target[Math.floor(Math.random()*m.target.length)]);
      const distractors = choose(shapes.filter(s=>!m.test(s)), 7);
      return {mission:m, correct, options:shuffle([correct,...distractors])};
    })];
  }
  function startGame() {
    window.clearTimeout(state.timer); state.timer=null;
    state.currentLevel = 0; state.questionIndex = 0; state.score = 0; state.rounds = makeRounds(); state.locked = false;
    updateScore(); switchScreen('play'); renderLevel();
  }
  function renderLevel() {
    state.questionIndex = 0; state.locked = false;
    const n = state.currentLevel;
    $('homeBtn').hidden = false;
    ui.label.textContent = `${n+1}-ДЕҢГЕЙ`; ui.title.textContent = levelNames[n];
    ui.tip.innerHTML = '<span class="tip-icon">✦</span><span>Дайынсың ба? Мұқият қара!</span>';
    ui.feedback.textContent = ''; ui.feedback.className = 'feedback'; ui.next.hidden = true;
    if (n === 0) { ui.task.textContent = 'Суреттердің ішінен нүктені таңда!'; renderLevelOne(); }
    if (n === 1) { ui.task.textContent = 'Көрсетілген сызықты таны!'; renderQuestion(); }
    if (n === 2) { ui.task.textContent = 'Бұл сызық тұйықталған ба?'; renderQuestion(); }
    if (n === 3) { renderQuestion(); }
    updateProgress();
  }
  function renderLevelOne() {
    const cards = [byId('dot'),byId('straight'),byId('curvy'),byId('zigzag'),byId('oval'),byId('dots')];
    ui.board.className = 'board'; ui.board.innerHTML = shuffle(cards).map((s,i)=>objectCard(s,'',i)).join('');
    ui.board.onclick = e => { const card=e.target.closest('.answer-card'); if(!card||state.locked)return; if(card.dataset.choice==='dot') correctAnswer(card,true); else wrongAnswer(card); };
  }
  function renderQuestion() {
    ui.feedback.textContent=''; ui.feedback.className='feedback'; ui.next.hidden=true; state.locked=false;
    ui.board.onclick=null;
    const n=state.currentLevel, i=state.questionIndex;
    if(n===1) {
      const shape=state.rounds[1][i]; ui.board.className='board single-board';
      ui.board.innerHTML=`<div class="question-art">${svgFor(shape)}</div><div class="choice-row-label">Сызықтың түрін таңда:</div>`;
      ui.board.classList.add('choice-row');
      // Бейне жоғарғы үлкен аймақ, жауаптар бір қатарда.
      const art=ui.board.querySelector('.question-art'); art.style.width='100%'; art.style.height='142px'; art.style.flex='1';
      ui.board.insertAdjacentHTML('beforeend', ['ТҮЗУ','ҚИСЫҚ','СЫНЫҚ'].map((label,j)=>`<button type="button" class="answer-card" data-answer="${['straight','curve','broken'][j]}" aria-label="${label}">${svgFor(byId(['straight','curvy','zigzag'][j]))}<span>${label}</span></button>`).join(''));
      ui.board.onclick=e=>{const b=e.target.closest('[data-answer]');if(!b||state.locked)return;if(b.dataset.answer===shape.family)correctAnswer(b,false);else wrongAnswer(b);};
    } else if(n===2) {
      const shape=state.rounds[2][i]; ui.board.className='board single-board'; ui.board.innerHTML=`<div class="question-art">${svgFor(shape)}</div><div class="choice-row-label">Сызықтың ұштары қосылған ба?</div>`;
      ui.board.classList.add('choice-row'); const art=ui.board.querySelector('.question-art'); art.style.width='100%';art.style.height='142px';art.style.flex='1';
      ui.board.insertAdjacentHTML('beforeend', `<button class="answer-card" data-answer="closed" aria-label="Тұйықталған">🔒 ТҰЙЫҚТАЛҒАН</button><button class="answer-card" data-answer="open" aria-label="Тұйықталмаған">↗ ТҰЙЫҚТАЛМАҒАН</button>`);
      ui.board.onclick=e=>{const b=e.target.closest('[data-answer]');if(!b||state.locked)return;if((b.dataset.answer==='closed')===shape.closed)correctAnswer(b,false);else wrongAnswer(b);};
    } else {
      const q=state.rounds[3][i]; ui.task.textContent=q.mission.text; ui.board.className='board detective-board'; ui.board.innerHTML=q.options.map((s,j)=>objectCard(s,'',j)).join('');
      ui.board.onclick=e=>{const b=e.target.closest('[data-choice]');if(!b||state.locked)return;if(b.dataset.choice===q.correct.id)correctAnswer(b,false);else wrongAnswer(b);};
    }
    updateProgress();
  }
  function updateProgress() {
    const n=state.currentLevel; const total=[1,5,5,9][n]; const current=Math.min(state.questionIndex+1,total);
    const done=[0,1,6,11][n]+state.questionIndex;
    ui.progress.textContent=`${current} / ${total}`;
    const percent=(done/20)*100; ui.fill.style.width=`${percent}%`;
  }
  function correctAnswer(card, finishNow) {
    state.locked=true; state.score=Math.min(20,state.score+1); updateScore(); sound(true);
    card.classList.add('is-correct'); card.insertAdjacentHTML('beforeend','<span class="check-mark" aria-hidden="true">★</span>');
    ui.feedback.textContent='⭐ Дұрыс! Жарайсың!';ui.feedback.className='feedback pop';ui.tip.innerHTML='<span class="tip-icon">✦</span><span>Тамаша! Келесіге дайындал!</span>';
    if(state.currentLevel===3) celebrate();
    if(finishNow) { ui.fill.style.width='5%'; ui.progress.textContent='1 / 1'; ui.next.hidden=true; state.timer=window.setTimeout(()=>{state.timer=null;showLevelModal();},650); return; }
    ui.next.hidden=false;
    ui.next.focus({preventScroll:true});
  }
  function wrongAnswer(card) {
    sound(false); card.classList.remove('is-wrong'); void card.offsetWidth; card.classList.add('is-wrong');
    ui.feedback.textContent='💡 Асықпа, тағы бір рет ойлан!';ui.feedback.className='feedback bad pop';
  }
  function advanceQuestion() {
    state.questionIndex++;
    const total=[1,5,5,9][state.currentLevel];
    if(state.questionIndex>=total) { ui.fill.style.width=`${([1,6,11][state.currentLevel]||20)/20*100}%`; showLevelModal(); return; }
    renderQuestion();
  }
  function showLevelModal() {
    sound(true);
    const complete=[1,6,11,20][state.currentLevel]; ui.fill.style.width=`${complete/20*100}%`;
    const n=state.currentLevel; ui.modal.hidden=false; ui.modalKicker.textContent='КЕРЕМЕТ ЖҰМЫС!'; ui.modalTitle.textContent='ЖАРАЙСЫҢ!';
    ui.modalText.textContent=`${n+1}-деңгей аяқталды! ${levelCongrats[n]}`;ui.modalScore.textContent=state.score;
    if(n<3){ui.modalAction.innerHTML='КЕЛЕСІ ДЕҢГЕЙ <span>→</span>';ui.modalAction.onclick=()=>{ui.modal.hidden=true;state.currentLevel++;renderLevel();};}
    else {ui.modalKicker.textContent='ҮЛКЕН ҚҰТТЫҚТАУ!';ui.modalTitle.textContent='СЕН — СЫЗЫҚТАРДЫҢ ШЕБЕРІСІҢ!';ui.modalText.textContent='Сен барлық тапсырманы орындадың!';ui.modalAction.innerHTML='🔄 ҚАЙТА ОЙНАУ';ui.modalAction.onclick=()=>{ui.modal.hidden=true;startGame();};celebrate();}
    ui.modalAction.focus({preventScroll:true});
  }
  function goHome(){window.clearTimeout(state.timer);state.timer=null;ui.modal.hidden=true;switchScreen('start');state.currentLevel=0;state.questionIndex=0;state.score=0;updateScore();ui.fill.style.width='0%';}
  $('startBtn').addEventListener('click',startGame);
  $('homeBtn').addEventListener('click',goHome);
  ui.next.addEventListener('click',advanceQuestion);
  $('modalHome').addEventListener('click',goHome);
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===ui.modal)ui.modalAction.focus({preventScroll:true});});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ui.modal.hidden)ui.modalAction.focus({preventScroll:true});});
  updateScore();
})();






