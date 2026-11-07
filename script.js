document.addEventListener('DOMContentLoaded', () => {
    // ============ Selectors ============
    const bg = document.getElementById('backgroundMusic');
    const voice = document.getElementById('voiceMessage');
    const voiceBtn = document.getElementById('voiceBtn');
    const giftContainer = document.getElementById('giftContainer');
    const keyContainer = document.getElementById('keyContainer');
    const storybookContainer = document.getElementById('storybookContainer');
    const bookCover = document.getElementById('bookCover');
    const pages = document.querySelectorAll('.page');
    const continueHint = document.getElementById('continueHint');
    const cakeContainer = document.getElementById('cake')?.closest('.cake-container');
    const cake = document.getElementById('cake');
    const cakeHint = document.getElementById('cakeHint');
    const micBtn = document.getElementById('micBtn');
    const micLevel = document.getElementById('micLevel');
    const gallery = document.getElementById('gallery');
    const galleryContinue = document.getElementById('galleryContinue');
    const letterText = document.getElementById('letterText');
    const letterContinue = document.getElementById('letterContinue');
    const balloonLayer = document.getElementById('balloonLayer');
    const lanternLayer = document.getElementById('lanternLayer');

    const steps = {
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        step3: document.getElementById('step3'),
        step4: document.getElementById('step4'),
        step5: document.getElementById('step5'),
        step6: document.getElementById('step6'),
        step7: document.getElementById('step7'),
    };

    // ============ State ============
    let giftClicked = false, keyClicked = false, bookStarted = false;
    let canAdvanceStory = false, currentPageIndex = 0;
    let cakeState = 0;
    let micStream = null, micAnalyser = null, micData = null, micCheckRAF = null;
    let micAutoStopTimer = null;
    let audioCtx = null;
    let galleryRevealed = 0;
    let letterStarted = false;

    // ============ Sound Engine ============
    function initAudio() {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }
    function playTone(freq, dur, type = 'sine', vol = 0.12, freqEnd = null) {
        if (!audioCtx) return;
        try {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, audioCtx.currentTime);
            if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + dur);
            g.gain.setValueAtTime(vol, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            o.connect(g).connect(audioCtx.destination);
            o.start(); o.stop(audioCtx.currentTime + dur);
        } catch(e) {}
    }
    function playNoise(dur, vol = 0.08, lowpass = 2000) {
        if (!audioCtx) return;
        try {
            const bufSize = audioCtx.sampleRate * dur;
            const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const src = audioCtx.createBufferSource();
            src.buffer = buffer;
            const f = audioCtx.createBiquadFilter();
            f.type = 'lowpass'; f.frequency.value = lowpass;
            const g = audioCtx.createGain();
            g.gain.setValueAtTime(vol, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
            src.connect(f).connect(g).connect(audioCtx.destination);
            src.start(); src.stop(audioCtx.currentTime + dur);
        } catch(e) {}
    }
    const Sound = {
        pop: () => { playTone(900, 0.15, 'sine', 0.18, 200); playNoise(0.12, 0.1); },
        chime: () => { playTone(1046, 0.35); setTimeout(() => playTone(1318, 0.4), 90); setTimeout(() => playTone(1568, 0.5), 180); },
        page: () => playNoise(0.35, 0.06, 3500),
        blow: () => playNoise(0.6, 0.09, 900),
        slice: () => playNoise(0.4, 0.12, 1800),
        firework: () => { playNoise(0.35, 0.13, 700); playTone(90, 0.3, 'sine', 0.15, 40); },
        letter: () => { playTone(880, 0.3); setTimeout(() => playTone(1174, 0.35), 100); setTimeout(() => playTone(1396, 0.4), 200); },
    };

    // ============ Transition ============
    function goToStep(id) {
        const cur = document.querySelector('.step.active');
        if (cur) cur.classList.remove('active');
        steps[id].classList.add('active');
    }

    // ============ STEP 1: Gift ============
    giftContainer.addEventListener('click', () => {
        if (giftClicked) return; giftClicked = true;
        initAudio(); Sound.pop();
        giftContainer.classList.add('open');
        bg.play().catch(() => {});
        setTimeout(() => goToStep('step2'), 800);
    });

    // ============ STEP 2: Key ============
    keyContainer.addEventListener('click', () => {
        if (keyClicked) return; keyClicked = true;
        initAudio(); Sound.chime();
        keyContainer.classList.add('unlocking');
        setTimeout(() => {
            goToStep('step3');
            setTimeout(() => storybookContainer.classList.add('visible'), 100);
        }, 600);
        setTimeout(startBook, 2000);
    });

    // ============ STEP 3: Book ============
    function startBook() {
        if (bookStarted) return; bookStarted = true;
        storybookContainer.classList.add('opening');
        setTimeout(() => {
            bookCover.classList.add('flipped');
            setTimeout(() => { canAdvanceStory = true; continueHint.classList.add('visible'); }, 1200);
        }, 1000);
    }
    steps.step3.addEventListener('click', () => {
        if (!canAdvanceStory) return;
        canAdvanceStory = false; continueHint.classList.remove('visible');
        initAudio(); Sound.page();
        if (currentPageIndex < pages.length) {
            pages[currentPageIndex].classList.add('flipped');
            currentPageIndex++;
            setTimeout(() => {
                if (currentPageIndex < pages.length) {
                    canAdvanceStory = true; continueHint.classList.add('visible');
                } else {
                    setTimeout(() => {
                        goToStep('step4');
                        setTimeout(onCakeStepEnter, 500);
                    }, 600);
                }
            }, 1350);
        }
    });

    // ============ STEP 4: Cake + Mic ============
    function blowCandles() {
        if (cakeState !== 0) return;
        cake.classList.add('blown');
        Sound.blow();
        cakeHint.textContent = 'Now tap to cut the cake 🔪';
        cakeState = 1;
        stopMic();
        micBtn.textContent = '✅ Blown by breath!';
    }
    function cutCake() {
        if (cakeState !== 1) return;
        cake.classList.add('cut');
        Sound.slice();
        cakeHint.textContent = 'Yay! 🎉';
        cakeState = 2;
        setTimeout(() => goToStep('step5'), 1600);
        setTimeout(populateGallery, 400);
    }

    // Cake click (fallback + cut cake)
    if (cakeContainer) cakeContainer.addEventListener('click', (e) => {
        initAudio();
        if (e.target === micBtn) return;
        if (cakeState === 0) {
            // try mic first
            if (!micStream && !micBtn.disabled) {
                startMicListening();
                return;
            }
            blowCandles();
        } else if (cakeState === 1) {
            cutCake();
        }
    });

    // Manual button tap
    micBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (micStream) return;
        if (!micBtn.disabled) await startMicListening();
    });

    // Auto-start mic when cake step loads
    function onCakeStepEnter() {
        initAudio();
        setTimeout(() => {
            if (cakeState === 0 && !micStream) startMicListening();
        }, 400);
    }

    async function startMicListening() {
        if (micStream || cakeState !== 0) return;
        initAudio();

        try {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            const source = audioCtx.createMediaStreamSource(micStream);
            micAnalyser = audioCtx.createAnalyser();
            micAnalyser.fftSize = 1024;
            micAnalyser.smoothingTimeConstant = 0.2;
            micData = new Uint8Array(micAnalyser.fftSize);
            source.connect(micAnalyser);

            micBtn.textContent = '🎤 Listening — blow now!';
            micBtn.classList.add('listening');
            micBtn.disabled = true;

            let blowFrames = 0;

            const check = () => {
                if (!micStream || cakeState !== 0) return;

                micAnalyser.getByteTimeDomainData(micData);

                // RMS — breath ka best detector
                let sum = 0;
                for (let i = 0; i < micData.length; i++) {
                    const v = (micData[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / micData.length);

                // Visual bar
                const percent = Math.min(rms * 100 * 2.5, 100);
                if (micLevel) micLevel.style.width = percent + '%';

                // Blow detected: sustained RMS > 0.06 for ~10 frames (~160ms)
                if (rms > 0.06) {
                    blowFrames++;
                    if (blowFrames >= 10) {
                        blowCandles();
                        return;
                    }
                } else {
                    blowFrames = Math.max(0, blowFrames - 1);
                }

                micCheckRAF = requestAnimationFrame(check);
            };
            check();

            // Safety auto-stop after 30s
            micAutoStopTimer = setTimeout(() => {
                if (micStream && cakeState === 0) {
                    stopMic();
                    micBtn.textContent = '🎤 Tap to try again';
                    micBtn.disabled = false;
                }
            }, 30000);

        } catch (err) {
            console.error('Mic error:', err);
            micBtn.textContent = '❌ Mic blocked — tap candles instead';
            micBtn.disabled = false;
        }
    }

    function stopMic() {
        if (micCheckRAF) cancelAnimationFrame(micCheckRAF);
        if (micAutoStopTimer) clearTimeout(micAutoStopTimer);
        if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
        micBtn.classList.remove('listening');
        micBtn.disabled = true;
        if (micLevel) micLevel.style.width = '0%';
    }

    // ============ STEP 5: Gallery ============
    const reasons = [
        { src: 'photos/photo1.jpg', emoji: '😊', text: 'Your smile lights up every room' },
        { src: 'photos/photo2.jpg', emoji: '😂', text: 'Your laugh is my favorite sound' },
        { src: 'photos/photo3.jpg', emoji: '💕', text: 'Your kindness touches everyone' },
        { src: 'photos/photo4.jpg', emoji: '💪', text: 'Your strength inspires me' },
        { src: 'photos/photo5.jpg', emoji: '✨', text: 'Just being you is enough' },
    ];
    function populateGallery() {
        if (gallery.children.length > 0) return;
        reasons.forEach((r, i) => {
            const card = document.createElement('div');
            card.className = 'polaroid';
            const rotation = (Math.random() * 10 - 5).toFixed(1);
            card.style.transform = `rotate(${rotation}deg)`;
            card.style.animationDelay = `${i * 0.1}s`;
            card.innerHTML = `
                <div class="polaroid-photo">
                    <img src="${r.src}" alt="" onerror="this.style.display='none'; this.parentElement.querySelector('.polaroid-emoji').style.display='block';">
                    <span class="polaroid-emoji" style="display:none">${r.emoji}</span>
                </div>
                <div class="polaroid-caption">${r.text}</div>
            `;
            card.addEventListener('click', () => {
                if (card.classList.contains('revealed')) return;
                card.classList.add('revealed');
                initAudio(); Sound.pop();
                galleryRevealed++;
                if (galleryRevealed === reasons.length) galleryContinue.classList.add('show');
            });
            gallery.appendChild(card);
        });
    }
    galleryContinue.addEventListener('click', () => {
        goToStep('step6');
        setTimeout(startLetter, 800);
    });

    // ============ STEP 6: Letter ============
    const letterContent = `Dua,

Some people walk into your life and quietly make everything warmer. You are one of them.

This little story was built to remind you how much you matter — not just today, but every single day.

May this year bring you the kind of joy you so freely give to others. May your dreams grow wings, and may every wish you whisper find its way to the stars.

You deserve the world, and today, the world gets to celebrate YOU.

— Someone who cares 🌹`;

    function startLetter() {
        if (letterStarted) return; letterStarted = true;
        initAudio(); Sound.letter();
        let i = 0;
        const type = () => {
            if (i < letterContent.length) {
                const ch = letterContent.charAt(i);
                if (ch === '\n') letterText.innerHTML += '<br>';
                else letterText.textContent += ch;
                i++;
                setTimeout(type, ch === '\n' ? 200 : 30);
            } else {
                letterContinue.classList.add('show');
            }
        };
        setTimeout(type, 800);
    }
    letterContinue.addEventListener('click', () => {
        goToStep('step7');
        setTimeout(startFinale, 400);
    });

    // ============ STEP 7: Finale ============
    function startFinale() {
        initAudio();
        spawnTwinklingStars();
        fireConfetti(window.innerWidth * 0.1, window.innerHeight, 1);
        fireConfetti(window.innerWidth * 0.9, window.innerHeight, -1);
        setTimeout(firework, 500);
        setTimeout(firework, 1400);
        setTimeout(firework, 2300);
        setTimeout(firework, 3200);
        for (let i = 0; i < 5; i++) setTimeout(spawnLantern, i * 600);
        setInterval(() => { if (steps.step7.classList.contains('active')) spawnPetal(); }, 350);
        checkVoiceAvailable();
    }

    function checkVoiceAvailable() {
        voice.addEventListener('loadedmetadata', () => {
            if (voice.duration > 0.5) voiceBtn.style.display = 'inline-block';
        });
        voice.addEventListener('error', () => { voiceBtn.style.display = 'none'; });
        setTimeout(() => {
            if (voice.readyState >= 1 && voice.duration > 0.5) {
                voiceBtn.style.display = 'inline-block';
            }
        }, 1500);
        if (voice.readyState >= 1 && voice.duration > 0.5) voiceBtn.style.display = 'inline-block';
    }

    voiceBtn.addEventListener('click', () => {
        if (voice.paused) {
            voice.volume = 0.9;
            voice.play().then(() => {
                voiceBtn.textContent = '🔊 Playing...';
                voiceBtn.classList.add('playing');
            }).catch(() => {
                voiceBtn.textContent = '❌ Voice not available';
                voiceBtn.disabled = true;
            });
        } else {
            voice.pause();
            voiceBtn.textContent = '💌 Play my voice message';
            voiceBtn.classList.remove('playing');
        }
    });
    voice.addEventListener('ended', () => {
        voiceBtn.textContent = '💌 Play my voice message';
        voiceBtn.classList.remove('playing');
    });

    function spawnTwinklingStars() {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < 40; i++) {
            const s = document.createElement('div');
            s.className = 'twinkle-star';
            s.textContent = '✦';
            s.style.left = (Math.random() * 100) + 'vw';
            s.style.top = (Math.random() * 100) + 'vh';
            s.style.fontSize = (Math.random() * 8 + 6) + 'px';
            s.style.animationDelay = (Math.random() * 3) + 's';
            s.style.animationDuration = (Math.random() * 2 + 1.5) + 's';
            fragment.appendChild(s);
        }
        document.body.appendChild(fragment);
    }

    function spawnLantern() {
        const l = document.createElement('div');
        l.className = 'lantern';
        l.style.left = (Math.random() * 80 + 10) + 'vw';
        const dur = Math.random() * 4 + 8;
        l.style.animationDuration = dur + 's';
        lanternLayer.appendChild(l);
        setTimeout(() => l.remove(), dur * 1000 + 500);
    }

    // ============ Effects ============
    function spawnPetal() {
        const p = document.createElement('div');
        p.className = 'falling-petal';
        p.textContent = ['🌹','❤️','🌺','💖','🌸','💕'][Math.floor(Math.random() * 6)];
        p.style.left = (Math.random() * 100) + 'vw';
        p.style.fontSize = (Math.random() * 14 + 20) + 'px';
        document.body.appendChild(p);
        const dur = Math.random() * 3000 + 4000;
        const drift = (Math.random() - 0.5) * 180;
        const rot = Math.random() * 720 - 360;
        p.animate([
            { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${drift}px, 105vh) rotate(${rot}deg)`, opacity: 0.5 }
        ], { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => p.remove();
    }
    function fireConfetti(startX, startY, dir) {
        const colors = ['#f43f5e','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899','#fff'];
        for (let i = 0; i < 80; i++) {
            const c = document.createElement('div');
            c.className = 'confetti-piece';
            const size = Math.random() * 10 + 5;
            c.style.width = size + 'px';
            c.style.height = size * (Math.random() > 0.5 ? 1 : 2) + 'px';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            c.style.left = startX + 'px';
            c.style.top = startY + 'px';
            document.body.appendChild(c);
            const ang = (Math.random() * 45 + 45) * Math.PI / 180;
            const v = Math.random() * 1200 + 700;
            const endX = Math.cos(ang) * v * dir;
            const endY = -Math.sin(ang) * v + 700;
            const rot = Math.random() * 1080 - 540;
            c.animate([
                { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
                { transform: `translate(${endX}px, ${endY}px) rotate(${rot}deg)`, opacity: 0 }
            ], { duration: Math.random() * 1500 + 1800, easing: 'cubic-bezier(0.25,1,0.4,1)', fill: 'forwards' })
            .onfinish = () => c.remove();
        }
    }
    function firework() {
        initAudio(); Sound.firework();
        const x = Math.random() * window.innerWidth * 0.7 + window.innerWidth * 0.15;
        const y = Math.random() * window.innerHeight * 0.35 + window.innerHeight * 0.1;
        const colors = ['#f43f5e','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899','#fff'];
        for (let i = 0; i < 55; i++) {
            const c = document.createElement('div');
            c.className = 'confetti-piece';
            const size = Math.random() * 7 + 4;
            c.style.width = size + 'px';
            c.style.height = size + 'px';
            c.style.borderRadius = '50%';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            c.style.left = x + 'px';
            c.style.top = y + 'px';
            c.style.boxShadow = `0 0 8px ${c.style.background}`;
            document.body.appendChild(c);
            const a = Math.random() * Math.PI * 2;
            const v = Math.random() * 250 + 120;
            const endX = Math.cos(a) * v;
            const endY = Math.sin(a) * v + 350;
            c.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${endX}px, ${endY}px) scale(0.4)`, opacity: 0 }
            ], { duration: Math.random() * 1000 + 1200, easing: 'cubic-bezier(0.2,0.8,0.4,1)', fill: 'forwards' })
            .onfinish = () => c.remove();
        }
    }

    // ============ Ambient Balloons ============
    const balloonColors = ['#f43f5e','#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899'];
    function spawnBalloon() {
        const b = document.createElement('div');
        b.className = 'rising-balloon';
        b.style.background = balloonColors[Math.floor(Math.random() * balloonColors.length)];
        b.style.left = (Math.random() * 90 + 5) + '%';
        const size = Math.random() * 20 + 28;
        b.style.width = size + 'px';
        b.style.height = (size * 1.25) + 'px';
        const dur = Math.random() * 8 + 10;
        b.style.animationDuration = dur + 's';
        balloonLayer.appendChild(b);
        setTimeout(() => b.remove(), dur * 1000 + 300);
    }
    for (let i = 0; i < 6; i++) setTimeout(spawnBalloon, i * 400);
    setInterval(spawnBalloon, 1500);

    // ============ Sparkle Cursor ============
    let lastSparkle = 0;
    function spawnSparkle(x, y) {
        const now = Date.now();
        if (now - lastSparkle < 50) return;
        lastSparkle = now;
        const s = document.createElement('div');
        s.className = 'sparkle';
        s.textContent = ['✨','⭐','💫','✦','🌟'][Math.floor(Math.random() * 5)];
        s.style.left = x + 'px';
        s.style.top = y + 'px';
        s.style.fontSize = (Math.random() * 8 + 12) + 'px';
        document.body.appendChild(s);
        setTimeout(() => s.remove(), 750);
    }
    document.addEventListener('mousemove', e => spawnSparkle(e.clientX, e.clientY));
    document.addEventListener('touchmove', e => {
        const t = e.touches[0]; if (t) spawnSparkle(t.clientX, t.clientY);
    }, { passive: true });

    // ============ Particle Background ============
    const bgEl = document.querySelector('.background-container');
    for (let i = 0; i < 50; i++) {
        const p = document.createElement('div');
        p.style.position = 'absolute';
        p.style.width = p.style.height = `${Math.random() * 5 + 2}px`;
        p.style.borderRadius = '50%';
        p.style.backgroundColor = 'rgba(255,255,255,0.5)';
        p.style.left = `${Math.random() * 100}vw`;
        p.style.top = `${Math.random() * 100}vh`;
        p.style.pointerEvents = 'none';
        p.style.animation = `float ${Math.random() * 20 + 10}s linear infinite`;
        bgEl.appendChild(p);
    }
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `@keyframes float {
        0% { transform: translateY(0) translateX(0); opacity: 0.7; }
        50% { transform: translateY(-20px) translateX(20px); opacity: 0.3; }
        100% { transform: translateY(0) translateX(0); opacity: 0.7; }
    }`;
    document.head.appendChild(styleSheet);
});