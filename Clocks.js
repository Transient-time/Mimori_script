/**
 * Clock Display for Blue Archive Threads
 * ================================================================================
 * This component displays synchronized JST and UTC time clocks for Blue Archive threads.
 * Handles all timezone conversions and updates the display in real-time with proper
 * error handling and performance optimization.
 * 
 * Features:
 * - Synchronized JST and UTC time displays
 * - Real-time updates with second precision
 * - Error handling and recovery procedures
 * - Memory leak prevention and cleanup
 * 
 * Table of Contents:
 * ====================
 * 1. Configuration and Constants
 *    - Core settings
 *    - Element IDs
 *    - Timezone data
 * 
 * 2. State Management
 *    - Global state
 *    - Element references
 * 
 * 3. DOM Handling
 *    - Container management
 *    - Element creation
 * 
 * 4. Time Functions
 *    - Time formatting
 *    - Clock updates
 * 
 * 5. Error Handling
 *    - Error detection
 *    - Recovery procedures
 * 
 * 6. Initialization
 *    - Startup sequence
 *    - Cleanup handlers
 */

/**
* ========================================
* SECTION 1: CONFIGURATION AND CONSTANTS
* ========================================
* Core configuration settings
* Controls clock behavior and appearance
*/
(async function () {
    const CONFIG = {
        UPDATE_INTERVAL: 1000,
        TIME_FORMAT: {
            hour: "numeric",
            minute: "numeric",
            second: "numeric",
            weekday: "short",
            month: "long",
            day: "numeric",
            hourCycle: 'h23'
        },
        DISPLAY: {
            FONT_SIZE: "18px",
            HEADER_PADDING: "12px",
            BORDER_COLOR: "#ccc",
            BORDER_RADIUS: "5px"
        }
    };

    /**
     * Element ID constants
     * Used for DOM element creation and lookup
     */
    const ELEMENTS = {
        PARENT_ID: "DVDoomParent",
        JST_CLOCK: "clockJST",
        UTC_CLOCK: "clockUTC"
    };

    /**
     * Timezone definitions
     * Uses IANA timezone database names
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
    * ========================================
    * 2. STATE MANAGEMENT
    * ========================================
    * Tracks active update interval
    */
    let clockUpdateInterval = null;

    // Cached element references
    const clockElements = {
        jst: null,
        utc: null
    };

    /**
    * ========================================
    * 3. DOM HANDLING
    * ========================================
    * Creates or retrieves parent container
    * Places container in thread layout
    */
    function ensureParentContainer() {
        let parent = document.getElementById(ELEMENTS.PARENT_ID);

        if (!parent) {
            parent = document.createElement('div');
            parent.id = ELEMENTS.PARENT_ID;

            Object.assign(parent.style, {
                display: 'flex',
                marginLeft: '3.5px',
                marginRight: '12.5px',
                justifyContent: 'space-between'
            });

            const target = document.querySelector('.navLinks.desktop');
            if (target) {
                target.parentNode.insertBefore(parent, target);
            } else {
                document.body.appendChild(parent);
            }
        }

        return parent;
    }

    /**
     * Creates complete clock display structure
     * Uses DocumentFragment for batch DOM updates
     */
    function createClockStructure() {
        const fragment = document.createDocumentFragment();
        const container = document.createElement('div');

        Object.assign(container.style, {
            flexGrow: '2',
            flexBasis: '0',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex'
        });

        container.innerHTML = `
        <table id="seia-table" class="dvdoom-table" style="border: 1px solid ${CONFIG.DISPLAY.BORDER_COLOR}; border-radius: ${CONFIG.DISPLAY.BORDER_RADIUS}; flex: 1;">
            <tr>
                <th id="${ELEMENTS.JST_CLOCK}" colspan="100%" style="width: 100%; font-size: ${CONFIG.DISPLAY.FONT_SIZE}; font-weight: bold; padding: ${CONFIG.DISPLAY.HEADER_PADDING}; text-align: center; border-bottom-width: 0px;">
                    ${TIMEZONES.JST.label}
                </th>
            </tr>
            <tr>
                <th id="${ELEMENTS.UTC_CLOCK}" colspan="100%" style="width: 100%; font-size: ${CONFIG.DISPLAY.FONT_SIZE}; font-weight: bold; padding: ${CONFIG.DISPLAY.HEADER_PADDING}; text-align: center; border-top: 1px solid ${CONFIG.DISPLAY.BORDER_COLOR}; border-bottom-width: 0px;">
                    ${TIMEZONES.UTC.label}
                </th>
            </tr>
        </table>
    `;

        fragment.appendChild(container);
        return fragment;
    }

    /**
    * ========================================
    * 4. TIME FUNCTIONS
    * ========================================
    * Formats time for specified timezone
    * Handles both JST and UTC conversions
    */
    function formatTimeForZone(date, timezone) {
        return date.toLocaleString('en-US', {
            ...CONFIG.TIME_FORMAT,
            timeZone: timezone
        }).replace(' at', ',') + ` ${timezone === TIMEZONES.JST.name ? 'JST' : 'UTC'}`;
    }

    /**
     * Updates both clock displays
     * Uses single timestamp for synchronization
     */
    function updateClocks() {
        try {
            const now = new Date();
            clockElements.jst.textContent = formatTimeForZone(now, TIMEZONES.JST.name);
            clockElements.utc.textContent = formatTimeForZone(now, TIMEZONES.UTC.name);
        } catch (error) {
            console.error('Clock update failed:', error);
            handleClockError();
        }
    }

    /**
     * Starts synchronized clock updates
     * Aligns with second boundaries
     */
    function startClockUpdates() {
        if (clockUpdateInterval) {
            clearInterval(clockUpdateInterval);
        }

        const now = new Date();
        const msToNextSecond = 1000 - now.getMilliseconds();

        updateClocks();
        setTimeout(() => {
            updateClocks();
            clockUpdateInterval = setInterval(updateClocks, CONFIG.UPDATE_INTERVAL);
        }, msToNextSecond);
    }

    /**
    * ========================================
    * 5. ERROR HANDLING
    * ========================================
    * Handles clock update failures
    * Attempts display recovery
    */
    function handleClockError() {
        if (!clockElements.jst || !clockElements.utc) {
            setTimeout(initializeClockDisplay, 2000);
        }
    }

    /**
    * ========================================
    * 6. INITIALIZATION
    * ========================================
    * Initializes complete clock system
    * Sets up displays and starts updates
    */
    async function initializeClockDisplay() {
        try {
            const parent = ensureParentContainer();
            const clockFragment = createClockStructure();
            parent.appendChild(clockFragment);

            clockElements.jst = document.getElementById(ELEMENTS.JST_CLOCK);
            clockElements.utc = document.getElementById(ELEMENTS.UTC_CLOCK);

            if (!clockElements.jst || !clockElements.utc) {
                throw new Error('Clock elements not properly initialized');
            }

            startClockUpdates();
            setupCleanupHandlers();

        } catch (error) {
            console.error('Clock initialization failed:', error);
            setTimeout(initializeClockDisplay, 2000);
        }
    }

    /**
     * Sets up memory leak prevention
     * Cleans up on page unload
     */
    function setupCleanupHandlers() {
        window.addEventListener('unload', () => {
            if (clockUpdateInterval) {
                clearInterval(clockUpdateInterval);
                clockUpdateInterval = null;
            }
        });
    }

    // Initialize clock system
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeClockDisplay);
    } else {
        initializeClockDisplay();
    }
})(); // End of IIFE