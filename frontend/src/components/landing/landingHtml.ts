// Auto-generated landing page HTML for NetraVaani
export const LANDING_HTML = `<canvas id="stage" aria-hidden="true"></canvas>
<div class="bubble" id="bubble" role="status" aria-live="polite"><span id="bubbleText"></span><small id="bubbleHi" lang="hi"></small><i class="tail" id="tail"></i></div>

<header class="top">
  <a class="brand" href="#top" aria-label="NetraVaani home"><i></i>NetraVaani</a>
  <nav class="nav" aria-label="Sections">
    <a class="opt" href="#who">Who it’s for</a>
    <a class="opt" href="#eeg">Electrodes</a>
    <a class="opt" href="#flow">How it works</a>
    <a href="#hardware">NPG Lite</a>
    <a class="cta" href="#pilot">Request a pilot</a>
    <a class="cta" id="navSignIn" href="#login" style="background:#06B6D4;color:#000000;margin-left:4px">Sign in</a>
  </nav>
  <button class="sound" id="sound" type="button" aria-pressed="false" aria-label="Toggle sound"><span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="lbl">Sound off</span></button>
</header>

<main id="top">
  <!-- HERO -->
  <section class="chapter ch-blue hero" data-cam="hero" data-side="right" data-say="Hi, I’m Netra. Scroll down, I’ll show you how I listen." data-say-mobile="Hi, I’m Netra. Scroll down!">
    <div class="wrap">
      <div class="col-l">
        <h1 class="wordmark">NetraVaani<span class="dot">.</span></h1>
        <h2 class="split hero-subtitle">A voice for patients who are awake, aware, and unable to move.</h2>
        <p class="lede hero-lede">Real-time biopotential neural telemetry bridging intentional micro-blinks and wrist twitches directly into bedside audio commands and emergency nurse dispatch.</p>
        
        <div class="btns reveal">
          <a class="btn hot" href="#pilot">Request a pilot →</a>
          <a class="btn" href="#flow">See how it works</a>
          <button class="btn danger" id="demoSeizureBtn" type="button" style="cursor:pointer">Simulate Seizure Emergency</button>
        </div>
      </div>
    </div>
    <div class="scroll-hint mono" aria-hidden="true"><span></span>Scroll</div>
  </section>

  <div class="band ch-ink" aria-hidden="true"><div class="track" data-dir="1"><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i></div></div>

  <!-- WHO -->
  <section class="chapter ch-paper" id="who" data-cam="who" data-side="left" data-say="They hear every word. They just can’t answer yet." data-pose="sad">
    <div class="wrap">
      <div class="col-r">
        <span class="kicker mono">Who it’s for</span>
        <h2 class="h2 split">For the patient who hears every word but can’t answer</h2>
        <p class="lede reveal">After major surgery, on a ventilator, after a stroke or a spinal injury, many people stay fully conscious while their body stops responding. Often the last movements left are a blink and a squeeze too faint to see.</p>
        <p class="reveal">NetraVaani listens for exactly those, so the patient can say yes, no, “I’m in pain” or “call the nurse” without speaking or moving a limb.</p>
      </div>
    </div>
  </section>

  <!-- EEG -->
  <section class="chapter ch-stone" id="eeg" data-cam="eeg" data-side="right" data-say="See the silver dot on my headband? Blink twice and it hears you." data-pose="blink2">
    <div class="wrap">
      <div class="col-l">
        <span class="kicker mono">Channel 1 · EEG</span>
        <h2 class="h2 split">The forehead reads the eyes</h2>
        <p class="lede reveal">An Ag/AgCl electrode in the headband sits at the centre of the forehead, referenced to a second electrode behind the ear on the mastoid bone. Every deliberate blink sends a large, sharp wave across the frontal signal.</p>
        <p class="reveal">Natural blinks come alone and at random. NetraVaani waits for deliberate patterns, like two quick blinks or one long close, so ordinary blinking never sends an unintended request.</p>
        <div class="card reveal">
          <dl class="spec">
            <dt>Active</dt><dd>Forehead centre (Fpz), in a headband</dd>
            <dt>Reference</dt><dd>Mastoid, behind the ear</dd>
            <dt>Detects</dt><dd>Double, triple and long deliberate blinks</dd>
          </dl>
        </div>
        <div class="diagram reveal" aria-hidden="true">
          <svg viewBox="0 0 400 90"><path d="M0 50 H60 l8 -2 l6 4 l6 -3 H120 q8 -46 16 0 q4 6 8 0 H180 q8 -46 16 0 q4 6 8 0 H260 l6 -3 l6 4 l6 -2 H400" fill="none" stroke="#06B6D4" stroke-width="3" stroke-linejoin="round"/><circle class="glow" cx="128" cy="12" r="7" fill="#EF4444"/><circle class="glow" cx="188" cy="12" r="7" fill="#EF4444" style="animation-delay:.25s"/><text x="0" y="86" font-size="12" font-family="Space Grotesk" fill="#FFFFFF" opacity=".7">Fpz – mastoid · two deliberate blinks</text></svg>
        </div>
        <div class="card reveal seizure-demo-card" id="eegSeizureCard" role="button" tabindex="0">
          <div class="seizure-card-content">
            <span class="seizure-icon"></span>
            <div>
              <div class="seizure-card-title">Simulate Nocturnal Seizure &amp; Sleep Distress Spikes</div>
              <p class="seizure-card-desc">Simulates a 4.5 Hz high-voltage epileptiform polyspike-and-slow-wave discharge detected on the frontal headband (Fpz). Instantly flashes the bedside CRT monitor and triggers critical audio telemetry.</p>
              <div class="seizure-card-action">Click to Trigger Seizure Simulation →</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- EMG -->
  <section class="chapter ch-paper" id="emg" data-cam="emg" data-side="left" data-say="Orange wristbands! Squeeze, even a tiny bit, and I feel it." data-pose="both">
    <div class="wrap">
      <div class="col-r">
        <span class="kicker mono">Channels 2 and 3 · EMG</span>
        <h2 class="h2 split">The wrists read the hands</h2>
        <p class="lede reveal">A soft strap band on each wrist holds an Ag/AgCl pad against the forearm muscles. A squeeze too weak to close the fist still fires a burst of electrical activity in the muscle, and the band picks it up.</p>
        <p class="reveal">Left, right, or both at once: three more signals the patient can send on purpose.</p>
        <div class="card reveal">
          <dl class="spec">
            <dt>Channel 2</dt><dd>Left wrist band</dd>
            <dt>Channel 3</dt><dd>Right wrist band</dd>
            <dt>Detects</dt><dd>Single and paired intentional squeezes</dd>
          </dl>
        </div>
      </div>
    </div>
  </section>

  <!-- FLOW -->
  <section class="chapter ch-ink" id="flow" data-cam="flow" data-side="right" data-say="Twitch in, sentence out. Five steps, well under a second." data-pose="think">
    <div class="wrap">
      <div class="col-l">
        <span class="kicker mono">How it works</span>
        <h2 class="h2 split">From a twitch to a sentence</h2>
        <ol class="steps">
          <li class="reveal"><div><h3>Sense</h3><p>Gelled Ag/AgCl electrodes pick up microvolt-level signals from the skin on the forehead, mastoid and wrists.</p></div></li>
          <li class="reveal"><div><h3>Amplify and digitize</h3><p>A biopotential front end in the bedside unit amplifies all three channels and converts them to digital samples.</p></div></li>
          <li class="reveal"><div><h3>Clean</h3><p>Band-pass filters separate eye and muscle activity, and a 50 Hz notch removes mains hum from hospital equipment.</p></div></li>
          <li class="reveal"><div><h3>Recognise</h3><p>Timing and amplitude rules match each channel against the patient’s gesture set and ignore accidental movement.</p></div></li>
          <li class="reveal"><div><h3>Speak and alert</h3><p>The request is spoken aloud in English or Hindi, shown on screen, and urgent ones notify the nursing station.</p></div></li>
        </ol>
      </div>
    </div>
  </section>

  <div class="band sun" aria-hidden="true"><div class="track" data-dir="-1"><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i><span>Blink</span><i>✦</i><span class="o">Squeeze</span><i>✦</i><span>Speak</span><i>✦</i><span class="o" lang="hi">बोलो</span><i>✦</i></div></div>

  <!-- HARDWARE -->
  <section class="chapter ch-paper" id="hardware" data-cam="hardware" data-side="corner" data-say="This is my brain. Pull it apart with the slider!">
    <div class="wrap">
      <div class="col-wide">
        <span class="kicker mono">Modular biopotential hardware</span>
        <h2 class="h2 split">Inside the NPG Lite system</h2>
        <p class="lede reveal">The wearable biopotential unit that decodes deliberate blinks and faint wrist squeezes into spoken requests. Drag it around and pull it apart, from the protective 3D-printed enclosure down to the ESP32-C6 sensor core, ProtoPlaymate carrier and rechargeable LiPo cell.</p>
      </div>
      <div class="hw-grid">
        <div class="panel reveal">
          <div class="explode" id="explode">
            <canvas id="hwCanvas" role="img" aria-label="Interactive 3D exploded view of the NPG Lite assembly"></canvas>
            <div class="hw-labels" id="hwLabels"></div>
            <span class="hw-hint mono">Drag to rotate · tap a part</span>
          </div>
          <div class="controls">
            <button class="chip" id="hwAnim" type="button">Animate</button>
            <button class="chip" id="hwClose" type="button" aria-pressed="true">Assembled</button>
            <button class="chip" id="hwOpen" type="button" aria-pressed="false">Exploded</button>
            <label class="sr" for="hwRange">Explode amount</label>
            <input id="hwRange" type="range" min="0" max="100" value="0">
          </div>
        </div>
        <div class="panel insp reveal" aria-live="polite">
          <span class="mono" id="inspLayer">Layer 02 · Sensor &amp; wireless core</span>
          <h3 id="inspTitle">NPG Lite Sensor Board</h3>
          <p id="inspBody">High-precision differential biopotential acquisition board. Integrates microvolt analog front-end filtering with an Espressif ESP32-C6 RISC-V SoC for low-latency wireless transmission of patient gestures.</p>
          <div class="pills" id="inspPills"></div>
          <div class="kpis">
            <div><b>ESP32-C6</b><span>Core MCU · 160 MHz</span></div>
            <div><b>BLE 5.3</b><span>&amp; Wi-Fi 6</span></div>
            <div><b>3 diff.</b><span>Biopotential channels</span></div>
            <div><b>&lt; 1 µV</b><span>RMS noise</span></div>
          </div>
        </div>
      </div>

      <div class="rail">
        <figure class="shot reveal">
          <div class="frame">
            <div class="bar"><span>NPG Lite Core</span><span>ESP32-C6</span></div>
            <div class="pic"><img src="/landing/hardware/board-exploded.png" alt="NPG Lite sensor board and carrier assembly" loading="lazy"></div>
          </div>
          <figcaption><b>NPG Lite sensor board</b>Mounted on the ProtoPlaymate carrier dock with dual right-angle header breakouts.</figcaption>
        </figure>
        <figure class="shot reveal">
          <div class="frame">
            <div class="bar"><span>Enclosure</span><span>3D Biocompatible</span></div>
            <div class="pic"><img src="/landing/hardware/board-annotated.png" alt="NPG Lite in 3D-printed enclosure with battery connector and switch callouts" loading="lazy"></div>
          </div>
          <figcaption><b>Enclosure assembly</b>Keyed JST battery connector and side-mounted hardware ON/OFF disconnect switch.</figcaption>
        </figure>
        <figure class="shot reveal">
          <div class="frame">
            <div class="bar"><span>Exploded Case</span><span>Snap-Fit</span></div>
            <div class="pic"><img src="/landing/hardware/enclosure.jpg" alt="Three-piece exploded view of the enclosure lid, NPG Lite assembly and bottom case" loading="lazy"></div>
          </div>
          <figcaption><b>Exploded case assembly</b>Dual-shell impact-resistant housing with strap routing and internal isolation.</figcaption>
        </figure>
        <figure class="shot reveal">
          <div class="frame">
            <div class="bar"><span>Power</span><span>3.7V LiPo</span></div>
            <div class="pic"><img src="/landing/hardware/battery-cable.jpg" alt="3.7 V 400 mAh LiPo battery with cable and JST connector" loading="lazy"></div>
          </div>
          <figcaption><b>Rechargeable LiPo cell</b>3.7 V 400 mAh high-density cell with flexible silicone harness and keyed JST-PH connector.</figcaption>
        </figure>
      </div>
    </div>
  </section>

  <!-- PILOT -->
  <section class="chapter ch-ink" id="pilot" data-cam="cta" data-side="left" data-say="Got a ward that needs me? I travel light." data-pose="jump">
    <div class="wrap">
      <div class="col-r">
        <span class="kicker mono">Pilot programme</span>
        <h2 class="big split">Give your patients back a way to ask</h2>
        <p class="lede reveal">We are deploying NetraVaani into ICUs, stroke recovery centres, and palliative care wards. Our team configures bedside gateways and trains clinical staff on-site in under two hours.</p>
        <div class="btns reveal">
          <a class="btn hot" href="mailto:contact@netravaani.org?subject=NetraVaani%20Pilot%20Inquiry">Request a pilot →</a>
        </div>
      </div>
    </div>
  </section>
</main>

<footer data-side="corner" data-say="Bye for now! Click me for a trick.">
  <div class="wrap">
    <span>© 2026 NetraVaani</span>
    <a href="#hardware">NPG Lite Hardware</a>
    <span class="sp"></span>
    <button class="linkbtn" id="trick" type="button">Do a trick</button>
  </div>
</footer>
<canvas id="bedScene" aria-hidden="true"></canvas>`;
