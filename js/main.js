/**
 * VINTUS PERFORMANCE
 * Main JavaScript File
 * ====================================
 * Handles: Navigation, Animations, Mobile Menu, Form Handling
 */

// ====================================
// Utility Functions (must be defined before IIFE)
// ====================================

/**
 * Debounce function for performance optimization
 */
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction() {
        const context = this;
        const args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

/**
 * Throttle function for scroll events
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

(function() {
    'use strict';

    // ====================================
    // DOM Elements
    // ====================================
    const nav = document.querySelector('nav');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileNav = document.getElementById('mobileNav');
    const revealElements = document.querySelectorAll('.reveal');
    const preloader = document.getElementById('preloader');

    // ====================================
    // Preloader
    // ====================================
    function hidePreloader() {
        if (preloader) {
            setTimeout(() => {
                preloader.classList.add('loaded');
                document.body.style.overflow = '';
            }, 1800); // Match the CSS animation duration
        }
    }

    // Hide preloader when page is fully loaded
    window.addEventListener('load', hidePreloader);

    // Fallback - hide preloader after max 3 seconds
    setTimeout(() => {
        if (preloader && !preloader.classList.contains('loaded')) {
            preloader.classList.add('loaded');
        }
    }, 3000);

    // ====================================
    // Hero Carousel
    // ====================================
    const heroCarousel = document.getElementById('heroCarousel');

    if (heroCarousel) {
        const slides = heroCarousel.querySelectorAll('.carousel-slide');
        const dots = heroCarousel.querySelectorAll('.carousel-dot');
        const prevBtn = heroCarousel.querySelector('.carousel-prev');
        const nextBtn = heroCarousel.querySelector('.carousel-next');
        const progressBar = heroCarousel.querySelector('.carousel-progress-bar');

        let currentSlide = 0;
        let slideInterval;
        let progressInterval;
        const slideDelay = 6000; // 6 seconds per slide
        const progressStep = 50; // Update progress every 50ms

        function goToSlide(index) {
            // Remove active from all slides and dots
            slides.forEach(slide => slide.classList.remove('active'));
            dots.forEach(dot => dot.classList.remove('active'));

            // Set new active
            currentSlide = index;
            if (currentSlide >= slides.length) currentSlide = 0;
            if (currentSlide < 0) currentSlide = slides.length - 1;

            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');

            // Reset progress
            resetProgress();
        }

        function nextSlide() {
            goToSlide(currentSlide + 1);
        }

        function prevSlide() {
            goToSlide(currentSlide - 1);
        }

        function resetProgress() {
            if (progressBar) {
                progressBar.style.transition = 'none';
                progressBar.style.width = '0%';

                // Force reflow
                progressBar.offsetHeight;

                progressBar.style.transition = `width ${slideDelay}ms linear`;
                progressBar.style.width = '100%';
            }
        }

        function startAutoplay() {
            stopAutoplay();
            resetProgress();
            slideInterval = setInterval(nextSlide, slideDelay);
        }

        function stopAutoplay() {
            if (slideInterval) {
                clearInterval(slideInterval);
            }
        }

        // Event listeners
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                prevSlide();
                startAutoplay();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                nextSlide();
                startAutoplay();
            });
        }

        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                goToSlide(index);
                startAutoplay();
            });
        });

        // Pause on hover (optional - can remove if not desired)
        heroCarousel.addEventListener('mouseenter', stopAutoplay);
        heroCarousel.addEventListener('mouseleave', startAutoplay);

        // Touch/swipe support
        let touchStartX = 0;
        let touchEndX = 0;

        heroCarousel.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        heroCarousel.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    nextSlide();
                } else {
                    prevSlide();
                }
                startAutoplay();
            }
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                prevSlide();
                startAutoplay();
            } else if (e.key === 'ArrowRight') {
                nextSlide();
                startAutoplay();
            }
        });

        // Start autoplay
        startAutoplay();
    }

    // ====================================
    // Navigation Scroll Effect
    // ====================================
    function handleNavScroll() {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll);
    // Run on load in case page is already scrolled
    handleNavScroll();

    // ====================================
    // Mobile Menu Toggle
    // ====================================
    if (mobileMenu && mobileNav) {
        mobileMenu.addEventListener('click', function() {
            mobileMenu.classList.toggle('active');
            mobileNav.classList.toggle('active');
            document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
        });

        // Close mobile nav when clicking a link
        mobileNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.style.overflow = '';
            });
        });

        // Close mobile nav on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
                mobileMenu.classList.remove('active');
                mobileNav.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    // ====================================
    // Reveal on Scroll Animation
    // ====================================
    function revealOnScroll() {
        const windowHeight = window.innerHeight;
        const revealPoint = 100;

        revealElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;

            if (elementTop < windowHeight - revealPoint) {
                element.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', revealOnScroll);
    window.addEventListener('load', revealOnScroll);
    // Initial check
    revealOnScroll();

    // ====================================
    // Smooth Scroll for Anchor Links
    // ====================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Don't process if it's just "#" or if target doesn't exist
            if (href === '#') return;

            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();

                // Account for fixed nav height
                const navHeight = nav ? nav.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ====================================
    // Form Handling (Contact Form)
    // ====================================
    const contactForm = document.getElementById('contactForm');

    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();

            // Get form data
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            // Basic validation
            if (!data.firstName || !data.lastName || !data.email || !data.interest) {
                showNotification('Please fill in all required fields.', 'error');
                return;
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                showNotification('Please enter a valid email address.', 'error');
                return;
            }

            // Show loading state
            const submitBtn = contactForm.querySelector('.form-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = 'Sending...';
            submitBtn.disabled = true;

            // Simulate form submission (replace with actual form handling)
            setTimeout(() => {
                // Reset form
                contactForm.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;

                // Show success message
                showNotification('Message sent successfully! We\'ll be in touch within 24 hours.', 'success');

                // Log form data (for development - remove in production)
                console.log('Form submitted:', data);
            }, 1500);
        });
    }

    // ====================================
    // Hero Quiz System
    // ====================================
    const heroQuizForm = document.getElementById('heroQuizForm');
    const heroQuizBack = document.getElementById('heroQuizBack');
    const heroQuizProgress = document.getElementById('heroQuizProgress');
    const heroQuizResults = document.getElementById('heroQuizResults');
    const heroAiContent = document.getElementById('heroAiContent');

    if (heroQuizForm) {
        const quizState = {
            currentStep: 1,
            totalSteps: 5,
            answers: {
                primary_goal: '',
                primary_goal_other: '',
                training_days: '',
                experience: '',
                challenge: '',
                first_name: '',
                last_name: '',
                email: '',
                phone: ''
            }
        };

        const quizSteps = heroQuizForm.querySelectorAll('.hero-quiz-step');
        const quizOptions = heroQuizForm.querySelectorAll('.hero-quiz-option');
        const goalOtherInput = document.getElementById('goalOtherInput');
        const goalOtherText = document.getElementById('goalOtherText');

        // Update progress bar
        function updateQuizProgress() {
            const progress = ((quizState.currentStep - 1) / (quizState.totalSteps - 1)) * 100;
            if (heroQuizProgress) {
                heroQuizProgress.style.width = `${progress}%`;
            }

            // Show/hide back button
            if (heroQuizBack) {
                heroQuizBack.style.display = quizState.currentStep > 1 ? 'flex' : 'none';
            }
        }

        // Go to next step
        function goToNextStep() {
            if (quizState.currentStep >= quizState.totalSteps) return;

            const currentStepEl = heroQuizForm.querySelector(`.hero-quiz-step[data-step="${quizState.currentStep}"]`);
            const nextStepEl = heroQuizForm.querySelector(`.hero-quiz-step[data-step="${quizState.currentStep + 1}"]`);

            if (currentStepEl && nextStepEl) {
                currentStepEl.classList.remove('active');
                quizState.currentStep++;
                nextStepEl.classList.add('active');
                updateQuizProgress();
            }
        }

        // Go to previous step
        function goToPrevStep() {
            if (quizState.currentStep <= 1) return;

            const currentStepEl = heroQuizForm.querySelector(`.hero-quiz-step[data-step="${quizState.currentStep}"]`);
            const prevStepEl = heroQuizForm.querySelector(`.hero-quiz-step[data-step="${quizState.currentStep - 1}"]`);

            if (currentStepEl && prevStepEl) {
                currentStepEl.classList.remove('active');
                quizState.currentStep--;
                prevStepEl.classList.add('active');
                updateQuizProgress();
            }
        }

        // Handle option click
        quizOptions.forEach(option => {
            option.addEventListener('click', function() {
                const step = this.closest('.hero-quiz-step');
                const stepNum = parseInt(step.dataset.step);
                const value = this.dataset.value;

                // Remove selection from siblings
                step.querySelectorAll('.hero-quiz-option').forEach(opt => opt.classList.remove('selected'));

                // Select this option
                this.classList.add('selected');

                // Store value based on step
                switch (stepNum) {
                    case 1:
                        quizState.answers.primary_goal = value;
                        // Show/hide "Other" input
                        if (value === 'other' && goalOtherInput) {
                            goalOtherInput.style.display = 'block';
                            goalOtherText.focus();
                            return; // Don't auto-advance for "Other"
                        } else if (goalOtherInput) {
                            goalOtherInput.style.display = 'none';
                        }
                        break;
                    case 2:
                        quizState.answers.training_days = value;
                        break;
                    case 3:
                        quizState.answers.experience = value;
                        break;
                    case 4:
                        quizState.answers.challenge = value;
                        break;
                }

                // Auto-advance after short delay
                setTimeout(() => {
                    goToNextStep();
                }, 300);
            });
        });

        // Handle "Other" text input - advance when user presses Enter or clicks away
        if (goalOtherText) {
            goalOtherText.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    quizState.answers.primary_goal_other = this.value;
                    goToNextStep();
                }
            });

            goalOtherText.addEventListener('blur', function() {
                if (this.value.trim() && quizState.answers.primary_goal === 'other') {
                    quizState.answers.primary_goal_other = this.value;
                    // Only auto-advance if they've typed something
                    if (this.value.trim().length > 2) {
                        setTimeout(() => goToNextStep(), 200);
                    }
                }
            });
        }

        // Back button
        if (heroQuizBack) {
            heroQuizBack.addEventListener('click', goToPrevStep);
        }

        // Form submission
        heroQuizForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Get contact info
            quizState.answers.first_name = document.getElementById('heroFirstName').value;
            quizState.answers.last_name = document.getElementById('heroLastName').value;
            quizState.answers.email = document.getElementById('heroEmail').value;
            quizState.answers.phone = document.getElementById('heroPhone').value;

            // Validation
            if (!quizState.answers.first_name || !quizState.answers.email || !quizState.answers.phone) {
                showNotification('Please fill in all required fields.', 'error');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(quizState.answers.email)) {
                showNotification('Please enter a valid email address.', 'error');
                return;
            }

            // Show loading state
            const submitBtn = heroQuizForm.querySelector('.hero-quiz-submit');
            const submitText = submitBtn.querySelector('.submit-text');
            const submitLoading = submitBtn.querySelector('.submit-loading');
            const submitArrow = submitBtn.querySelector('.submit-arrow');

            submitText.style.display = 'none';
            submitArrow.style.display = 'none';
            submitLoading.style.display = 'inline-flex';
            submitBtn.disabled = true;

            try {
                // Submit to API
                await fetch('/api/submit-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...quizState.answers,
                        timestamp: new Date().toISOString(),
                        source: 'hero-quiz'
                    })
                });
            } catch (error) {
                console.error('Form submission error:', error);
                // Continue to show results regardless
            }

            // Generate AI summary and show results
            generateHeroAISummary();
            showQuizResults();

            // Reset button state
            submitText.style.display = 'inline';
            submitArrow.style.display = 'inline';
            submitLoading.style.display = 'none';
            submitBtn.disabled = false;
        });

        // Generate AI Summary
        function generateHeroAISummary() {
            const { primary_goal, primary_goal_other, training_days, experience, challenge, first_name } = quizState.answers;

            // Goal mapping
            const goalMap = {
                'build-muscle': 'build lean muscle',
                'lose-fat': 'lose body fat',
                'endurance': 'improve endurance and conditioning',
                'well-rounded': 'become well-rounded with both strength and performance',
                'other': primary_goal_other || 'achieve your fitness goals'
            };

            // Experience mapping
            const experienceMap = {
                'beginner': 'beginner',
                'intermediate': 'intermediate',
                'advanced': 'advanced'
            };

            // Training focus based on experience
            const trainingFocusMap = {
                'beginner': 'building a strong foundation with proper form and consistency',
                'intermediate': 'progressive overload and breaking through plateaus',
                'advanced': 'periodized programming to optimize peak performance'
            };

            // Challenge mapping
            const challengeMap = {
                'structure': 'lack of structure and accountability',
                'no-results': 'not seeing results despite your effort',
                'energy': 'inconsistent energy and recovery',
                'unsure': 'uncertainty about how to train and fuel properly'
            };

            // Days mapping
            const daysMap = {
                '2-3': '2-3 days per week',
                '4-5': '4-5 days per week',
                '6+': '6+ days per week'
            };

            // Generate personalized content
            const goalText = goalMap[primary_goal] || goalMap['other'];
            const expText = experienceMap[experience] || 'intermediate';
            const focusText = trainingFocusMap[experience] || trainingFocusMap['intermediate'];
            const challengeText = challengeMap[challenge] || 'overcoming obstacles';
            const daysText = daysMap[training_days] || '4-5 days per week';

            const html = `
                <p>Based on your goal to <strong>${goalText}</strong>, your ability to train <strong>${daysText}</strong>, and your <strong>${expText}</strong> experience level, your ideal regimen focuses on ${focusText}.</p>

                <p>Your biggest limiter right now isn't effort—it's <strong>${challengeText}</strong>. This is exactly what we address in our coaching methodology. With the right structure, you'll see results faster than you thought possible.</p>

                <p>Your custom program will include:</p>
                <ul style="margin: 1rem 0; padding-left: 1.5rem;">
                    <li>Personalized workout splits optimized for your ${daysText} schedule</li>
                    <li>Progressive programming designed for ${expText} athletes</li>
                    <li>Accountability systems to eliminate ${challengeText.replace('lack of ', '').replace('uncertainty about ', '')}</li>
                    <li>Nutrition guidance aligned with your goal to ${goalText}</li>
                </ul>
            `;

            if (heroAiContent) {
                heroAiContent.innerHTML = html;
            }

            // Update name in results header
            const resultName = document.getElementById('resultName');
            if (resultName && first_name) {
                resultName.textContent = first_name;
            }
        }

        // Show quiz results
        function showQuizResults() {
            // Hide form
            heroQuizForm.style.display = 'none';
            if (heroQuizBack) heroQuizBack.style.display = 'none';

            // Show results
            if (heroQuizResults) {
                heroQuizResults.style.display = 'block';
            }

            // Update progress to 100%
            if (heroQuizProgress) {
                heroQuizProgress.style.width = '100%';
            }

            // Hide carousel navigation buttons
            const carouselNav = document.querySelector('.carousel-nav');
            const carouselDots = document.querySelector('.carousel-dots');
            const carouselProgress = document.querySelector('.carousel-progress');
            if (carouselNav) carouselNav.style.display = 'none';
            if (carouselDots) carouselDots.style.display = 'none';
            if (carouselProgress) carouselProgress.style.display = 'none';
        }

        // Initialize progress
        updateQuizProgress();
    }

    // ====================================
    // Notification System
    // ====================================
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#1a1a1a' : '#1a1a1a'};
            border: 1px solid ${type === 'success' ? '#c0c0c0' : '#ff4444'};
            color: ${type === 'success' ? '#c0c0c0' : '#ff4444'};
            font-size: 0.95rem;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 1rem;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        `;

        // Add animation keyframes
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 1.5rem;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                }
                .notification-close:hover {
                    opacity: 1;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => removeNotification(notification));

        // Auto-remove after 5 seconds
        setTimeout(() => removeNotification(notification), 5000);
    }

    function removeNotification(notification) {
        if (notification && notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }

    // ====================================
    // Intersection Observer for Performance
    // ====================================
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        revealElements.forEach(element => {
            observer.observe(element);
        });
    }

    // ====================================
    // Parallax Effect (Optional)
    // ====================================
    const parallaxElements = document.querySelectorAll('[data-parallax]');

    if (parallaxElements.length > 0) {
        window.addEventListener('scroll', () => {
            parallaxElements.forEach(element => {
                const speed = element.dataset.parallax || 0.5;
                const yPos = -(window.pageYOffset * speed);
                element.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    // ====================================
    // Enhanced Reveal Animations
    // ====================================
    const imageRevealElements = document.querySelectorAll('.image-reveal');
    const staggerRevealElements = document.querySelectorAll('.stagger-reveal');
    const textRevealElements = document.querySelectorAll('.text-reveal');

    if ('IntersectionObserver' in window) {
        const revealObserverOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.2
        };

        const enhancedRevealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    enhancedRevealObserver.unobserve(entry.target);
                }
            });
        }, revealObserverOptions);

        imageRevealElements.forEach(el => enhancedRevealObserver.observe(el));
        staggerRevealElements.forEach(el => enhancedRevealObserver.observe(el));
        textRevealElements.forEach(el => enhancedRevealObserver.observe(el));
    }

    // ====================================
    // Parallax Background Effect
    // ====================================
    const parallaxBgs = document.querySelectorAll('.parallax-bg');

    if (parallaxBgs.length > 0 && window.innerWidth > 768) {
        window.addEventListener('scroll', throttle(() => {
            parallaxBgs.forEach(bg => {
                const section = bg.closest('.parallax-section');
                if (section) {
                    const rect = section.getBoundingClientRect();
                    if (rect.top < window.innerHeight && rect.bottom > 0) {
                        const scrolled = window.pageYOffset;
                        const rate = scrolled * 0.3;
                        bg.style.transform = `translateY(${rate}px)`;
                    }
                }
            });
        }, 16));
    }

    // ====================================
    // Counter Animation
    // ====================================
    const counters = document.querySelectorAll('.counter');

    if (counters.length > 0 && 'IntersectionObserver' in window) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const counter = entry.target;
                    const target = parseInt(counter.dataset.target);
                    const duration = 2000;
                    const step = target / (duration / 16);
                    let current = 0;

                    const updateCounter = () => {
                        current += step;
                        if (current < target) {
                            counter.textContent = Math.floor(current);
                            requestAnimationFrame(updateCounter);
                        } else {
                            counter.textContent = target;
                        }
                    };

                    updateCounter();
                    counterObserver.unobserve(counter);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => counterObserver.observe(counter));
    }

    // ====================================
    // Lazy Loading Images (Future Use)
    // ====================================
    const lazyImages = document.querySelectorAll('img[data-src]');

    if (lazyImages.length > 0 && 'IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        lazyImages.forEach(img => imageObserver.observe(img));
    }

    // ====================================
    // Current Year in Footer
    // ====================================
    const yearElements = document.querySelectorAll('[data-year]');
    yearElements.forEach(el => {
        el.textContent = new Date().getFullYear();
    });

    // ====================================
    // Active Nav Link Highlighting
    // ====================================
    function setActiveNavLink() {
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';

        document.querySelectorAll('.nav-links a').forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    setActiveNavLink();

    // ====================================
    // Console Branding
    // ====================================
    console.log('%cVINTUS PERFORMANCE', 'font-size: 24px; font-weight: bold; color: #c0c0c0;');
    console.log('%cDiscipline Within, Dominance Beyond.', 'font-size: 12px; color: #888;');
    console.log('%c-----------------------------------', 'color: #333;');

    // ====================================
    // Parallax Scrolling
    // ====================================
    const parallaxShapes = document.querySelectorAll('.parallax-shape');

    function handleParallax() {
        const scrolled = window.pageYOffset;

        parallaxShapes.forEach(shape => {
            const speed = parseFloat(shape.dataset.speed) || 0.05;
            const yPos = scrolled * speed;
            shape.style.transform = `translateY(${yPos}px)`;
        });
    }

    if (parallaxShapes.length > 0) {
        window.addEventListener('scroll', throttle(handleParallax, 16));
    }

    // ====================================
    // Progress Ring Animations
    // ====================================
    const progressRings = document.querySelectorAll('.progress-ring');

    function animateProgressRings() {
        progressRings.forEach(ring => {
            const rect = ring.getBoundingClientRect();
            const windowHeight = window.innerHeight;

            if (rect.top < windowHeight - 100 && !ring.classList.contains('animated')) {
                ring.classList.add('animated');
                const progress = parseInt(ring.dataset.progress) || 0;
                const circumference = 2 * Math.PI * 45; // r = 45
                const offset = circumference - (progress / 100) * circumference;

                const progressBar = ring.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.style.setProperty('--progress-offset', offset);
                    progressBar.style.strokeDashoffset = offset;
                }
            }
        });
    }

    if (progressRings.length > 0) {
        window.addEventListener('scroll', animateProgressRings);
        animateProgressRings(); // Check on load
    }

    // ====================================
    // Workout Preview Modals
    // ====================================
    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    const modalClose = document.getElementById('modalClose');
    const workoutBtns = document.querySelectorAll('.workout-preview-btn');

    const workoutData = {
        strength: {
            title: 'Strength Training',
            icon: '<path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M4.5 6.5v11M19.5 6.5v11"/>',
            exercises: [
                { name: 'Barbell Squats', sets: '4 x 8-10' },
                { name: 'Romanian Deadlifts', sets: '4 x 10-12' },
                { name: 'Bench Press', sets: '4 x 8-10' },
                { name: 'Bent Over Rows', sets: '4 x 10-12' },
                { name: 'Overhead Press', sets: '3 x 10-12' },
                { name: 'Core Circuit', sets: '3 rounds' }
            ],
            note: 'Sample workout from our Strength Foundation program. All plans are customized to your experience level and goals.'
        },
        hiit: {
            title: 'HIIT Conditioning',
            icon: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
            exercises: [
                { name: 'Battle Ropes', sets: '30s on / 15s off' },
                { name: 'Box Jumps', sets: '30s on / 15s off' },
                { name: 'Kettlebell Swings', sets: '30s on / 15s off' },
                { name: 'Burpees', sets: '30s on / 15s off' },
                { name: 'Mountain Climbers', sets: '30s on / 15s off' },
                { name: 'Sprint Intervals', sets: '30s on / 15s off' }
            ],
            note: '4-5 rounds with 2 min rest between rounds. Intensity scales to your fitness level.'
        },
        endurance: {
            title: 'Endurance Training',
            icon: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
            exercises: [
                { name: 'Zone 2 Run/Bike', sets: '30-45 min' },
                { name: 'Tempo Intervals', sets: '5 x 5 min' },
                { name: 'Steady State Cardio', sets: '20-30 min' },
                { name: 'Active Recovery', sets: '15 min' },
                { name: 'Mobility Work', sets: '10 min' },
                { name: 'Cool Down Stretch', sets: '5-10 min' }
            ],
            note: 'Based on triathlon training principles. Heart rate zones are personalized to your fitness assessment.'
        }
    };

    function openModal(workoutType) {
        const data = workoutData[workoutType];
        if (!data || !modalContent) return;

        const exercisesList = data.exercises.map(ex =>
            `<li><span class="exercise">${ex.name}</span><span class="sets">${ex.sets}</span></li>`
        ).join('');

        modalContent.innerHTML = `
            <div class="modal-header">
                <div class="modal-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${data.icon}
                    </svg>
                </div>
                <h3>${data.title}</h3>
            </div>
            <ul class="modal-workout-list">
                ${exercisesList}
            </ul>
            <div class="modal-note">${data.note}</div>
            <a href="contact.html" class="btn-primary" style="width: 100%; justify-content: center;">Start Your Plan</a>
        `;

        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    workoutBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const workoutType = btn.dataset.modal;
            openModal(workoutType);
        });
    });

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    // ====================================
    // BMI Calculator
    // ====================================
    const bmiCalculator = document.getElementById('bmiCalculator');
    const bmiResult = document.getElementById('bmiResult');
    const calcToggleBtns = document.querySelectorAll('.calc-toggle-btn');
    const imperialInputs = document.querySelectorAll('.imperial-input');
    const metricInputs = document.querySelectorAll('.metric-input');

    let currentUnit = 'imperial';

    // Toggle between imperial and metric
    calcToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            calcToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentUnit = btn.dataset.unit;

            if (currentUnit === 'imperial') {
                imperialInputs.forEach(el => el.style.display = 'flex');
                metricInputs.forEach(el => el.style.display = 'none');
            } else {
                imperialInputs.forEach(el => el.style.display = 'none');
                metricInputs.forEach(el => el.style.display = 'flex');
            }

            // Hide result when switching units
            if (bmiResult) bmiResult.style.display = 'none';
        });
    });

    if (bmiCalculator) {
        bmiCalculator.addEventListener('submit', (e) => {
            e.preventDefault();

            let heightInMeters, weightInKg;

            if (currentUnit === 'imperial') {
                const feet = parseFloat(document.getElementById('heightFt').value) || 0;
                const inches = parseFloat(document.getElementById('heightIn').value) || 0;
                const lbs = parseFloat(document.getElementById('weightLbs').value) || 0;

                if (feet === 0 || lbs === 0) {
                    alert('Please enter valid height and weight');
                    return;
                }

                const totalInches = (feet * 12) + inches;
                heightInMeters = totalInches * 0.0254;
                weightInKg = lbs * 0.453592;
            } else {
                const cm = parseFloat(document.getElementById('heightCm').value) || 0;
                const kg = parseFloat(document.getElementById('weightKg').value) || 0;

                if (cm === 0 || kg === 0) {
                    alert('Please enter valid height and weight');
                    return;
                }

                heightInMeters = cm / 100;
                weightInKg = kg;
            }

            // Calculate BMI
            const bmi = weightInKg / (heightInMeters * heightInMeters);
            const bmiRounded = Math.round(bmi * 10) / 10;

            // Determine category
            let category, indicatorPosition;
            if (bmi < 18.5) {
                category = 'Underweight';
                indicatorPosition = (bmi / 18.5) * 25;
            } else if (bmi < 25) {
                category = 'Normal Weight';
                indicatorPosition = 25 + ((bmi - 18.5) / 6.5) * 25;
            } else if (bmi < 30) {
                category = 'Overweight';
                indicatorPosition = 50 + ((bmi - 25) / 5) * 25;
            } else {
                category = 'Obese';
                indicatorPosition = Math.min(75 + ((bmi - 30) / 10) * 25, 100);
            }

            // Display result
            document.getElementById('bmiValue').textContent = bmiRounded;
            document.getElementById('bmiCategory').textContent = category;
            document.getElementById('bmiIndicator').style.left = `${indicatorPosition}%`;

            bmiResult.style.display = 'block';
        });
    }

})();
