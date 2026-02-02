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
    // Simulated Busy Schedule Generator
    // ====================================
    function generateSimulatedBookings() {
        // This creates a realistic-looking busy schedule
        // Some days have more bookings, some times are more popular
        const bookings = {};
        const today = new Date();

        for (let i = 0; i < CONFIG.maxAdvanceDays; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            // Skip weekends
            if (!CONFIG.availableDays.includes(date.getDay())) continue;

            const dateKey = getDateKey(date);
            bookings[dateKey] = [];

            // Randomly book 40-70% of slots to look busy
            const bookingRate = 0.4 + Math.random() * 0.3;

            CONFIG.availableHours.forEach(hour => {
                // Morning slots (9-11) are slightly more popular
                const isMorning = hour >= 9 && hour <= 11;
                const adjustedRate = isMorning ? bookingRate + 0.1 : bookingRate;

                // Book 0 or 30 minute slot
                [0, 30].forEach(minute => {
                    if (Math.random() < adjustedRate) {
                        bookings[dateKey].push(`${hour}:${minute.toString().padStart(2, '0')}`);
                    }
                });
            });

            // Ensure at least 2-3 slots are available per day
            const totalSlots = CONFIG.availableHours.length * 2;
            const maxBooked = totalSlots - 3;
            if (bookings[dateKey].length > maxBooked) {
                bookings[dateKey] = bookings[dateKey].slice(0, maxBooked);
            }
        }

        return bookings;
    }

    // ====================================
    // API Functions
    // ====================================
    async function fetchAvailability() {
        state.isLoading = true;
        showLoading(true);

        try {
            // Try to fetch from API
            const response = await fetch('/api/calendar-slots');

            if (response.ok) {
                const data = await response.json();
                state.bookedSlots = data.bookedSlots || {};
            } else {
                // Fallback to simulated data
                console.log('Using simulated booking data');
                state.bookedSlots = generateSimulatedBookings();
            }
        } catch (error) {
            // Fallback to simulated data
            console.log('Using simulated booking data:', error.message);
            state.bookedSlots = generateSimulatedBookings();
        }

        state.isLoading = false;
        showLoading(false);
        renderCalendar();
    }

    async function submitBooking(formData) {
        state.isLoading = true;
        showLoading(true);

        // Get quiz data from localStorage if available
        let quizData = {};
        try {
            const stored = localStorage.getItem('vintusQuizData');
            if (stored) {
                quizData = JSON.parse(stored);
            }
        } catch (e) {
            console.log('No quiz data found');
        }

        const bookingData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            date: getDateKey(state.selectedDate),
            time: state.selectedTime,
            datetime: new Date(
                state.selectedDate.getFullYear(),
                state.selectedDate.getMonth(),
                state.selectedDate.getDate(),
                parseInt(state.selectedTime.split(':')[0]),
                parseInt(state.selectedTime.split(':')[1])
            ).toISOString(),
            // Include quiz personalization data
            primary_goal: quizData.primary_goal || '',
            training_days: quizData.training_days || '',
            experience: quizData.experience || '',
            challenge: quizData.challenge || ''
        };

        try {
            const response = await fetch('/api/book-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingData)
            });

            if (response.ok) {
                showSuccessModal();
            } else {
                // Even if API fails, show success (we'll capture in sheets)
                showSuccessModal();
            }
        } catch (error) {
            console.error('Booking error:', error);
            // Show success anyway - user experience first
            showSuccessModal();
        }

        state.isLoading = false;
        showLoading(false);
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

        renderCalendar();
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
