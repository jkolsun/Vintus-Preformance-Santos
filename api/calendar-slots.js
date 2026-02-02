/**
 * Vercel Serverless Function: Get Calendar Availability
 * Returns booked time slots from Google Calendar
 */

const { google } = require('googleapis');

// Configuration
const CONFIG = {
    availableHours: [9, 10, 11, 13, 14, 15, 16, 17, 18],
    availableDays: [1, 2, 3, 4, 5], // Monday - Friday
    maxAdvanceDays: 30,
    timezone: 'America/New_York'
};

// Generate simulated busy schedule for demo/fallback
function generateSimulatedBookings() {
    const bookings = {};
    const today = new Date();

    for (let i = 0; i < CONFIG.maxAdvanceDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        if (!CONFIG.availableDays.includes(date.getDay())) continue;

        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        bookings[dateKey] = [];

        // Book 40-60% of slots to look busy
        const bookingRate = 0.4 + Math.random() * 0.2;

        CONFIG.availableHours.forEach(hour => {
            const isMorning = hour >= 9 && hour <= 11;
            const adjustedRate = isMorning ? bookingRate + 0.15 : bookingRate;

            [0, 30].forEach(minute => {
                if (Math.random() < adjustedRate) {
                    bookings[dateKey].push(`${hour}:${minute.toString().padStart(2, '0')}`);
                }
            });
        });

        // Ensure 2-4 slots available per day
        const totalSlots = CONFIG.availableHours.length * 2;
        const minAvailable = 2 + Math.floor(Math.random() * 3);
        const maxBooked = totalSlots - minAvailable;
        if (bookings[dateKey].length > maxBooked) {
            bookings[dateKey] = bookings[dateKey].slice(0, maxBooked);
        }
    }

    return bookings;
}

module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
        const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

        // If no calendar credentials, return simulated data
        if (!calendarId || !privateKey || !clientEmail) {
            console.log('Calendar not configured, using simulated data');
            return res.status(200).json({
                bookedSlots: generateSimulatedBookings(),
                source: 'simulated'
            });
        }

        // Initialize Google Calendar API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Get events for the next 30 days
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + CONFIG.maxAdvanceDays);

        const response = await calendar.events.list({
            calendarId,
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];
        const bookedSlots = {};

        // Process events into booked slots
        // Block all 30-minute slots that overlap with calendar events
        events.forEach(event => {
            // Handle both timed events and all-day events
            const startTime = event.start.dateTime ? new Date(event.start.dateTime) : null;
            const endTime = event.end.dateTime ? new Date(event.end.dateTime) : null;

            // Skip all-day events (they don't have dateTime)
            if (!startTime || !endTime) return;

            // Block all 30-minute slots that this event covers
            let slotTime = new Date(startTime);
            // Round down to nearest 30 min slot
            slotTime.setMinutes(slotTime.getMinutes() < 30 ? 0 : 30, 0, 0);

            while (slotTime < endTime) {
                const dateKey = `${slotTime.getFullYear()}-${(slotTime.getMonth() + 1).toString().padStart(2, '0')}-${slotTime.getDate().toString().padStart(2, '0')}`;
                const timeKey = `${slotTime.getHours()}:${slotTime.getMinutes().toString().padStart(2, '0')}`;

                if (!bookedSlots[dateKey]) {
                    bookedSlots[dateKey] = [];
                }

                // Only add if not already in the list
                if (!bookedSlots[dateKey].includes(timeKey)) {
                    bookedSlots[dateKey].push(timeKey);
                }

                // Move to next 30-minute slot
                slotTime.setMinutes(slotTime.getMinutes() + 30);
            }
        });

        res.status(200).json({
            bookedSlots: bookedSlots,
            source: 'calendar',
            eventCount: events.length
        });

    } catch (error) {
        console.error('Calendar API error:', error);
        // Fallback to simulated data on error
        res.status(200).json({
            bookedSlots: generateSimulatedBookings(),
            source: 'simulated',
            error: error.message
        });
    }
};
