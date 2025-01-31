/**
 * Events.js - Event Display Component for Blue Archive Thread Enhancement
 * ===================================================================
 * 
 * Purpose:
 * --------
 * This module manages and displays event information for Blue Archive threads.
 * Handles event data processing, rerun detection, and countdown timers.
 * 
 * Table of Contents:
 * -----------------
 * 1. Configuration & Constants
 * 2. Type Definitions & Interfaces
 * 3. Event Processing Logic
 * 4. Display Styling
 * 5. Timer Management  
 * 6. Utility Functions
 * 7. Error Handling
 * 8. Performance Monitoring
 * 
 * Technical Implementation:
 * -----------------------
 * - Processes event data from SchaleDB API
 * - Handles rerun event detection and labeling
 * - Implements countdown timers with cleanup
 * - Uses optimized DOM manipulation strategies
 * 
 * Dependencies:
 * ------------
 * - Utils.js: Common utility functions for date/time handling
 * 
 * Version: 4.0.0
 * Last Updated: 2025 January
 */

// Import required utilities
import { formatDate, calculateTimeLeft, createCountdownTimer, hasExpired } from './Utils.js';

/**
 * Section 2: Type Definitions & Constants
 * ------------------------------------
 * Central storage for all configurable values and constants used throughout
 * the event display implementation. Each constant is documented with its
 * purpose and usage.
 */

/**
 * Configuration object containing all adjustable parameters
 * for the event display component
 */
const CONFIG = {
    // Display settings for consistent styling
    DISPLAY: {
        CONTENT_HEIGHT: '125px',
        IMAGE_MAX_WIDTH: '240px',
        IMAGE_MAX_HEIGHT: '80px',
        BORDER_COLOR: '#ccc',
        BORDER_RADIUS: '5px',
        SPACING: '10px',
        PADDING: '10px'
    },

    // Timer configurations for countdown displays
    TIMER: {
        UPDATE_INTERVAL: 1000,  // 1 second intervals for countdown
        CLEANUP_DELAY: 100      // Delay before timer cleanup
    },

    // Image path configuration for different server regions
    IMAGE_PATHS: {
        EVENT_LOGO: 'https://schaledb.com/images/eventlogo',
        EVENT_LOGO_SUFFIX: {
            en: 'En',
            jp: 'Jp'
        }
    },

    // Rerun detection configuration
    RERUN: {
        PREFIX: '10',           // Prefix indicating rerun event
        SUFFIX_TEXT: '(Rerun)'  // Text to append for rerun events
    }
};

/**
 * Style definitions for event display components
 * Using const for performance and to prevent modification
 */
const STYLES = {
    cell: {
        flex: '1',
        verticalAlign: 'top',
        padding: '2.5px'
    },

    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: CONFIG.DISPLAY.SPACING
    },

    row: {
        display: 'flex',
        gap: CONFIG.DISPLAY.SPACING
    },

    // Event card container styling
    eventCard: {
        border: `1px solid ${CONFIG.DISPLAY.BORDER_COLOR}`,
        borderRadius: CONFIG.DISPLAY.BORDER_RADIUS,
        display: 'flex',
        flexDirection: 'column',
        flex: '1'
    },

    // Event header styling
    header: {
        lineHeight: '1.2',
        textSizeAdjust: '100%',
        fontWeight: 'bold',
        padding: CONFIG.DISPLAY.PADDING,
        textAlign: 'center',
        borderBottom: `1px solid ${CONFIG.DISPLAY.BORDER_COLOR}`
    },

    // Event content area styling
    content: {
        height: CONFIG.DISPLAY.CONTENT_HEIGHT,
        display: 'flex',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        padding: CONFIG.DISPLAY.PADDING
    },

    // Event footer styling
    footer: {
        padding: CONFIG.DISPLAY.PADDING,
        textAlign: 'center',
        borderTop: `1px solid ${CONFIG.DISPLAY.BORDER_COLOR}`
    }
};

/**
 * Error messages for consistent error reporting
 */
