/**
 * VINTUS PERFORMANCE
 * Video Showcase — Cinematic Tab Carousel
 * ====================================
 * Lazy loads videos, auto-advances with progress bar,
 * supports swipe navigation and hover pause.
 */
(function() {
    'use strict';

    var showcase = document.getElementById('videoShowcase');
    if (!showcase) return;

    var panels = showcase.querySelectorAll('.video-panel');
    var tabs = showcase.querySelectorAll('.showcase-tab');
    var videos = showcase.querySelectorAll('.showcase-video');
    var stage = showcase.querySelector('.video-showcase-stage');

    var currentIndex = 0;
    var autoAdvanceTimer = null;
    var ADVANCE_DURATION = 8000;
    var isVisible = false;
    var videosLoaded = [];

    for (var i = 0; i < panels.length; i++) {
        videosLoaded.push(false);
    }

    // --- Lazy load video source ---
    function loadVideo(index) {
        if (videosLoaded[index]) return;
        var video = videos[index];
        var source = video.querySelector('source[data-src]');
        if (source && source.dataset.src) {
            source.src = source.dataset.src;
            source.removeAttribute('data-src');
            video.load();
            videosLoaded[index] = true;
        }
    }

    // --- Switch to a panel ---
    function goToPanel(index) {
        if (index === currentIndex && panels[index].classList.contains('active')) return;

        // Pause current video
        videos[currentIndex].pause();

        // Remove active states
        panels[currentIndex].classList.remove('active');
        tabs[currentIndex].classList.remove('active');

        // Reset old progress bar
        var oldBar = tabs[currentIndex].querySelector('.tab-progress-bar');
        if (oldBar) {
            oldBar.style.transition = 'none';
            oldBar.style.width = '0%';
        }

        // Update index
        currentIndex = index;

        // Load + activate new panel
        loadVideo(currentIndex);
        panels[currentIndex].classList.add('active');
        tabs[currentIndex].classList.add('active');

        // Play new video from start
        var newVideo = videos[currentIndex];
        newVideo.currentTime = 0;
        var playPromise = newVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(function() {
                // Autoplay blocked — poster image shown as fallback
            });
        }

        // Restart auto-advance
        if (isVisible) startAutoAdvance();
    }

    // --- Auto-advance with progress bar ---
    function startAutoAdvance() {
        stopAutoAdvance();

        var activeBar = tabs[currentIndex].querySelector('.tab-progress-bar');
        if (activeBar) {
            // Reset bar
            activeBar.style.transition = 'none';
            activeBar.style.width = '0%';
            // Force reflow
            void activeBar.offsetHeight;
            // Animate to full
            activeBar.style.transition = 'width ' + ADVANCE_DURATION + 'ms linear';
            activeBar.style.width = '100%';
        }

        autoAdvanceTimer = setTimeout(function() {
            goToPanel((currentIndex + 1) % panels.length);
        }, ADVANCE_DURATION);
    }

    function stopAutoAdvance() {
        if (autoAdvanceTimer) {
            clearTimeout(autoAdvanceTimer);
            autoAdvanceTimer = null;
        }
    }

    // --- Tab click handlers ---
    for (var t = 0; t < tabs.length; t++) {
        (function(tab) {
            tab.addEventListener('click', function() {
                var index = parseInt(this.dataset.index, 10);
                goToPanel(index);
            });
        })(tabs[t]);
    }

    // --- Swipe support on stage ---
    if (stage) {
        var touchStartX = 0;

        stage.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        stage.addEventListener('touchend', function(e) {
            var diff = touchStartX - e.changedTouches[0].screenX;
            if (Math.abs(diff) > 50) {
                if (diff > 0) {
                    // Swiped left → next
                    goToPanel((currentIndex + 1) % panels.length);
                } else {
                    // Swiped right → previous
                    goToPanel((currentIndex - 1 + panels.length) % panels.length);
                }
            }
        }, { passive: true });
    }

    // --- Intersection Observer (lazy load + play/pause) ---
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    isVisible = true;
                    loadVideo(currentIndex);
                    var playPromise = videos[currentIndex].play();
                    if (playPromise !== undefined) {
                        playPromise.catch(function() {});
                    }
                    startAutoAdvance();
                } else {
                    isVisible = false;
                    videos[currentIndex].pause();
                    stopAutoAdvance();
                }
            });
        }, { threshold: 0.3 });

        observer.observe(showcase);
    } else {
        // Fallback: load first video immediately
        isVisible = true;
        loadVideo(0);
        videos[0].play();
        startAutoAdvance();
    }

    // --- Pause auto-advance on hover (desktop) ---
    if (stage) {
        stage.addEventListener('mouseenter', function() {
            stopAutoAdvance();
        });
        stage.addEventListener('mouseleave', function() {
            if (isVisible) startAutoAdvance();
        });
    }
})();
