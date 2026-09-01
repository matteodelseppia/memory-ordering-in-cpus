const $ = (selector) => document.querySelector(selector);
const all = (selector) => [...document.querySelectorAll(selector)];

const playButton = $('#play');
const previousButton = $('#previous');
const nextButton = $('#next');
const speed = $('#speed');
const fenceToggle = $('#fenceToggle');
const fenceText = $('#fenceText');
const payloadValue = $('#payloadValue');
const readyValue = $('#readyValue');
const busCaption = $('#busCaption');
const writerPulse = $('#writerPulse');
const guideStep = $('#guideStep');
const guideKicker = $('#guideKicker');
const guideTitle = $('#guideTitle');
const guideText = $('#guideText');
const guideRule = $('#guideRule');

let stage = 0;
let playing = false;
let fenced = false;
let timer;
const lastStage = 6;

const guide = [
  {
    kicker: 'START HERE',
    title: 'The program has a source order.',
    text: 'Core R is written to read <code>ready</code> first. Neither CPU has done any work yet. Use <strong>Next step</strong> to advance one visible event at a time.',
    rule: '<b>01</b> and <b>02</b> are source-code positions. Their vertical placement shows the order the CPU actually executed them.'
  },
  {
    kicker: '01 · SPECULATION',
    title: 'Core R runs a later load early.',
    text: 'Even though <code>payload</code> is source instruction <b>02</b>, the CPU reads it now and gets <code>0</code>. This is fast and harmless <em>as long as the CPU can still make the final result look legal.</em>',
    rule: 'Execution order is private. The architectural promise applies when instructions retire and become visible.'
  },
  {
    kicker: '02 · CONTENTION ARRIVES',
    title: 'Another core changes the payload.',
    text: 'Core W writes <code>payload = 42</code>. Core R’s speculative <code>0</code> is now stale—but it has not committed yet, so the CPU can still discard it.',
    rule: 'This is the unusual, slow case: another core modifies a line while a read of it is still in flight.'
  },
  {
    kicker: '03 · PUBLISH',
    title: 'The writer raises the flag.',
    text: 'Core W now writes <code>ready = 1</code>. From the source program’s perspective, this tells Core R that the earlier payload write is ready to use.',
    rule: 'The example isolates a read-side ordering question. The writer publishes payload before ready.'
  },
  {
    kicker: '04 · THE SURPRISING PAIR',
    title: 'Core R finally reads source instruction 01.',
    text: 'It gets <code>ready = 1</code>—while its earlier speculative read still holds <code>payload = 0</code>. The CPU now has to decide: may that pair retire?',
    rule: 'The same physical speculation happened in both columns. The difference is the contract used to validate it.'
  },
  {
    kicker: '05 · VALIDATE',
    title: 'This is where the memory models diverge.',
    text: 'A strong ordering contract must reject this final observation for the source order. Relaxed operations on a weak model do not promise this ordering, so the same observation can be legal.',
    rule: 'Strong versus weak is mostly about which conflicts must be noticed and repaired—not whether speculation exists.'
  },
  {
    kicker: '06 · RETIRE OR REPLAY',
    title: fenced ? 'Synchronization gives both CPUs a rule to enforce.' : 'One CPU retries. The other may finish.',
    text: fenced
      ? 'Release on the writer and acquire on the reader create an explicit ordering edge. The weak model must now discard the stale speculative read and retry it, just like the strong model.'
      : 'The strong model replays the stale load and observes <code>42</code>. The weak model can retire <code>ready = 1, payload = 0</code> because these were relaxed operations. That is why message passing needs synchronization.',
    rule: fenced
      ? 'A fence or acquire/release does not stop all speculation. It tells the CPU which result combinations are forbidden at retirement.'
      : '“Legal” does not mean useful for this protocol. It means the program did not ask the weak model to preserve this relationship.'
  }
];

function setGuide() {
  const message = guide[stage];
  guideStep.textContent = String(stage).padStart(2, '0');
  guideKicker.textContent = message.kicker;
  guideTitle.textContent = message.title;
  guideText.innerHTML = message.text;
  guideRule.innerHTML = message.rule;
}

function show(selector) { $(selector).classList.add('show'); }
function activate(selector, committed = false) {
  const element = $(selector);
  element.classList.add('active');
  if (committed) element.classList.add('committed');
}
function writeMemory(element, value) {
  element.textContent = value;
  element.classList.remove('run-pulse');
  void element.offsetWidth;
  element.classList.add('run-pulse');
}