const ERROR_MESSAGES = {
    EXPIRED_EVENT: 'Event has expired, skipping display',
    UNKNOWN_EVENT: 'Unknown Event',
    TIMER_CLEANUP: 'Error during timer cleanup',
    IMAGE_LOAD: 'Failed to load event image'
};

/**
 * Section 3: Event Processing Logic
 * ------------------------------
 * Core functionality for processing and displaying event data. This section
 * contains the main processing pipeline and helper functions for handling 
 * event information.
 */

/**
 * Main function to process and generate HTML for current events
 * Handles all event data processing, rerun detection, and display generation
 * 
 * @param {Object} currentEvents - Raw event data from config
 * @param {Object} localizationData - Localization strings for event names
 * @param {string} lang - Current language setting (en/jp)
 * @param {Array} timerIds - Array to track active countdown timers
 * @returns {string} Generated HTML for events section
 */
export async function processEvents(currentEvents, localizationData, lang, timerIds) {
    // Return early if no events exist
    if (!currentEvents || Object.keys(currentEvents).length === 0) {
        return '';
    }

    let eventsCell = '';

    // Process events in pairs for two-column layout
    for (let i = 0; i < Object.keys(currentEvents).length; i += 2) {
        const eventEntries = Object.entries(currentEvents).slice(i, i + 2);
        const processedEvents = await processEventPair(eventEntries, localizationData, lang, timerIds);

        if (processedEvents) {
            eventsCell += `<div style="${getStyleString(STYLES.row)}">${processedEvents}</div>`;
        }
    }

    // Return complete events section if content exists
    return eventsCell ?
        `<td style="${getStyleString(STYLES.cell)}"><div style="${getStyleString(STYLES.section)}">${eventsCell}</div></td>`
        : '';
}

/**
 * Processes a pair of events for two-column display
 * Handles individual event processing and layout generation
 * 
 * @param {Array} eventEntries - Pair of event entries to process
 * @param {Object} localizationData - Localization strings
 * @param {string} lang - Current language setting
 * @param {Array} timerIds - Timer tracking array
 * @returns {string} HTML for event pair
 */
async function processEventPair(eventEntries, localizationData, lang, timerIds) {
    let innerEventsCell = '';

    for (const [eventNum, eventData] of eventEntries) {
        // Skip processing if event has expired
        if (hasExpired(eventData.end)) {
            console.log(ERROR_MESSAGES.EXPIRED_EVENT, eventNum);
            continue;
        }

        // Process event details
        const eventDetails = processEventDetails(eventData, localizationData);

        // Generate display content
        const eventContent = generateEventDisplay(
            eventDetails,
            lang,
            eventNum,
            timerIds
        );

        innerEventsCell += eventContent;
    }

    return innerEventsCell;
}

/**
 * Processes raw event data to extract and format event details
 * Handles rerun detection and name localization
 * 
 * @param {Object} eventData - Raw event data
 * @param {Object} localizationData - Localization strings
 * @returns {Object} Processed event details
 */
function processEventDetails(eventData, localizationData) {
    const fullEventId = eventData.event.toString();
    const isRerun = fullEventId.startsWith(CONFIG.RERUN.PREFIX);
    const eventId = isRerun ? fullEventId.slice(2) : fullEventId;

    // Get and format event name
    let eventName = localizationData.EventName?.[eventId] || ERROR_MESSAGES.UNKNOWN_EVENT;
    if (isRerun) {
        eventName += ` ${CONFIG.RERUN.SUFFIX_TEXT}`;
    }

    return {
        eventId,
        eventName,
        startTime: formatDate(eventData.start),
        endTime: formatDate(eventData.end)
    };
}

/**
 * Section 4: Display Styling and Content Generation
 * ---------------------------------------------
 * Functions responsible for generating the visual display of events and 
 * managing the styling of event components. This section focuses on 
 * creating consistent, maintainable HTML output with optimized styling.
 */

