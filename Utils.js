// Utils.js - Shared utility functions for Blue Archive info display
// These utilities handle common operations needed across gacha, events, and raids

/**
 * Formats a date consistently across the application
 * Converts timestamps or date strings directly to YYYY/MM/DD, HH:MM format
 * Example output: "2024/01/31, 15:30"
 * 
 * @param {number|string} timestamp - Unix timestamp or formatted date string
 * @returns {string} Formatted date string
 * 
 * This implementation directly extracts date components and formats them,
 * avoiding unnecessary string conversions and parsing operations.
 */
export function formatDate(timestamp) {
    // Convert timestamp to Date object, handling both Unix timestamps and date strings
    const date = new Date(typeof timestamp === 'number' ? timestamp * 1000 : timestamp);
    
    // Directly get date components and pad them with leading zeros where needed
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // Build the final string directly in YMD format
    return `${year}/${month}/${day}, ${hours}:${minutes}`;
}

/**
 * Checks if an item (gacha/event/raid) has expired based on its end time
 * Handles both Unix timestamps and formatted date strings
 * 
 * @param {number|string} endTime - End time as Unix timestamp or formatted date string
 * @returns {boolean} True if expired, false if still active
 */
export function hasExpired(endTime) {
    let expirationTime;

    // Handle both Unix timestamps and formatted date strings
    if (typeof endTime === 'string') {
        // Parse formatted date string to timestamp
        const parsedDate = new Date(endTime);
        expirationTime = parsedDate.getTime();
    } else {
        // Convert Unix timestamp to milliseconds if needed
        // Checks if timestamp is in seconds (less than year 2286) and converts to milliseconds if so
        expirationTime = endTime < 1e12 ? endTime * 1000 : endTime;
    }

    return expirationTime <= Date.now();
}

/**
 * Calculates time remaining until start or end of an event
 * Used for "Starts in" or "Time Left" countdowns
 * 
 * @param {Date|number|string} startTime - Start time of the event
 * @param {Date|number|string} endTime - End time of the event
 * @returns {string} Formatted countdown string
 */
export function calculateTimeLeft(startTime, endTime) {
    const now = new Date().getTime();
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    // Event hasn't started yet
    if (now < start) {
        const timeUntilStart = start - now;
        return `Starts in: ${formatDuration(timeUntilStart)}`;
    }

    // Event is ongoing
    if (now < end) {
        const timeUntilEnd = end - now;
        return `Time Left: ${formatDuration(timeUntilEnd)}`;
    }

    // Event has ended
    return "Event Ended";
}

/**
 * Formats a duration in milliseconds to a readable string
 * Example: "2d 15h 30m" for 2 days, 15 hours, and 30 minutes
 * 
 * @param {number} duration - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(duration) {
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    return `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m`;
}

/**
 * Creates and manages a countdown timer for an event
 * Updates the display every second and cleans up when expired
 * 
 * @param {Date|number|string} startTime - Start time of the event
 * @param {Date|number|string} endTime - End time of the event
 * @param {string} elementId - ID of the HTML element to update
 * @param {Array} timerIds - Array to store active timer IDs for cleanup
 */
export function createCountdownTimer(startTime, endTime, elementId, timerIds) {
    let timerId = setInterval(1000);
    
    // Function to update the timer display
    const updateTimer = () => {
        const timerElement = document.getElementById(elementId);
        const displayText = calculateTimeLeft(startTime, endTime);

        if (timerElement) {
            timerElement.textContent = displayText;
        } else {
            clearInterval(timerId); // Clean up if element is removed
        }

        // Stop updating if event has ended
        if (displayText === "Event Ended") {
            clearInterval(timerId);
        }
    };

    // Initial update
    updateTimer();
    
    // Set up interval for updates
    timerId = setInterval(updateTimer, 1000);
    
    // Store timer ID for cleanup
    timerIds.push(timerId);
}

/**
 * Helper function to capitalize first letter of a string
 * Used for consistent text formatting across modules
 * 
 * @param {string} string - Input string to capitalize
 * @returns {string} String with first letter capitalized
 */
export function capitalizeFirstLetter(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}