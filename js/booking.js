/**
 * Vintus Performance - Booking System
 * Handles calendar display, time slot selection, and booking submission
 */

(function() {
    'use strict';

    // ====================================
    // Configuration
    // ====================================
    const CONFIG = {
        // Available time slots (24-hour format)
        availableHours: [9, 10, 11, 13, 14, 15, 16, 17, 18],
        // Days of week available (0 = Sunday, 6 = Saturday)
        availableDays: [1, 2, 3, 4, 5], // Monday - Friday
        // Slot duration in minutes
        slotDuration: 30,
        // How many days in advance can book
        maxAdvanceDays: 30,
        // Minimum hours notice required
        minNoticeHours: 24,
        // Timezone
        timezone: 'America/New_York'
    };

    // ====================================
    // State
    // ====================================
    const state = {
        currentMonth: new Date().getMonth(),
        currentYear: new Date().getFullYear(),
        selectedDate: null,
        selectedTime: null,
        bookedSlots: {}, // Will be populated from API or simulated
        isLoading: false
    };

    // ====================================
    // DOM Elements
    // ====================================
    const elements = {
        calendarGrid: document.getElementById('calendarGrid'),
        currentMonth: document.getElementById('currentMonth'),
        prevMonth: document.getElementById('prevMonth'),
        nextMonth: document.getElementById('nextMonth'),
        timeSlotsWrapper: document.getElementById('timeSlotsWrapper'),
        timeSlotsGrid: document.getElementById('timeSlotsGrid'),
        selectedDateDisplay: document.getElementById('selectedDateDisplay'),
        summaryDate: document.getElementById('summaryDate'),
        summaryTime: document.getElementById('summaryTime'),
        bookingForm: document.getElementById('bookingForm'),
        bookingSubmit: document.getElementById('bookingSubmit'),
        bookingModal: document.getElementById('bookingModal'),
        calendarLoading: document.getElementById('calendarLoading')
    };

    // ====================================
    // Utility Functions
    // ====================================
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    function formatDate(date) {
        const options = { weekday: 'long', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    }

    function formatTime(hour, minute = 0) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const displayMinute = minute.toString().padStart(2, '0');
        return `${displayHour}:${displayMinute} ${period}`;
    }

    function getDateKey(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    }

    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    function isPastDate(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    }

    function isWithinBookingWindow(date) {
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + CONFIG.maxAdvanceDays);
        return date <= maxDate;
    }

    // ====================================
    // API Functions
    // ====================================
    async function fetchAvailability() {
        state.isLoading = true;
        showLoading(true);

        try {
            var apiUrl = (window.VINTUS_CONFIG && window.VINTUS_CONFIG.API_URL) || '';
            var month = state.currentMonth + 1;
            var year = state.currentYear;
            var response = await fetch(apiUrl + '/api/v1/leads/slots?month=' + month + '&year=' + year);

            if (response.ok) {
                var result = await response.json();
                state.bookedSlots = (result.data && result.data.bookedSlots) || {};
            } else {
                // On error, default to no bookings (all slots open)
                state.bookedSlots = {};
            }
        } catch (error) {
            console.warn('Could not fetch availability, defaulting to all open:', error.message);
            state.bookedSlots = {};
        }

        state.isLoading = false;
        showLoading(false);
        renderCalendar();
    }

    async function submitBooking(formData) {
        state.isLoading = true;
        showLoading(true);

        // Get quiz data from localStorage if available
        var quizData = {};
        try {
            var stored = localStorage.getItem('vintusQuizData');
            if (stored) {
                quizData = JSON.parse(stored);
            }
        } catch (e) {
            // no quiz data
        }

        // Read tier from URL param
        var urlParams = new URLSearchParams(window.location.search);
        var tier = urlParams.get('tier') || undefined;

        var nameParts = (formData.get('name') || '').split(' ');
        var firstName = nameParts[0] || '';
        var lastName = nameParts.slice(1).join(' ') || undefined;

        var bookingData = {
            firstName: firstName,
            lastName: lastName,
            email: formData.get('email'),
            phone: formData.get('phone') || undefined,
            preferredDate: getDateKey(state.selectedDate),
            preferredTime: state.selectedTime,
            tier: tier,
            primaryGoal: quizData.primary_goal || undefined,
            experience: quizData.experience || undefined
        };

        try {
            var apiUrl = (window.VINTUS_CONFIG && window.VINTUS_CONFIG.API_URL) || '';
            var response = await fetch(apiUrl + '/api/v1/leads/consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                showSuccessModal();
            } else {
                var errBody = await response.json().catch(function() { return {}; });
                showErrorMessage(errBody.error || 'Booking failed. Please try again or email us at vintusperformance@gmail.com');
            }
        } catch (error) {
            console.error('Booking error:', error);
            showErrorMessage('Something went wrong. Please email us at vintusperformance@gmail.com');
        }

        state.isLoading = false;
        showLoading(false);
    }

    function showErrorMessage(msg) {
        var existing = document.querySelector('.booking-error-msg');
        if (existing) existing.remove();

        var errorDiv = document.createElement('div');
        errorDiv.className = 'booking-error-msg';
        errorDiv.style.cssText = 'color:#f87171;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:0.75rem 1rem;margin-top:1rem;font-size:0.85rem;text-align:center;';
        errorDiv.textContent = msg;

        if (elements.bookingForm) {
            elements.bookingForm.appendChild(errorDiv);
        }
    }

    // ====================================
    // Rendering Functions
    // ====================================
    function showLoading(show) {
        if (elements.calendarLoading) {
            elements.calendarLoading.style.display = show ? 'flex' : 'none';
        }
    }

    function renderCalendar() {
        if (!elements.calendarGrid) return;

        // Clear existing days (keep headers)
        const headers = elements.calendarGrid.querySelectorAll('.calendar-day-header');
        elements.calendarGrid.innerHTML = '';
        headers.forEach(h => elements.calendarGrid.appendChild(h));

        // Update month display
        elements.currentMonth.textContent = `${months[state.currentMonth]} ${state.currentYear}`;

        // Get first day of month and total days
        const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
        const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();

        // Add empty cells for days before first of month
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'calendar-day disabled';
            elements.calendarGrid.appendChild(emptyDay);
        }

        // Add days
        const today = new Date();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(state.currentYear, state.currentMonth, day);
            const dateKey = getDateKey(date);
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = day;

            // Check if date is valid for booking
            const isPast = isPastDate(date);
            const isAvailableDay = CONFIG.availableDays.includes(date.getDay());
            const isInWindow = isWithinBookingWindow(date);

            if (isPast) {
                dayElement.classList.add('past');
            } else if (!isAvailableDay || !isInWindow) {
                dayElement.classList.add('disabled');
            } else {
                // Check slot availability
                const bookedForDay = state.bookedSlots[dateKey] || [];
                const totalSlots = CONFIG.availableHours.length * 2; // 2 slots per hour
                const availableSlots = totalSlots - bookedForDay.length;

                if (availableSlots > 0) {
                    dayElement.classList.add('has-slots');
                    if (availableSlots <= 3) {
                        dayElement.classList.add('few-slots');
                    }

                    dayElement.addEventListener('click', () => selectDate(date));
                } else {
                    dayElement.classList.add('disabled');
                }
            }

            if (isToday(date)) {
                dayElement.classList.add('today');
            }

            if (state.selectedDate && getDateKey(state.selectedDate) === dateKey) {
                dayElement.classList.add('selected');
            }

            elements.calendarGrid.appendChild(dayElement);
        }
    }

    function renderTimeSlots() {
        if (!state.selectedDate || !elements.timeSlotsGrid) return;

        elements.timeSlotsWrapper.style.display = 'block';
        elements.selectedDateDisplay.textContent = formatDate(state.selectedDate);
        elements.timeSlotsGrid.innerHTML = '';

        const dateKey = getDateKey(state.selectedDate);
        const bookedTimes = state.bookedSlots[dateKey] || [];

        // Check minimum notice
        const now = new Date();
        const minBookingTime = new Date(now.getTime() + CONFIG.minNoticeHours * 60 * 60 * 1000);

        CONFIG.availableHours.forEach(hour => {
            [0, 30].forEach(minute => {
                const timeKey = `${hour}:${minute.toString().padStart(2, '0')}`;
                const slotTime = new Date(
                    state.selectedDate.getFullYear(),
                    state.selectedDate.getMonth(),
                    state.selectedDate.getDate(),
                    hour,
                    minute
                );

                const slotElement = document.createElement('button');
                slotElement.type = 'button';
                slotElement.className = 'time-slot';
                slotElement.textContent = formatTime(hour, minute);

                const isBooked = bookedTimes.includes(timeKey);
                const isTooSoon = slotTime < minBookingTime;

                if (isBooked || isTooSoon) {
                    slotElement.classList.add('booked');
                } else {
                    slotElement.addEventListener('click', () => selectTime(timeKey, slotElement));
                }

                if (state.selectedTime === timeKey) {
                    slotElement.classList.add('selected');
                }

                elements.timeSlotsGrid.appendChild(slotElement);
            });
        });
    }

    function updateSummary() {
        // Update date
        if (state.selectedDate) {
            elements.summaryDate.innerHTML = formatDate(state.selectedDate);
        } else {
            elements.summaryDate.innerHTML = '<span class="placeholder">Select a date</span>';
        }

        // Update time
        if (state.selectedTime) {
            const [hour, minute] = state.selectedTime.split(':').map(Number);
            elements.summaryTime.innerHTML = formatTime(hour, minute);
        } else {
            elements.summaryTime.innerHTML = '<span class="placeholder">Select a time</span>';
        }

        // Enable/disable submit button
        const canSubmit = state.selectedDate && state.selectedTime;
        elements.bookingSubmit.disabled = !canSubmit;
    }

    function showSuccessModal() {
        if (elements.bookingModal) {
            elements.bookingModal.classList.add('active');
        }
    }

    // ====================================
    // Event Handlers
    // ====================================
    function selectDate(date) {
        // Remove previous selection
        const prevSelected = elements.calendarGrid.querySelector('.calendar-day.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }

        state.selectedDate = date;
        state.selectedTime = null; // Reset time when date changes

        // Add new selection
        const days = elements.calendarGrid.querySelectorAll('.calendar-day:not(.calendar-day-header)');
        days.forEach(day => {
            const dayNum = parseInt(day.textContent);
            if (dayNum === date.getDate()) {
                day.classList.add('selected');
            }
        });

        renderTimeSlots();
        updateSummary();
    }

    function selectTime(timeKey, element) {
        // Remove previous selection
        const prevSelected = elements.timeSlotsGrid.querySelector('.time-slot.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }

        state.selectedTime = timeKey;
        element.classList.add('selected');
        updateSummary();
    }

    function navigateMonth(direction) {
        state.currentMonth += direction;

        if (state.currentMonth > 11) {
            state.currentMonth = 0;
            state.currentYear++;
        } else if (state.currentMonth < 0) {
            state.currentMonth = 11;
            state.currentYear--;
        }

        // Don't allow navigating to past months
        const now = new Date();
        if (state.currentYear < now.getFullYear() ||
            (state.currentYear === now.getFullYear() && state.currentMonth < now.getMonth())) {
            state.currentMonth = now.getMonth();
            state.currentYear = now.getFullYear();
        }

        // Don't allow navigating too far ahead
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + CONFIG.maxAdvanceDays);
        if (state.currentYear > maxDate.getFullYear() ||
            (state.currentYear === maxDate.getFullYear() && state.currentMonth > maxDate.getMonth())) {
            state.currentMonth = maxDate.getMonth();
            state.currentYear = maxDate.getFullYear();
        }

        fetchAvailability();
    }

    // ====================================
    // Initialize
    // ====================================
    function init() {
        if (!elements.calendarGrid) return;

        // Event listeners
        if (elements.prevMonth) {
            elements.prevMonth.addEventListener('click', () => navigateMonth(-1));
        }
        if (elements.nextMonth) {
            elements.nextMonth.addEventListener('click', () => navigateMonth(1));
        }

        // Form submission
        if (elements.bookingForm) {
            elements.bookingForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                if (!state.selectedDate || !state.selectedTime) {
                    return;
                }

                const formData = new FormData(e.target);

                // Show loading state
                const submitText = elements.bookingSubmit.querySelector('.submit-text');
                const submitLoading = elements.bookingSubmit.querySelector('.submit-loading');
                submitText.style.display = 'none';
                submitLoading.style.display = 'inline-flex';
                elements.bookingSubmit.disabled = true;

                await submitBooking(formData);

                // Reset loading state
                submitText.style.display = 'inline';
                submitLoading.style.display = 'none';
            });
        }

        // Close modal when clicking outside
        if (elements.bookingModal) {
            elements.bookingModal.addEventListener('click', (e) => {
                if (e.target === elements.bookingModal) {
                    elements.bookingModal.classList.remove('active');
                }
            });
        }

        // Load availability and render
        fetchAvailability();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
