/**
 * VINTUS PERFORMANCE
 * Main JavaScript File
 * ====================================
 * Handles: Navigation, Animations, Mobile Menu, Form Handling
 */

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

// ====================================
// Utility Functions (Global Scope)
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