function clearScene() {
  all('.op').forEach((element) => element.classList.remove('active', 'committed'));
  all('.conflict, .replay, .verdict').forEach((element) => element.classList.remove('show'));
  all('[data-op="strong-payload"] small, [data-op="weak-payload"] small').forEach((element) => {
    element.innerHTML = 'speculates early → <em>0</em>';
  });
  payloadValue.textContent = '0';
  readyValue.textContent = '0';
  writerPulse.classList.remove('writer-active');
  busCaption.textContent = 'memory starts at payload = 0, ready = 0';
}

function render() {
  clearScene();
  setGuide();
  previousButton.disabled = stage === 0;
  nextButton.disabled = stage === lastStage;
  nextButton.innerHTML = stage === lastStage ? 'Trace complete <span class="play-icon">✓</span>' : 'Next step <span class="play-icon">→</span>';

  if (stage >= 1) {
    activate('[data-op="strong-payload"]');
    activate('[data-op="weak-payload"]');
    busCaption.textContent = 'Core R speculates: source instruction 02 reads payload → 0';
  }
  if (stage >= 2) {
    writerPulse.classList.add('writer-active');
    writeMemory(payloadValue, '42');
    busCaption.textContent = 'Core W writes payload = 42';
  }
  if (stage >= 3) {
    writerPulse.classList.remove('writer-active');
    writeMemory(readyValue, '1');
    busCaption.textContent = 'Core W publishes ready = 1';
  }
  if (stage >= 4) {
    activate('[data-op="strong-ready"]');
    activate('[data-op="weak-ready"]');
    busCaption.textContent = 'Core R reads source instruction 01: ready → 1';
  }
  if (stage >= 5) {
    show('[data-el="strong-conflict"]');
    show('[data-el="weak-conflict"]');
    busCaption.textContent = 'both have the pair: ready = 1, payload = 0';
  }
  if (stage >= 6) {
    show('[data-el="strong-replay"]');
    $('[data-op="strong-payload"] small').innerHTML = 'replayed → <em>42</em>';
    activate('[data-op="strong-payload"]', true);
    activate('[data-op="strong-ready"]', true);
    show('[data-el="strong-verdict"]');
    activate('[data-op="weak-payload"]', true);
    activate('[data-op="weak-ready"]', true);
    show('[data-el="weak-verdict"]');
    if (fenced) {
      $('[data-el="weak-conflict"]').classList.remove('show');
      show('[data-el="weak-fence"]');
      $('[data-op="weak-payload"] small').innerHTML = 'replayed → <em>42</em>';
      $('[data-el="weak-verdict"] strong').textContent = 'Synchronization preserved';
      $('[data-el="weak-verdict"] small').innerHTML = 'observes <code>ready = 1</code>, <code>payload = 42</code>';
      busCaption.textContent = 'both models retry the stale load and see payload = 42';
    } else {
      $('[data-el="weak-verdict"] strong').textContent = 'Legal—but not a message';
      $('[data-el="weak-verdict"] small').innerHTML = 'observes <code>ready = 1</code>, <code>payload = 0</code>';
      busCaption.textContent = 'strong replays; weak relaxed operations may retire';
    }
  }
}

function stopAutoplay() {
  playing = false;
  clearTimeout(timer);
  playButton.innerHTML = '<span class="play-icon">▶</span> Auto-play';
}
function advance() {
  if (stage < lastStage) {
    stage += 1;
    render();
  }
  if (stage === lastStage) stopAutoplay();
}
function autoplay() {
  if (playing) {
    stopAutoplay();
    return;
  }
  if (stage === lastStage) stage = 0;
  playing = true;
  playButton.innerHTML = 'Ⅱ Pause';
  const tick = () => {
    advance();
    if (playing) timer = setTimeout(tick, 1200 / Number(speed.value));
  };
  timer = setTimeout(tick, 300);
}

nextButton.addEventListener('click', () => { stopAutoplay(); advance(); });
previousButton.addEventListener('click', () => { stopAutoplay(); stage = Math.max(0, stage - 1); render(); });
playButton.addEventListener('click', autoplay);
fenceToggle.addEventListener('click', () => {
  fenced = !fenced;
  fenceToggle.setAttribute('aria-checked', String(fenced));
  fenceText.textContent = fenced ? 'release + acquire' : 'relaxed loads / stores';
  $('#writerReady').innerHTML = fenced ? 'ready.<span class="sync-word">release</span>(<b>1</b>);' : 'ready = <b>1</b>;';
  $('#readerReady').innerHTML = fenced ? 'ready.<span class="sync-word">acquire</span>()' : 'ready';
  stopAutoplay();
  stage = 0;
  render();
  busCaption.textContent = fenced ? 'synchronization enabled — walk the trace again' : 'relaxed operations restored — walk the trace again';
});

render();