/**
 * Generates the complete HTML display for a single event
 * Creates the card structure containing event image, name, and timer
 * 
 * @param {Object} eventDetails - Processed event information
 * @param {string} lang - Current language setting
 * @param {string} eventNum - Unique identifier for the event
 * @param {Array} timerIds - Array tracking countdown timers
 * @returns {string} Complete HTML for the event card
 */
function generateEventDisplay(eventDetails, lang, eventNum, timerIds) {
    // Generate unique timer ID for this event
    const timerId = `event-timer-${eventNum}`;

    // Build the event logo URL based on language setting
    const eventImage = `${CONFIG.IMAGE_PATHS.EVENT_LOGO}/` +
        `${eventDetails.eventId}_` +
        `${CONFIG.IMAGE_PATHS.EVENT_LOGO_SUFFIX[lang]}.webp`;

    // Create event card structure using template literals
    const eventCard = `
        <div style="${getStyleString(STYLES.eventCard)}">
            ${generateEventHeader()}
            ${generateEventContent(eventImage, eventDetails.eventName)}
            ${generateEventFooter(
        eventDetails.startTime,
        eventDetails.endTime,
        timerId
    )}
        </div>
    `;

    // Initialize countdown timer with cleanup handling
    initializeEventTimer(
        eventDetails.startTime,
        eventDetails.endTime,
        timerId,
        timerIds
    );

    return eventCard;
}

/**
 * Generates the header section of the event card
 * Contains the "Event" label with consistent styling
 * 
 * @returns {string} HTML for event card header
 */
function generateEventHeader() {
    return `
        <div style="${getStyleString(STYLES.header)}">
            Event
        </div>
    `;
}

/**
 * Generates the main content section of the event card
 * Contains the event image and name with responsive layout
 * 
 * @param {string} imageUrl - URL for the event logo image
 * @param {string} eventName - Localized event name
 * @returns {string} HTML for event content section
 */
function generateEventContent(imageUrl, eventName) {
    const imageStyles = {
        maxWidth: CONFIG.DISPLAY.IMAGE_MAX_WIDTH,
        maxHeight: CONFIG.DISPLAY.IMAGE_MAX_HEIGHT,
        width: 'auto',
        height: 'auto',
        objectFit: 'contain'
    };

    return `
        <div style="${getStyleString(STYLES.content)}">
            <div style="display: block;">
                <div style="display: flex; justify-content: space-evenly; align-items: center;">
                    <img 
                        src="${imageUrl}" 
                        alt="${eventName}"
                        style="${getStyleString(imageStyles)}"
                        onerror="this.onerror=null; console.error('${ERROR_MESSAGES.IMAGE_LOAD}: ${imageUrl}');"
                    >
                </div>
                <center style="flex: 1; width: 100%; min-width: 0;">
                    ${eventName}
                </center>
            </div>
        </div>
    `;
}

/**
 * Generates the footer section of the event card
 * Contains event timing information and countdown display
 * 
 * @param {string} startTime - Formatted event start time
 * @param {string} endTime - Formatted event end time
 * @param {string} timerId - Unique identifier for countdown timer
 * @returns {string} HTML for event footer section
 */
function generateEventFooter(startTime, endTime, timerId) {
    return `
        <div style="${getStyleString(STYLES.footer)}">
            <div>${startTime} - ${endTime}</div>
            <div id="${timerId}" style="margin-top: 5px;">
                ${calculateTimeLeft(startTime, endTime)}
            </div>
        </div>
    `;
}

/**
 * Converts a style object into a CSS string
 * Handles camelCase to kebab-case conversion for CSS properties
 * 
 * @param {Object} styles - Object containing style properties
 * @returns {string} CSS string for inline styles
 */
function getStyleString(styles) {
    return Object.entries(styles)
        .map(([key, value]) => {
            // Convert camelCase to kebab-case for CSS properties
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
        })
        .join('; ');
}

/**
 * Section 5: Timer Management
 * ------------------------
 * Handles all timing-related functionality for event countdowns.
 * This includes timer initialization, updates, and cleanup to prevent
 * memory leaks and ensure smooth performance.
 */

