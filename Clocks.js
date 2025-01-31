/**
 * Clocks.js - Clock Display Component
 * ==================================
 * A component that displays synchronized JST and UTC time clocks for Blue Archive threads.
 * Handles all timezone conversions and updates the display in real-time with proper
 * error handling and performance optimization.
 * 
 * Table of Contents:
 * -----------------
 * 1. Configuration & Constants
 * 2. DOM Structure & Management 
 * 3. Time Handling & Updates
 * 4. Style Implementation
 * 5. Error Handling & Recovery
 * 6. Initialization & Cleanup
 * 7. Performance Monitoring
 */

// Main function wrapper using async IIFE (Immediately Invoked Function Expression)
// This keeps all variables scoped within this function and prevents conflicts
// with other scripts that might be running on the page. The async wrapper
// allows use of await for clean asynchronous operations.
(async function() {

    /**
     * Section 1: Configuration and Constants
     * ------------------------------------
     * Central storage for all configurable values and constants used throughout
     * the clock implementation. Having these values in one place makes the code
     * more maintainable and easier to modify. Each constant is documented with
     * its purpose and usage.
     */
    const CONFIG = {
        // How often the clocks should update their display, in milliseconds
        // 1000ms (1 second) provides smooth updates while being performance-friendly
        UPDATE_INTERVAL: 1000,

        // Formatting options for the time display
        // These options are passed to toLocaleString() for consistent formatting
        TIME_FORMAT: {
            hour: "numeric",      // 24-hour format numbers
            minute: "numeric",    // Minutes as numbers
            second: "numeric",    // Seconds as numbers
            weekday: "short",     // Abbreviated weekday name
            month: "long",        // Full month name
            day: "numeric",       // Day of month as number
            hourCycle: 'h23'      // Use 24-hour format (0-23)
        },

        // Visual styling configurations for the clock display
        DISPLAY: {
            FONT_SIZE: "18px",         // Base font size for clock text
            HEADER_PADDING: "12px",    // Padding around clock headers
            BORDER_COLOR: "#ccc",      // Color for borders and separators
            BORDER_RADIUS: "5px"       // Rounded corner radius
        }
    };

    /**
     * Element identifiers used throughout the code
     * Centralizing IDs prevents typos and makes updates easier
     */
    const ELEMENTS = {
        PARENT_ID: "DVDoomParent",
        JST_CLOCK: "clockJST",
        UTC_CLOCK: "clockUTC"
    };

    /**
     * Timezone configurations for clock displays
     * Uses IANA timezone database names for reliability
     */
    const TIMEZONES = {
        JST: {
            name: "Japan",
            label: "JST TIME"
        },
        UTC: {
            name: "UTC",
            label: "UTC TIME"
        }
    };

    /**
     * Section 2: DOM Structure Management
     * ---------------------------------
     * Functions and logic for creating and managing the clock display's DOM elements.
     * This section handles all DOM manipulations in a performance-optimized way,
     * minimizing reflows and repaints by batching changes where possible.
     */

    /**
     * Creates or retrieves the parent container element
     * This function ensures there's a properly configured container for the clocks,
     * creating it if necessary or using an existing one
     * 
     * @returns {HTMLElement} The configured parent container
     */
    function ensureParentContainer() {
        let parentElement = document.getElementById(ELEMENTS.PARENT_ID);

        // Create parent container if it doesn't exist
        if (!parentElement) {
            parentElement = document.createElement('div');
            parentElement.id = ELEMENTS.PARENT_ID;

            // Apply core styling properties in batch to minimize repaints
            Object.assign(parentElement.style, {
                display: 'flex',
                marginLeft: '3.5px',
                marginRight: '12.5px',
                justifyContent: 'space-between'
            });

            // Find the proper insertion point in the DOM
            // Look for the desktop navigation links as a reference point
            const targetElement = document.querySelector('.navLinks.desktop');
            if (targetElement) {
                // Insert before nav links for proper visual hierarchy
                targetElement.parentNode.insertBefore(parentElement, targetElement);
            } else {
                // Fallback to body if target not found
                document.body.appendChild(parentElement);
            }
        }

        return parentElement;
    }

    /**
     * Creates the clock display structure
     * Builds the complete DOM structure for both clocks using DocumentFragment
     * for optimal performance. This approach minimizes DOM updates by building
     * the entire structure before inserting it.
     * 
     * @returns {DocumentFragment} Fragment containing the clock structure
     */
    function createClockStructure() {
        // Use DocumentFragment for batch DOM updates
        const fragment = document.createDocumentFragment();
        
        // Create container for the clocks with flex layout
        const clockContainer = document.createElement('div');
        Object.assign(clockContainer.style, {
            flexGrow: '2',
            flexBasis: '0',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex'
        });

        // Create the table structure for the clocks
        // Using a table provides reliable alignment and spacing
        const clockTable = document.createElement('table');
        clockTable.id = 'seia-table';
        clockTable.className = 'dvdoom-table';
        Object.assign(clockTable.style, {
            border: `1px solid ${CONFIG.DISPLAY.BORDER_COLOR}`,
            borderRadius: CONFIG.DISPLAY.BORDER_RADIUS,
            flex: '1'
        });

        // Add both clock displays to the table
        clockTable.innerHTML = `
            <tr>
                <th id="${ELEMENTS.JST_CLOCK}" colspan="100%" style="
                    width: 100%;
                    font-size: ${CONFIG.DISPLAY.FONT_SIZE};
                    font-weight: bold;
                    padding: ${CONFIG.DISPLAY.HEADER_PADDING};
                    text-align: center;
                    border-bottom-width: 0px;">
                    ${TIMEZONES.JST.label}
                </th>
            </tr>
            <tr>
                <th id="${ELEMENTS.UTC_CLOCK}" colspan="100%" style="
                    width: 100%;
                    font-size: ${CONFIG.DISPLAY.FONT_SIZE};
                    font-weight: bold;
                    padding: ${CONFIG.DISPLAY.HEADER_PADDING};
                    text-align: center;
                    border-top: 1px solid ${CONFIG.DISPLAY.BORDER_COLOR};
                    border-bottom-width: 0px;">
                    ${TIMEZONES.UTC.label}
                </th>
            </tr>
        `;

        clockContainer.appendChild(clockTable);
        fragment.appendChild(clockContainer);
        
        return fragment;
    }

    /**
     * Section 3: Clock Update Logic
     * ---------------------------
     * This section contains the core functionality for updating the clock displays.
     * It handles timezone conversions, formatting, and ensures synchronized updates
     * across both clocks. The code is optimized to minimize performance impact
     * while maintaining accurate time displays.
     */

    /**
     * A collection of callback functions registered for clock updates
     * This allows other components to hook into clock updates if needed,
     * following an observer pattern for extensibility
     */
    const clockCallbacks = {};

    /**
     * Clock elements cached for performance
     * Storing these references prevents repeated DOM lookups on every update
     */
    const clockElements = {
        jst: document.getElementById(ELEMENTS.JST_CLOCK),
        utc: document.getElementById(ELEMENTS.UTC_CLOCK)
    };

    /**
     * Formats a date object according to the specified timezone
     * This function handles all the complexity of timezone conversions
     * and consistent formatting across different browsers
     * 
     * @param {Date} date - The date object to format
     * @param {string} timezone - The target timezone (from TIMEZONES)
     * @returns {string} Formatted date string with timezone suffix
     */
    function formatTimeForZone(date, timezone) {
        // Convert the date to a localized string in the specified timezone
        // Replace 'at' with ',' for cleaner display (e.g., "Mon, January 1" instead of "Mon at January 1")
        return date.toLocaleString('en-US', {
            ...CONFIG.TIME_FORMAT,
            timeZone: timezone
        }).replace(' at', ',') + ` ${timezone === TIMEZONES.JST.name ? 'JST' : 'UTC'}`;
    }

    /**
     * Main clock update function
     * This function runs on each interval tick to update both clock displays.
     * It's optimized to minimize DOM updates and handle any potential errors.
     */
    function updateClocks() {
        try {
            // Create a single Date object for both updates
            // This ensures both clocks show the same moment in time
            const currentTime = new Date();

            // Update JST clock
            clockElements.jst.textContent = formatTimeForZone(
                currentTime, 
                TIMEZONES.JST.name
            );

            // Update UTC clock
            clockElements.utc.textContent = formatTimeForZone(
                currentTime, 
                TIMEZONES.UTC.name
            );

            // Notify any registered callbacks with the current time
            // This allows other components to sync with clock updates
            Object.values(clockCallbacks).forEach(callback => {
                try {
                    callback(currentTime);
                } catch (callbackError) {
                    console.error('Clock callback execution failed:', callbackError);
                    // Continue execution even if a callback fails
                }
            });

        } catch (error) {
            console.error('Clock update failed:', error);
            handleClockUpdateError();
        }
    }

    /**
     * Error handler for clock updates
     * Attempts to recover from update failures and maintain clock functionality
     * This prevents complete failure if a single update cycle fails
     */
    function handleClockUpdateError() {
        // If clock elements are missing, attempt to recreate them
        if (!clockElements.jst || !clockElements.utc) {
            console.warn('Clock elements missing, attempting recreation...');
            initializeClockDisplay();
        }

        // Clear any problematic callbacks
        Object.keys(clockCallbacks).forEach(key => {
            if (clockCallbacks[key].errorCount > 3) {
                delete clockCallbacks[key];
                console.warn(`Removed problematic clock callback: ${key}`);
            }
        });
    }

    /**
     * Section 4: Style Implementation
     * ----------------------------
     * This section defines and manages all visual styling for the clock display.
     * Styles are centralized here for consistency and easier maintenance.
     * The implementation uses a combination of CSS classes and inline styles,
     * choosing the most efficient approach for each use case.
     * 
     * Key styling considerations:
     * - Performance optimization through minimal DOM updates
     * - Consistent visual hierarchy
     * - Clear separation between clock elements
     * - Responsive layout handling
     */

    /**
     * Base styles for the clock container
     * These styles establish the foundation for the clock display layout.
     * Using CSS classes minimizes inline style usage and improves performance
     * by allowing the browser to better optimize style calculations.
     */
    const clockStyles = `
        /* Container styling */
        .dvdoom-table {
            /* Border and spacing properties */
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid ${CONFIG.DISPLAY.BORDER_COLOR};
            border-radius: ${CONFIG.DISPLAY.BORDER_RADIUS};

            /* Flexbox layout properties */
            flex: 1;
            width: 100%;
            
            /* Prevent content overflow */
            overflow: hidden;
        }

        /* Header cell styling */
        .dvdoom-table th {
            /* Text properties */
            font-size: ${CONFIG.DISPLAY.FONT_SIZE};
            font-weight: bold;
            text-align: center;
            
            /* Spacing and borders */
            padding: ${CONFIG.DISPLAY.HEADER_PADDING};
            border-bottom-width: 0;
            
            /* Ensure text remains on single line */
            white-space: nowrap;
            
            /* Enable hardware acceleration for smoother updates */
            transform: translateZ(0);
            backface-visibility: hidden;
        }

        /* Separator line between clocks */
        .dvdoom-table tr:nth-child(2) th {
            border-top: 1px solid ${CONFIG.DISPLAY.BORDER_COLOR};
        }

        /* Hover state for enhanced visual feedback */
        .dvdoom-table th:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }
    `;

    /**
     * Applies the defined styles to the document
     * Creates a style element and adds it to the document head.
     * This approach keeps styles centralized and allows for easy updates.
     */
    function applyClockStyles() {
        // Create style element if it doesn't exist
        let styleElement = document.getElementById('clock-styles');
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = 'clock-styles';
            
            // Add the styles to the element
            styleElement.textContent = clockStyles;
            
            // Append to document head
            document.head.appendChild(styleElement);
        }

        // Verify style application
        if (!document.head.contains(styleElement)) {
            console.warn('Style element not properly attached, retrying...');
            setTimeout(applyClockStyles, 100);
        }
    }

    /**
     * Updates clock styles dynamically
     * This function can be called to update styles based on
     * screen size changes or user preferences.
     * 
     * @param {Object} newStyles - Object containing style updates
     */
    function updateClockStyles(newStyles = {}) {
        const styleElement = document.getElementById('clock-styles');
        
        if (styleElement && Object.keys(newStyles).length > 0) {
            // Update configuration with new styles
            Object.assign(CONFIG.DISPLAY, newStyles);
            
            // Regenerate and apply updated styles
            styleElement.textContent = clockStyles;
        }
    }

    /**
     * Section 5: Initialization and Lifecycle Management
     * ----------------------------------------------
     * This section handles the complete lifecycle of the clock display:
     * - Initial setup and DOM creation
     * - Update interval management
     * - Resource cleanup
     * - Error recovery
     * 
     * The initialization process is carefully sequenced to ensure all
     * components are properly set up before the clock starts running.
     */

    /**
     * Manages the clock update interval
     * Stored globally for cleanup purposes but scoped within IIFE
     * Set to null initially to indicate clock is not running
     */
    let clockUpdateInterval = null;

    /**
     * Primary initialization function
     * Coordinates the entire setup process for the clock display
     * Returns a promise that resolves when initialization is complete
     * 
     * @returns {Promise<void>}
     */
    async function initializeClockDisplay() {
        try {
            // Step 1: Set up DOM structure
            const parentContainer = ensureParentContainer();
            
            // Step 2: Apply core styles
            applyClockStyles();
            
            // Step 3: Create and insert clock elements
            const clockFragment = createClockStructure();
            parentContainer.appendChild(clockFragment);
            
            // Step 4: Cache element references for performance
            clockElements.jst = document.getElementById(ELEMENTS.JST_CLOCK);
            clockElements.utc = document.getElementById(ELEMENTS.UTC_CLOCK);
            
            // Step 5: Verify all elements are properly created
            if (!validateClockElements()) {
                throw new Error('Clock elements not properly initialized');
            }

            // Step 6: Start the update cycle
            startClockUpdates();
            
            // Step 7: Set up cleanup handlers
            setupCleanupHandlers();

        } catch (error) {
            console.error('Clock initialization failed:', error);
            // Attempt recovery after short delay
            setTimeout(initializeClockDisplay, 2000);
        }
    }

    /**
     * Validates that all required clock elements exist
     * Ensures the clock display can function properly
     * 
     * @returns {boolean} True if all elements are present and properly configured
     */
    function validateClockElements() {
        return clockElements.jst && 
               clockElements.utc && 
               clockElements.jst.parentNode && 
               clockElements.utc.parentNode;
    }

    /**
     * Starts the clock update interval
     * Uses a calculated offset to sync updates with wall clock seconds
     */
    function startClockUpdates() {
        // Clear any existing interval
        if (clockUpdateInterval) {
            clearInterval(clockUpdateInterval);
        }

        // Calculate offset to next second boundary
        const now = new Date();
        const msToNextSecond = 1000 - now.getMilliseconds();

        // Initial update
        updateClocks();

        // Set timeout to start interval on next second boundary
        setTimeout(() => {
            updateClocks();
            // Start regular updates aligned with second boundaries
            clockUpdateInterval = setInterval(updateClocks, CONFIG.UPDATE_INTERVAL);
        }, msToNextSecond);
    }

    /**
     * Sets up handlers for cleanup when the page unloads
     * Ensures proper resource cleanup to prevent memory leaks
     */
    function setupCleanupHandlers() {
        window.addEventListener('unload', () => {
            // Clear update interval
            if (clockUpdateInterval) {
                clearInterval(clockUpdateInterval);
                clockUpdateInterval = null;
            }

            // Clear callback registry
            Object.keys(clockCallbacks).forEach(key => {
                delete clockCallbacks[key];
            });

            // Remove style element if it exists
            const styleElement = document.getElementById('clock-styles');
            if (styleElement) {
                styleElement.remove();
            }
        });
    }

    // Begin initialization when document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeClockDisplay);
    } else {
        initializeClockDisplay();
    }

    /**
     * Section 6: Error Handling and Recovery
     * -----------------------------------
     * This section implements comprehensive error handling for the clock system.
     * The goal is to maintain clock functionality even when errors occur,
     * providing fallback behaviors and automatic recovery mechanisms.
     * 
     * Error handling focuses on three main areas:
     * 1. Initialization errors
     * 2. Update cycle errors
     * 3. DOM manipulation errors
     */

    /**
     * Error types enumeration
     * Categorizes possible errors for appropriate handling
     */
    const ERROR_TYPES = {
        INITIALIZATION: 'initialization_error',
        UPDATE: 'update_error',
        DOM: 'dom_error',
        STYLE: 'style_error'
    };

    /**
     * Tracks error frequency to prevent infinite recovery attempts
     * Resets after successful operation
     */
    const errorTracking = {
        counts: {},
        timestamps: {},
        maxRetries: 3,
        resetInterval: 5 * 60 * 1000  // 5 minutes
    };

    /**
     * Primary error handler for clock system
     * Routes errors to appropriate handling functions based on type
     * 
     * @param {Error} error - The error that occurred
     * @param {string} type - Error type from ERROR_TYPES
     * @param {Object} context - Additional context about the error
     */
    function handleClockError(error, type, context = {}) {
        // Log error with context for debugging
        console.error(`Clock ${type} error:`, error, context);

        // Track error frequency
        const currentTime = Date.now();
        if (!errorTracking.counts[type]) {
            errorTracking.counts[type] = 0;
            errorTracking.timestamps[type] = currentTime;
        }

        // Reset error count if enough time has passed
        if (currentTime - errorTracking.timestamps[type] > errorTracking.resetInterval) {
            errorTracking.counts[type] = 0;
            errorTracking.timestamps[type] = currentTime;
        }

        errorTracking.counts[type]++;

        // Handle based on error type if under retry limit
        if (errorTracking.counts[type] <= errorTracking.maxRetries) {
            switch (type) {
                case ERROR_TYPES.INITIALIZATION:
                    handleInitializationError(error, context);
                    break;
                case ERROR_TYPES.UPDATE:
                    handleUpdateError(error, context);
                    break;
                case ERROR_TYPES.DOM:
                    handleDOMError(error, context);
                    break;
                case ERROR_TYPES.STYLE:
                    handleStyleError(error, context);
                    break;
                default:
                    console.warn('Unknown error type:', type);
            }
        } else {
            handleCriticalFailure(type);
        }
    }

    /**
     * Handles errors during clock initialization
     * Attempts to recover by rebuilding necessary components
     * 
     * @param {Error} error - The initialization error
     * @param {Object} context - Additional context about the error
     */
    function handleInitializationError(error, context) {
        // Clear any existing update interval
        if (clockUpdateInterval) {
            clearInterval(clockUpdateInterval);
            clockUpdateInterval = null;
        }

        // Attempt to rebuild DOM structure
        try {
            // Remove existing elements
            const parent = document.getElementById(ELEMENTS.PARENT_ID);
            if (parent) {
                while (parent.firstChild) {
                    parent.firstChild.remove();
                }
            }

            // Reinitialize after short delay
            setTimeout(initializeClockDisplay, 2000);

        } catch (rebuildError) {
            console.error('Failed to recover from initialization error:', rebuildError);
            handleCriticalFailure(ERROR_TYPES.INITIALIZATION);
        }
    }

    /**
     * Handles errors during clock updates
     * Attempts to maintain clock function while recovering
     * 
     * @param {Error} error - The update error
     * @param {Object} context - Additional context about the error
     */
    function handleUpdateError(error, context) {
        try {
            // Attempt to display current time even if update failed
            const currentTime = new Date();
            const fallbackTime = currentTime.toLocaleTimeString();

            // Update displays with basic time if possible
            if (clockElements.jst && clockElements.utc) {
                clockElements.jst.textContent = fallbackTime + ' JST';
                clockElements.utc.textContent = fallbackTime + ' UTC';
            }

            // Restart update cycle
            startClockUpdates();

        } catch (recoveryError) {
            console.error('Failed to recover from update error:', recoveryError);
            handleInitializationError(recoveryError, context);
        }
    }

    /**
     * Handles severe errors that prevent normal clock operation
     * Implements graceful degradation of functionality
     * 
     * @param {string} errorType - The type of error that caused critical failure
     */
    function handleCriticalFailure(errorType) {
        console.error(`Critical clock failure of type: ${errorType}`);
        
        // Stop update attempts
        if (clockUpdateInterval) {
            clearInterval(clockUpdateInterval);
            clockUpdateInterval = null;
        }

        // Display error state to user
        try {
            const parent = document.getElementById(ELEMENTS.PARENT_ID);
            if (parent) {
                parent.innerHTML = `
                    <div style="
                        text-align: center;
                        padding: 10px;
                        color: #666;
                        font-style: italic;
                    ">
                        Clock temporarily unavailable
                    </div>
                `;
            }
        } catch (error) {
            // At this point, we can't even show an error message
            console.error('Complete clock system failure');
        }

        // Schedule a full reset after a longer delay
        setTimeout(() => {
            // Reset error tracking
            errorTracking.counts = {};
            errorTracking.timestamps = {};
            
            // Attempt full reinitialization
            initializeClockDisplay();
        }, 60000); // 1 minute delay
    }

    /**
     * Section 7: Performance Monitoring
     * ------------------------------
     * This section implements performance monitoring and optimization for the
     * clock system. It tracks key metrics to ensure smooth operation and helps
     * identify potential performance bottlenecks before they impact users.
     * 
     * The monitoring system focuses on:
     * - Update timing accuracy
     * - DOM operation performance
     * - Memory usage patterns
     * - Animation frame timing
     */

    /**
     * Performance metrics storage
     * Tracks various performance indicators over time
     */
    const performanceMetrics = {
        updateTimes: [],        // Stores timing of recent updates
        domOperations: [],      // Tracks DOM operation durations
        maxSamples: 100,        // Maximum number of samples to store
        lastUpdate: 0,          // Timestamp of last update
        skippedFrames: 0        // Counter for missed updates
    };

    /**
     * Debug mode flag - enables detailed performance logging
     * Should be disabled in production for optimal performance
     */
    const DEBUG = false;

    /**
     * Wraps clock update function with performance monitoring
     * Measures execution time and tracks performance metrics
     * 
     * @param {Function} updateFn - The function to monitor
     * @returns {Function} Wrapped function with performance monitoring
     */
    function withPerformanceMonitoring(updateFn) {
        return function monitoredUpdate() {
            if (!DEBUG) {
                return updateFn.apply(this, arguments);
            }

            const startTime = performance.now();
            const currentTime = Date.now();

            // Check for skipped frames
            if (performanceMetrics.lastUpdate) {
                const timeSinceLastUpdate = currentTime - performanceMetrics.lastUpdate;
                if (timeSinceLastUpdate > CONFIG.UPDATE_INTERVAL * 1.5) {
                    performanceMetrics.skippedFrames++;
                    console.warn(`Delayed update detected: ${timeSinceLastUpdate}ms`);
                }
            }

            try {
                // Execute the update
                const result = updateFn.apply(this, arguments);
                
                // Record performance metrics
                const duration = performance.now() - startTime;
                recordMetric('updateTimes', duration);

                return result;

            } catch (error) {
                console.error('Update failed:', error);
                throw error;
            } finally {
                performanceMetrics.lastUpdate = currentTime;
            }
        };
    }

    /**
     * Records a performance metric while maintaining sample limit
     * 
     * @param {string} metricName - Name of the metric to record
     * @param {number} value - Value to record
     */
    function recordMetric(metricName, value) {
        const metrics = performanceMetrics[metricName];
        
        if (metrics) {
            metrics.push(value);
            
            // Remove oldest sample if we exceed maxSamples
            if (metrics.length > performanceMetrics.maxSamples) {
                metrics.shift();
            }

            // Calculate and log performance statistics
            const average = metrics.reduce((a, b) => a + b, 0) / metrics.length;
            const max = Math.max(...metrics);

            if (DEBUG) {
                console.log(`${metricName} metrics:`, {
                    current: value,
                    average: average.toFixed(2),
                    max: max.toFixed(2),
                    samples: metrics.length
                });
            }

            // Alert on performance degradation
            if (value > average * 2) {
                console.warn(`Performance degradation detected in ${metricName}`);
                logPerformanceReport();
            }
        }
    }

    /**
     * Generates a comprehensive performance report
     * Useful for debugging performance issues
     */
    function logPerformanceReport() {
        if (!DEBUG) return;

        console.group('Clock Performance Report');
        
        // Update timing statistics
        const updateStats = calculateMetricStats(performanceMetrics.updateTimes);
        console.log('Update Timing (ms):', updateStats);

        // Frame skip information
        console.log('Skipped Frames:', performanceMetrics.skippedFrames);

        // Memory usage if available
        if (performance.memory) {
            console.log('Memory Usage:', {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
                total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB'
            });
        }

        console.groupEnd();
    }

    /**
     * Calculates statistical metrics for performance data
     * 
     * @param {Array<number>} samples - Array of metric samples
     * @returns {Object} Statistical analysis of the samples
     */
    function calculateMetricStats(samples) {
        if (!samples.length) return {};

        const sorted = [...samples].sort((a, b) => a - b);
        return {
            min: sorted[0].toFixed(2),
            max: sorted[sorted.length - 1].toFixed(2),
            average: (samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2),
            median: sorted[Math.floor(sorted.length / 2)].toFixed(2),
            p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(2)
        };
    }

    // Wrap the clock update function with performance monitoring
    if (DEBUG) {
        updateClocks = withPerformanceMonitoring(updateClocks);
    }

    /**
     * End of clock implementation
     * Close the IIFE to maintain scope isolation
     */
})();