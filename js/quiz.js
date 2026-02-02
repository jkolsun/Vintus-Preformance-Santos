/* =====================================================
   VINTUS PERFORMANCE - Quiz/Lead Capture JavaScript
   ===================================================== */

(function() {
    'use strict';

    // Quiz State
    const state = {
        currentStep: 1,
        totalSteps: 5,
        answers: {
            primary_goal: '',
            training_days: '',
            experience: '',
            challenge: '',
            first_name: '',
            last_name: '',
            email: '',
            phone: ''
        }
    };

    // DOM Elements
    const elements = {
        form: document.getElementById('quizForm'),
        progressBar: document.getElementById('progressBar'),
        steps: document.querySelectorAll('.quiz-step'),
        slides: document.querySelectorAll('.quiz-slide'),
        options: document.querySelectorAll('.quiz-option'),
        backButton: document.getElementById('quizBack'),
        submitButton: document.getElementById('quizSubmit'),
        results: document.getElementById('quizResults'),
        aiContent: document.getElementById('aiContent')
    };

    // Initialize Quiz
    function init() {
        setupEventListeners();
        updateProgress();
    }

    // Event Listeners
    function setupEventListeners() {
        // Option button clicks
        elements.options.forEach(option => {
            option.addEventListener('click', handleOptionClick);
        });

        // Back button
        elements.backButton.addEventListener('click', goBack);

        // Form submission
        elements.form.addEventListener('submit', handleSubmit);

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyDown);
    }

    // Handle option selection
    function handleOptionClick(e) {
        const option = e.currentTarget;
        const slide = option.closest('.quiz-slide');
        const slideOptions = slide.querySelectorAll('.quiz-option');
        const value = option.dataset.value;
        const input = slide.querySelector('input[type="hidden"]');

        // Remove selection from other options in this slide
        slideOptions.forEach(opt => opt.classList.remove('selected'));

        // Select this option
        option.classList.add('selected');

        // Store value
        if (input) {
            input.value = value;
            state.answers[input.name] = value;
        }

        // Auto-advance after short delay
        setTimeout(() => {
            if (state.currentStep < state.totalSteps) {
                goNext();
            }
        }, 300);
    }

    // Go to next step
    function goNext() {
        if (state.currentStep >= state.totalSteps) return;

        const currentSlide = document.querySelector(`.quiz-slide[data-slide="${state.currentStep}"]`);
        const nextSlide = document.querySelector(`.quiz-slide[data-slide="${state.currentStep + 1}"]`);

        // Validate current step
        if (!validateStep(state.currentStep)) return;

        // Animate out current slide
        currentSlide.classList.remove('active');

        // Update step
        state.currentStep++;

        // Animate in next slide
        setTimeout(() => {
            nextSlide.classList.add('active');
            updateProgress();
        }, 100);
    }

    // Go back to previous step
    function goBack() {
        if (state.currentStep <= 1) return;

        const currentSlide = document.querySelector(`.quiz-slide[data-slide="${state.currentStep}"]`);
        const prevSlide = document.querySelector(`.quiz-slide[data-slide="${state.currentStep - 1}"]`);

        // Animate out current slide
        currentSlide.classList.remove('active');

        // Update step
        state.currentStep--;

        // Animate in previous slide
        setTimeout(() => {
            prevSlide.classList.add('active');
            updateProgress();
        }, 100);
    }

    // Validate step
    function validateStep(step) {
        const slide = document.querySelector(`.quiz-slide[data-slide="${step}"]`);

        // For option-based questions
        if (step < 5) {
            const selectedOption = slide.querySelector('.quiz-option.selected');
            if (!selectedOption) {
                // Visual feedback
                slide.querySelectorAll('.quiz-option').forEach(opt => {
                    opt.style.animation = 'shake 0.3s ease';
                    setTimeout(() => opt.style.animation = '', 300);
                });
                return false;
            }
        }

        return true;
    }

    // Update progress bar and indicators
    function updateProgress() {
        const progress = ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
        elements.progressBar.style.width = `${progress}%`;

        // Update step indicators
        elements.steps.forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 < state.currentStep) {
                step.classList.add('completed');
            } else if (index + 1 === state.currentStep) {
                step.classList.add('active');
            }
        });

        // Show/hide back button
        elements.backButton.style.display = state.currentStep > 1 ? 'flex' : 'none';
    }

    // Handle keyboard navigation
    function handleKeyDown(e) {
        if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            if (document.activeElement.tagName !== 'INPUT') {
                goBack();
            }
        }
    }

    // Handle form submission
    async function handleSubmit(e) {
        e.preventDefault();

        // Get form data
        state.answers.first_name = document.getElementById('firstName').value;
        state.answers.last_name = document.getElementById('lastName').value;
        state.answers.email = document.getElementById('email').value;
        state.answers.phone = document.getElementById('phone').value;

        // Validate
        if (!state.answers.first_name || !state.answers.email || !state.answers.phone) {
            alert('Please fill in all required fields.');
            return;
        }

        // Show loading state
        const submitText = document.querySelector('.quiz-submit-text');
        const submitLoading = document.querySelector('.quiz-submit-loading');
        submitText.style.display = 'none';
        submitLoading.style.display = 'flex';
        elements.submitButton.disabled = true;

        try {
            // Submit to API
            const response = await submitLead(state.answers);

            if (response.success) {
                // Show results
                showResults();
            } else {
                throw new Error(response.message || 'Submission failed');
            }
        } catch (error) {
            console.error('Submission error:', error);
            // Still show results even if API fails (don't block the user)
            showResults();
        } finally {
            // Reset button state
            submitText.style.display = 'inline';
            submitLoading.style.display = 'none';
            elements.submitButton.disabled = false;
        }
    }

    // Submit lead to API
    async function submitLead(data) {
        try {
            const response = await fetch('/api/submit-lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...data,
                    timestamp: new Date().toISOString(),
                    source: 'quiz'
                })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            // Return success anyway to not block user experience
            return { success: true, fallback: true };
        }
    }

    // Show results page
    function showResults() {
        // Hide form
        elements.form.style.display = 'none';
        elements.backButton.style.display = 'none';

        // Save quiz answers to localStorage for booking page
        localStorage.setItem('vintusQuizData', JSON.stringify({
            primary_goal: state.answers.primary_goal,
            training_days: state.answers.training_days,
            experience: state.answers.experience,
            challenge: state.answers.challenge,
            first_name: state.answers.first_name,
            last_name: state.answers.last_name,
            email: state.answers.email,
            phone: state.answers.phone
        }));

        // Generate AI summary
        generateAISummary();

        // Initialize calendar embed
        initCalendarEmbed();

        // Show results
        elements.results.style.display = 'block';

        // Update progress to 100%
        elements.progressBar.style.width = '100%';
        elements.steps.forEach(step => step.classList.add('completed'));

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Initialize Google Calendar embed
    function initCalendarEmbed() {
        const calendarEmbed = document.getElementById('calendarEmbed');

        // Configuration - Replace with actual Google Calendar appointment URL
        // To get this URL:
        // 1. Create appointment schedule in Google Calendar
        // 2. Go to appointment settings
        // 3. Copy the booking page URL
        const CALENDAR_CONFIG = {
            // Set this to true and provide the URL once Google Calendar is configured
            enabled: false,
            // Example: 'https://calendar.google.com/calendar/appointments/schedules/YOUR_SCHEDULE_ID'
            appointmentUrl: '',
            // Or use embed code for regular calendar view
            embedUrl: ''
        };

        if (CALENDAR_CONFIG.enabled && (CALENDAR_CONFIG.appointmentUrl || CALENDAR_CONFIG.embedUrl)) {
            const url = CALENDAR_CONFIG.appointmentUrl || CALENDAR_CONFIG.embedUrl;
            calendarEmbed.innerHTML = `
                <iframe
                    src="${url}?gv=true"
                    style="border: 0; width: 100%; height: 100%; min-height: 500px;"
                    frameborder="0"
                    loading="lazy"
                ></iframe>
            `;
        }
        // Otherwise, keep the placeholder that's already in the HTML
    }

    // Generate AI Summary based on quiz answers
    function generateAISummary() {
        const { primary_goal, training_days, experience, challenge, first_name } = state.answers;

        // Goal mapping
        const goalMap = {
            'build-muscle': 'building muscle and gaining strength',
            'lose-fat': 'losing fat and getting lean',
            'improve-endurance': 'improving endurance and stamina',
            'overall-health': 'improving overall health and wellness'
        };

        // Experience mapping
        const experienceMap = {
            'beginner': 'someone new to structured training',
            'intermediate': 'someone with 1-3 years of training experience',
            'advanced': 'an experienced athlete ready for elite-level programming'
        };

        // Challenge mapping
        const challengeMap = {
            'consistency': 'staying consistent with your routine',
            'nutrition': 'dialing in your nutrition',
            'motivation': 'maintaining motivation',
            'time': 'finding time in your busy schedule'
        };

        // Training days mapping
        const daysMap = {
            '2-3': '2-3 days per week',
            '4-5': '4-5 days per week',
            '6+': '6+ days per week'
        };

        // Generate personalized content
        const html = `
            <p><strong>${first_name}</strong>, based on your responses, here's what we've identified:</p>

            <p>Your primary focus is <strong>${goalMap[primary_goal] || 'achieving your fitness goals'}</strong>.
            As ${experienceMap[experience] || 'someone looking to level up'}, you're ready for a program that
            matches your current abilities while progressively challenging you.</p>

            <p>With <strong>${daysMap[training_days] || 'your available schedule'}</strong>, we can design an
            efficient program that maximizes every session. Your biggest challenge -
            <strong>${challengeMap[challenge] || 'overcoming obstacles'}</strong> - is something we address
            directly in our coaching methodology.</p>

            <ul>
                <li><strong>Personalized workout splits</strong> optimized for your schedule</li>
                <li><strong>Progressive overload strategy</strong> tailored to ${experience === 'beginner' ? 'build a strong foundation' : experience === 'advanced' ? 'break through plateaus' : 'accelerate your progress'}</li>
                <li><strong>Accountability systems</strong> to tackle ${challengeMap[challenge] || 'your challenges'}</li>
                <li><strong>Nutrition guidance</strong> aligned with your ${goalMap[primary_goal] || 'goals'}</li>
            </ul>

            <p>Your complete transformation blueprint is ready. Book a free strategy call below to receive
            your full custom program and discuss your goals with Coach Anthony.</p>
        `;

        elements.aiContent.innerHTML = html;
    }

    // Shake animation for validation feedback
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