/**
 * Initializes and sets up a countdown timer for an event
 * Creates the timer with proper cleanup handling to avoid memory leaks
 * 
 * @param {string} startTime - Event start time in ISO format
 * @param {string} endTime - Event end time in ISO format
 * @param {string} timerId - Unique identifier for the timer element
 * @param {Array} timerIds - Array to track active timer IDs
 */
function initializeEventTimer(startTime, endTime, timerId, timerIds) {
    // Delay timer setup to ensure DOM element exists
    setTimeout(() => {
        const timerId = setInterval(() => {
            updateEventTimer(startTime, endTime, timerId);
        }, CONFIG.TIMER.UPDATE_INTERVAL);

        // Store timer ID for cleanup
        timerIds.push(timerId);

        // Add cleanup listener for page unload
        window.addEventListener('unload', () => cleanupTimer(timerId, timerIds));
    }, CONFIG.TIMER.CLEANUP_DELAY);
}

/**
 * Updates the countdown display for an event
 * Handles different display states based on event timing
 * 
 * @param {string} startTime - Event start time
 * @param {string} endTime - Event end time
 * @param {string} timerId - Element ID for timer display
 */
function updateEventTimer(startTime, endTime, timerId) {
    const timerElement = document.getElementById(timerId);
    if (!timerElement) {
        cleanupTimer(timerId, timerIds);
        return;
    }

    // Calculate current timer state
    const currentTime = new Date().getTime();
    const startTimeMs = new Date(startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();

    // Determine display text based on event timing
    let displayText = getTimerDisplayText(currentTime, startTimeMs, endTimeMs);
    
    // Update display and handle timer completion
    timerElement.textContent = displayText;
    
    if (displayText === "Event Ended") {
        cleanupTimer(timerId, timerIds);
    }
}

/**
 * Determines the appropriate display text for the timer
 * Based on current time relative to event start/end times
 * 
 * @param {number} currentTime - Current timestamp in milliseconds
 * @param {number} startTime - Event start timestamp
 * @param {number} endTime - Event end timestamp
 * @returns {string} Formatted display text for timer
 */
function getTimerDisplayText(currentTime, startTime, endTime) {
    if (currentTime < startTime) {
        // Event hasn't started
        return `Starts in: ${formatTimeRemaining(startTime - currentTime)}`;
    } else if (currentTime < endTime) {
        // Event is ongoing
        return `Time Left: ${formatTimeRemaining(endTime - currentTime)}`;
    } else {
        // Event has ended
        return "Event Ended";
    }
}

/**
 * Formats a duration in milliseconds into readable text
 * Converts milliseconds to days, hours, and minutes
 * 
 * @param {number} duration - Time duration in milliseconds
 * @returns {string} Formatted duration string (e.g., "2d 5h 30m")
 */
function formatTimeRemaining(duration) {
    const days = Math.floor(duration / (1000 * 60 * 60 * 24));
    const hours = Math.floor((duration % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

    return `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m`;
}

/**
 * Cleans up timer resources and removes tracking
 * Prevents memory leaks from abandoned timers
 * 
 * @param {number} timerId - ID of the interval to clear
 * @param {Array} timerIds - Array tracking active timer IDs
 */
function cleanupTimer(timerId, timerIds) {
    try {
        // Clear the interval
        clearInterval(timerId);
        
        // Remove from tracking array
        const index = timerIds.indexOf(timerId);
        if (index > -1) {
            timerIds.splice(index, 1);
        }
    } catch (error) {
        console.error(ERROR_MESSAGES.TIMER_CLEANUP, error);
    }
}

/**
 * Section 6: Error Handling
 * ----------------------
 * Comprehensive error handling system for the events display component.
 * Implements graceful degradation and recovery mechanisms to maintain
 * functionality even when errors occur.
 */

/**
 * Primary error handler for event-related operations
 * Routes errors to specific handlers based on type and severity
 * 
 * @param {Error} error - The error that occurred
 * @param {string} context - Additional context about where error occurred
 * @param {Object} eventData - Related event data if available
 */
function handleEventError(error, context, eventData = null) {
    // Log error for debugging
    console.error(`Event Error [${context}]:`, error);

    switch (context) {
        case 'display':
            handleDisplayError(error, eventData);
            break;
        case 'timer':
            handleTimerError(error, eventData);
            break;
        case 'image':
            handleImageError(error, eventData);
            break;
        default:
            handleGenericError(error);
    }

    // Track error for analytics
    recordErrorMetrics(error, context);
}

/**
 * Handles errors related to event display generation
 * Attempts to provide fallback display when possible
 * 
 * @param {Error} error - Display-related error
 * @param {Object} eventData - Data for the affected event
 */
function handleDisplayError(error, eventData) {
    try {
        // Create fallback display for the event
        return `
            <div style="${getStyleString(STYLES.eventCard)}">
                <div style="${getStyleString(STYLES.header)}">
                    Event Information Temporarily Unavailable
                </div>
                <div style="${getStyleString(STYLES.content)}">
                    <div style="text-align: center; color: #666;">
                        Unable to display event details.
                        ${eventData?.eventName ? `<br>Event: ${eventData.eventName}` : ''}
                    </div>
                </div>
            </div>
        `;
    } catch (fallbackError) {
        console.error('Failed to create fallback display:', fallbackError);
        return ''; // Return empty string as last resort
    }
}

/**
 * Handles errors related to timer functionality
 * Attempts to recover timer operation or provide static display
 * 
 * @param {Error} error - Timer-related error
 * @param {Object} eventData - Data for the affected event
 */
function handleTimerError(error, eventData) {
    try {
        const timerId = eventData?.timerId;
        if (timerId) {
            // Clear problematic timer
            cleanupTimer(timerId, [timerId]);
            
            // Attempt to recreate timer with basic functionality
            const timerElement = document.getElementById(timerId);
            if (timerElement) {
                timerElement.textContent = 'Time display temporarily unavailable';
            }
        }
    } catch (recoveryError) {
        console.error('Timer recovery failed:', recoveryError);
    }
}

/**
 * Handles errors related to event image loading
 * Provides fallback content when images fail to load
 * 
 * @param {Error} error - Image loading error
 * @param {Object} eventData - Data for the affected event
 */
function handleImageError(error, eventData) {
    try {
        // Create placeholder content for failed image
        return `
            <div style="
                width: ${CONFIG.DISPLAY.IMAGE_MAX_WIDTH};
                height: ${CONFIG.DISPLAY.IMAGE_MAX_HEIGHT};
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f5f5f5;
                color: #666;
                text-align: center;
                padding: 10px;
            ">
                Event Image Unavailable
                ${eventData?.eventName ? `<br>${eventData.eventName}` : ''}
            </div>
        `;
    } catch (fallbackError) {
        console.error('Failed to create image fallback:', fallbackError);
        return ''; // Return empty string if fallback fails
    }
}

/**
 * Tracks error occurrences for monitoring and analysis
 * Helps identify patterns in errors for maintenance
 * 
 * @param {Error} error - The error to record
 * @param {string} context - Error context for categorization
 */
function recordErrorMetrics(error, context) {
    try {
        // Track error timing
        const errorTime = new Date().toISOString();
        
        // Basic error logging structure
        const errorLog = {
            timestamp: errorTime,
            context: context,
            message: error.message,
            stack: error.stack
        };

        // Store error data for analysis
        // Could be expanded to send to monitoring service
        console.debug('Error logged:', errorLog);
    } catch (loggingError) {
        // Fail silently if logging fails
        console.error('Error logging failed:', loggingError);
    }
}

/**
 * Section 7: Performance Monitoring
 * -----------------------------
 * Implements performance tracking and optimization for the events display.
 * Monitors key metrics to ensure smooth operation and identify potential
 * performance issues before they impact users.
 */

/**
 * Performance metrics storage
 * Tracks various performance indicators over time
 */
const performanceMetrics = {
    // Timing metrics
    displayTimes: [],      // Time taken to generate displays
    timerUpdates: [],      // Timer update durations
    imageLoads: [],        // Image loading times
    
    // Counter metrics
    activeTimers: 0,       // Currently running timers
    timerUpdatesCount: 0,  // Total timer updates performed
    errorCount: 0,         // Number of errors encountered
    
    // Settings
    maxSamples: 100,       // Maximum number of timing samples to store
    reportingThreshold: 16 // Performance alert threshold in milliseconds
};

/**
 * Performance monitoring wrapper for display generation
 * Tracks timing of display operations for optimization
 * 
 * @param {Function} fn - Function to monitor
 * @param {string} label - Identifier for the operation
 * @returns {Function} Wrapped function with performance monitoring
 */
function withPerformanceMonitoring(fn, label) {
    return async function(...args) {
        // Start performance measurement
        const start = performance.now();
        
        try {
            // Execute wrapped function
            const result = await fn.apply(this, args);
            
            // Record timing
            const duration = performance.now() - start;
            recordPerformanceMetric(label, duration);
            
            return result;
        } catch (error) {
            // Log performance-related errors
            console.error(`Performance error in ${label}:`, error);
            throw error;
        }
    };
}

/**
 * Records a performance metric while maintaining sample limit
 * Triggers alerts if performance degrades significantly
 * 
 * @param {string} metricName - Name of the metric to record
 * @param {number} duration - Duration of the operation in milliseconds
 */
function recordPerformanceMetric(metricName, duration) {
    const metrics = performanceMetrics[metricName];
    if (!metrics) return;

    // Add new timing sample
    metrics.push(duration);
    
    // Remove oldest sample if exceeding limit
    if (metrics.length > performanceMetrics.maxSamples) {
        metrics.shift();
    }

    // Calculate performance statistics
    const average = calculateMetricAverage(metrics);
    
    // Check for performance degradation
    if (duration > average * 2 && duration > performanceMetrics.reportingThreshold) {
        logPerformanceAlert(metricName, duration, average);
    }
}

/**
 * Calculates average of performance metrics
 * Used to establish performance baselines
 * 
 * @param {Array<number>} metrics - Array of timing measurements
 * @returns {number} Average duration
 */
function calculateMetricAverage(metrics) {
    if (!metrics.length) return 0;
    
    const sum = metrics.reduce((acc, val) => acc + val, 0);
    return sum / metrics.length;
}

/**
 * Logs performance alerts when degradation is detected
 * Provides detailed timing information for debugging
 * 
 * @param {string} metricName - Name of the affected metric
 * @param {number} current - Current operation duration
 * @param {number} average - Average duration for comparison
 */
function logPerformanceAlert(metricName, current, average) {
    console.warn(
        `Performance alert for ${metricName}:`,
        `\nCurrent: ${current.toFixed(2)}ms`,
        `\nAverage: ${average.toFixed(2)}ms`,
        `\nDegradation: ${((current - average) / average * 100).toFixed(1)}%`
    );

    // Generate performance report for analysis
    generatePerformanceReport();
}

/**
 * Generates comprehensive performance report
 * Useful for debugging performance issues
 */
function generatePerformanceReport() {
    console.group('Events Display Performance Report');
    
    // Timer statistics
    console.log('Active Timers:', performanceMetrics.activeTimers);
    console.log('Total Updates:', performanceMetrics.timerUpdatesCount);
    
    // Display timing statistics
    if (performanceMetrics.displayTimes.length) {
        console.log('Display Generation Times (ms):', {
            recent: performanceMetrics.displayTimes.slice(-5),
            average: calculateMetricAverage(performanceMetrics.displayTimes)
        });
    }

    // Error tracking
    console.log('Total Errors:', performanceMetrics.errorCount);
    
    // Memory usage if available
    if (performance.memory) {
        console.log('Memory Usage:', {
            used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB'
        });
    }

    console.groupEnd();
}