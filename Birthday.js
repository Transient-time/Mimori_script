/**
 * Birthday.js - Birthday Display Component for Blue Archive Thread Enhancement
 * =======================================================================
 * 
 * Purpose:
 * --------
 * This module creates and manages a dynamic birthday display component for Blue Archive threads.
 * It shows upcoming student birthdays for the next 7 days in an elegant, horizontal table format with student images and names.
 * 
 * Key Features:
 * -------------
 * - Displays upcoming birthdays for the next 7 days
 * - Shows student profile images with names
 * - Supports multiple character images with automatic cycling
 * - Implements responsive design with horizontal layout
 * - Integrates with both official and custom student data
 * - Handles error states gracefully
 * 
 * Technical Implementation:
 * -----------------------
 * - Uses modern JavaScript async/await patterns
 * - Implements efficient DOM manipulation via DocumentFragment
 * - Features image preloading and caching mechanisms
 * - Uses requestAnimationFrame for smooth image transitions
 * - Includes comprehensive error handling
 * 
 * Dependencies:
 * ------------
 * External APIs:
 * - schaledb.com: Primary source for student data
 * - rentry.org: Source for custom birthday data
 * 
 * DOM Requirements:
 * - Expects/creates a parent container with id "DVDoomParent"
 * - Creates necessary style elements
 * 
 * Version: 4.0.0
 * Last Updated: 2025 January 
 */

// Global namespace protection IIFE with async support
(async function() {
    /**
     * Configuration and Constants
     * --------------------------
     * Central location for all configurable values and constants used throughout the module.
     * This makes it easier to modify behavior without searching through code.
     */
    const CONFIG = {
        // API endpoints
        ENDPOINTS: {
            STUDENT_DATA: 'https://schaledb.com/data/en/students.json',
            CUSTOM_DATA: 'https://rentry.org/dvdoombday/raw'
        },
        // Cache settings
        CACHE: {
            DURATION: 3600000, // 1 hour in milliseconds
            ENABLED: true
        },
        // Animation settings
        ANIMATION: {
            IMAGE_CYCLE_INTERVAL: 5000, // 5 seconds between image changes
            FADE_DURATION: 300 // 300ms fade transition
        },
        // Display settings
        DISPLAY: {
            DAYS_TO_SHOW: 7,
            IMAGE_SIZE: 60 // Size in pixels for student images
        }
    };

    /**
     * Month names for date formatting
     * Used instead of Date.toLocaleString for consistent cross-browser display
     */
    const MONTHS = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    /**
     * Cached data storage
     * Implements a simple caching mechanism to reduce API calls
     */
    const dataCache = new Map();

    /**
     * Style Definitions
     * ----------------
     * Comprehensive styles for the birthday display component.
     * Using template literal for better readability and maintenance.
     */
    const birthdayStyles = `
        .birthday-table-container {
            width: fit-content;
            display: flex;
            align-items: stretch;
            gap: 0;
            margin: 0;
            height: fit-content;
            /* Added for better performance */
            will-change: transform;
            /* Enable hardware acceleration */
            transform: translateZ(0);
        }
        .vertical-header {
            writing-mode: vertical-lr;
            transform: rotate(180deg);
            padding: 0 5px;
            border: 1px solid #ccc;
            border-radius: 0 5px 5px 0;
            border-left: none;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
        .birthday-table {
            border-collapse: separate;
            border-spacing: 0;
            border: 1px solid #ccc;
            border-radius: 0 5px 5px 0;
            overflow: hidden;
            margin: 0;
            width: auto;
            height: auto;
        }
        .birthday-table th, 
        .birthday-table td {
            border-right: 1px solid #ccc;
            border-bottom: 1px solid #ccc;
            white-space: nowrap;
            padding: 8px;
        }
        .birthday-table th:last-child, 
        .birthday-table td:last-child {
            border-right: none;
        }
        .birthday-table tr:last-child td {
            border-bottom: none;
        }
        .birthday-table tr {
            height: auto;
        }
        .image-container {
            display: flex;
            align-items: center;
            justify-content: center;
            height: ${CONFIG.DISPLAY.IMAGE_SIZE}px;
            margin: auto;
            /* Added for smoother image transitions */
            position: relative;
        }
        .image-container img {
            max-width: 100%;
            max-height: 100%;
            display: block;
            /* Added for image transitions */
            transition: opacity ${CONFIG.ANIMATION.FADE_DURATION}ms ease-in-out;
        }
        /* Added for fade transition support */
        .image-container img.fade-out {
            opacity: 0;
        }
        .image-container img.fade-in {
            opacity: 1;
        }
    `;

    /**
     * Utility Functions
     * ================
     * Core helper functions that handle common operations throughout the module.
     */

    /**
     * Adds specified number of days to a date
     * @param {Date} date - The starting date
     * @param {number} days - Number of days to add
     * @returns {Date} New date object with added days
     * 
     * Using Number() constructor for date conversion ensures consistent behavior
     * across browsers compared to the unary plus operator
     */
    function addDays(date, days) {
        const copy = new Date(Number(date));
        copy.setDate(date.getDate() + days);
        return copy;
    }

    /**
     * Enhanced fetch with caching capabilities
     * @param {string} url - The URL to fetch from
     * @param {Object} options - Fetch options
     * @returns {Promise<any>} The parsed JSON response
     * 
     * Implements a caching mechanism to reduce API calls. Cache entries expire
     * after the configured duration to ensure data freshness while maintaining
     * performance benefits.
     */
    async function cachedFetch(url, options = {}) {
        // If caching is disabled, perform regular fetch
        if (!CONFIG.CACHE.ENABLED) {
            const response = await fetch(url, options);
            return response.json();
        }

        const cacheKey = `${url}${JSON.stringify(options)}`;
        const cachedData = dataCache.get(cacheKey);

        // Return cached data if available and not expired
        if (cachedData) {
            const { timestamp, data } = cachedData;
            if (Date.now() - timestamp < CONFIG.CACHE.DURATION) {
                return data;
            }
            // Remove expired cache entry
            dataCache.delete(cacheKey);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            // Store in cache with timestamp
            dataCache.set(cacheKey, {
                timestamp: Date.now(),
                data
            });

            return data;
        } catch (error) {
            console.error(`Failed to fetch data from ${url}:`, error);
            throw error; // Re-throw to handle in calling function
        }
    }

    /**
     * Image preloading functionality
     * @param {Array<string>} imageUrls - Array of image URLs to preload
     * @returns {Promise<void>}
     * 
     * Preloads images to ensure smooth transitions when cycling through
     * multiple character images. Uses Promise.allSettled to continue even
     * if some images fail to load.
     */
    async function preloadImages(imageUrls) {
        const uniqueUrls = [...new Set(imageUrls)]; // Remove duplicates
        
        const loadPromises = uniqueUrls.map(url => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(url);
                img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
                img.src = url;
            });
        });

        try {
            const results = await Promise.allSettled(loadPromises);
            const failedLoads = results.filter(r => r.status === 'rejected');
            
            if (failedLoads.length > 0) {
                console.warn('Some images failed to preload:', 
                    failedLoads.map(f => f.reason.message));
            }
        } catch (error) {
            console.error('Image preloading error:', error);
            // Continue execution even if preloading fails
        }
    }

    /**
     * Data Processing Functions
     * =======================
     * Functions for fetching and processing birthday data from various sources
     */

    /**
     * Fetches and processes birthday data from both official and custom sources
     * @returns {Promise<Object>} Processed birthday data organized by month and day
     * 
     * Combines data from SchaleDB (official) and custom sources, handling
     * overrides and additions. The resulting data structure is optimized for
     * quick lookup when displaying birthdays.
     */
    async function fetchBirthdays() {
        try {
            // Parallel fetch of official and custom data
            const [officialData, customData] = await Promise.all([
                cachedFetch(CONFIG.ENDPOINTS.STUDENT_DATA),
                cachedFetch(CONFIG.ENDPOINTS.CUSTOM_DATA)
            ]);

            // Create a mutable copy of official data for processing
            const processedData = { ...officialData };

            // Process custom data overrides and additions
            for (const customStudent of customData) {
                const studentId = customStudent.Id;
                let targetStudent;

                if (studentId) {
                    // Override existing student data
                    targetStudent = processedData[studentId];
                    if (!targetStudent) {
                        console.warn(`Custom data references nonexistent student ID: ${studentId}`);
                        continue;
                    }
                } else {
                    // Add new custom student
                    const customId = `DVDOOM_${Object.keys(processedData).length}`;
                    processedData[customId] = {};
                    targetStudent = processedData[customId];
                }

                // Apply custom data
                Object.assign(targetStudent, {
                    FamilyName: customStudent.FamilyName,
                    PersonalName: customStudent.PersonalName,
                    BirthDay: customStudent.BirthDay,
                    DirectImage: customStudent.DirectImage
                });
            }

            // Transform into optimized lookup structure
            return Object.values(processedData).reduce((acc, student) => {
                const birthdayMatch = student.BirthDay?.match(/(\d+)\/(\d+)/);
                if (!birthdayMatch) return acc;

                const [, month, day] = birthdayMatch.map(Number);
                
                // Initialize month/day structure if needed
                acc[month] = acc[month] || {};
                acc[month][day] = acc[month][day] || [];

                // Process student data
                const studentData = {
                    name: `${student.FamilyName} ${student.PersonalName}`,
                    images: [student.DirectImage || 
                        `https://schaledb.com/images/student/collection/${student.Id}.webp`
                    ]
                };

                // Check for existing entry to avoid duplicates
                const existingEntry = acc[month][day].find(entry => 
                    entry.name === studentData.name);

                if (existingEntry) {
                    // Add new image if it doesn't exist
                    if (!existingEntry.images.includes(studentData.images[0])) {
                        existingEntry.images.push(studentData.images[0]);
                    }
                } else {
                    acc[month][day].push(studentData);
                }

                return acc;
            }, {});

        } catch (error) {
            console.error('Failed to fetch or process birthday data:', error);
            throw error; // Re-throw for handling in the initialization function
        }
    }

    /**
     * DOM Manipulation and Component Creation
     * =====================================
     * Functions responsible for creating and managing the visual birthday display
     * component. Uses DocumentFragment for optimal performance and batches DOM
     * operations where possible.
     */

    /**
     * Creates or retrieves the parent container for the birthday display
     * @returns {HTMLElement} The DVDoomParent container element
     * 
     * This function ensures the parent container exists and is properly
     * positioned in the DOM hierarchy. It creates the container if needed,
     * maintaining consistent styling and positioning.
     */
    function ensureParentContainer() {
        let dvDoomParent = document.getElementById("DVDoomParent");
        
        if (!dvDoomParent) {
            dvDoomParent = document.createElement('div');
            dvDoomParent.id = "DVDoomParent";
            
            // Apply styles using object assignment for better performance
            Object.assign(dvDoomParent.style, {
                display: 'flex',
                marginLeft: '3.5px',
                marginRight: '12.5px',
                justifyContent: 'space-between'
            });

            // Find appropriate insertion point
            const targetElement = document.querySelector('.navLinks.desktop');
            if (targetElement) {
                targetElement.parentNode.insertBefore(dvDoomParent, targetElement);
            } else {
                // Fallback to body if target not found
                document.body.appendChild(dvDoomParent);
            }
        }

        return dvDoomParent;
    }

    /**
     * Creates the birthday container element
     * @returns {DocumentFragment} Fragment containing the birthday container
     * 
     * Uses DocumentFragment for better performance when adding to DOM.
     * Container is styled for proper alignment and flex behavior.
     */
    function createBirthdayContainer() {
        const fragment = document.createDocumentFragment();
        const container = document.createElement('div');
        
        Object.assign(container.style, {
            flexGrow: '5',
            flexBasis: '0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center'
        });

        fragment.appendChild(container);
        return fragment;
    }

    /**
     * Sets up styles for the birthday component
     * 
     * Creates and adds a style element containing all necessary CSS.
     * Uses a single style element for better performance than inline styles.
     */
    function setupStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = birthdayStyles;
        document.head.appendChild(styleElement);
    }

    /**
     * Creates an image cycling system for student portraits
     * @param {HTMLElement} container - The container element for the images
     * @param {string[]} images - Array of image URLs to cycle through
     * 
     * Implements efficient image cycling using requestAnimationFrame for smooth
     * transitions. Includes fade effects and proper cleanup on disposal.
     */
    function setupImageCycling(container, images) {
        if (images.length <= 1) return;

        let currentIndex = 0;
        let lastUpdate = 0;
        let isTransitioning = false;
        let animationFrameId = null;

        // Preload images for smooth transitions
        preloadImages(images);

        const updateImage = (timestamp) => {
            if (!container.isConnected) {
                // Clean up if container is removed from DOM
                cancelAnimationFrame(animationFrameId);
                return;
            }

            if (!isTransitioning && timestamp - lastUpdate >= CONFIG.ANIMATION.IMAGE_CYCLE_INTERVAL) {
                isTransitioning = true;
                const currentImg = container.querySelector('img');
                const nextIndex = (currentIndex + 1) % images.length;
                
                // Create new image element
                const newImg = new Image();
                newImg.src = images[nextIndex];
                newImg.alt = currentImg.alt;
                newImg.style.opacity = '0';
                newImg.style.position = 'absolute';
                newImg.style.top = '0';
                newImg.style.left = '0';
                
                // Add new image and fade it in
                container.appendChild(newImg);
                requestAnimationFrame(() => {
                    newImg.style.opacity = '1';
                    currentImg.style.opacity = '0';
                    
                    // Clean up after transition
                    setTimeout(() => {
                        currentImg.remove();
                        newImg.style.position = 'static';
                        currentIndex = nextIndex;
                        lastUpdate = timestamp;
                        isTransitioning = false;
                    }, CONFIG.ANIMATION.FADE_DURATION);
                });
            }

            animationFrameId = requestAnimationFrame(updateImage);
        };

        animationFrameId = requestAnimationFrame(updateImage);
    }

    /**
     * Creates the birthday display table
     * @param {Object} birthdays - Processed birthday data
     * @returns {string} HTML string for the birthday table
     * 
     * Generates the HTML structure for displaying upcoming birthdays.
     * Optimized to minimize DOM operations and handle edge cases.
     */
    function createBirthdayTable(birthdays) {
        const baseDate = new Date();
        let tableRows = {
            header: '',
            content: ''
        };

        // Check next 7 days for birthdays
        for (let i = 0; i <= CONFIG.DISPLAY.DAYS_TO_SHOW; i++) {
            const currentDate = addDays(baseDate, i);
            const month = currentDate.getMonth() + 1;
            const day = currentDate.getDate();

            const studentsByBirthday = birthdays[month]?.[day];
            if (studentsByBirthday) {
                // Add header cell
                tableRows.header += `
                    <td style="font-weight: bold; padding: 8px; text-align: center;">
                        ${MONTHS[currentDate.getMonth()]} ${day}
                    </td>`;

                // Add content cell with student information
                tableRows.content += `
                    <td style="font-weight: bold; text-align: center;">
                        ${studentsByBirthday.map(student => `
                            <div style="display: inline-block; padding: 8px;">
                                <div style="position: relative; text-align: justify;">
                                    <center style="white-space: pre;">
                                        ${student.name.replace(' ', '\n')}
                                    </center>
                                    <center class="image-container" 
                                           data-images="${student.images.join(',')}" 
                                           style="width:${CONFIG.DISPLAY.IMAGE_SIZE}px;
                                                  height:${CONFIG.DISPLAY.IMAGE_SIZE}px;">
                                        <img src="${student.images[0]}" 
                                             alt="${student.name}" 
                                             style="width:${CONFIG.DISPLAY.IMAGE_SIZE}px;
                                                    height:${CONFIG.DISPLAY.IMAGE_SIZE}px;">
                                    </center>
                                </div>
                            </div>
                        `).join('')}
                    </td>`;
            }
        }

        // Handle case where no birthdays are found
        if (!tableRows.header) {
            return `
                <td style="font-weight: bold; text-align: center;">
                    <div style="display: inline-block; padding: 8px;">
                        <div style="position: relative; text-align: justify;">
                            <center style="white-space: pre;">
                                No upcoming student birthdays in the next ${CONFIG.DISPLAY.DAYS_TO_SHOW} days
                            </center>
                        </div>
                    </div>
                </td>`;
        }

        return `
            <tr>${tableRows.header}</tr>
            <tr>${tableRows.content}</tr>`;
    }

    /**
     * Initialization and Core Logic
     * ===========================
     * Functions that handle the initialization of the birthday display component
     * and manage its lifecycle. Includes comprehensive error handling and
     * recovery mechanisms.
     */

    /**
     * Main initialization function for the birthday display
     * Orchestrates the entire setup process and handles any errors
     * that occur during initialization.
     */
    async function initBirthdayAndClock() {
        let birthdayContainer = null;
        
        try {
            // Step 1: Set up initial DOM structure
            const parentContainer = ensureParentContainer();
            const containerFragment = createBirthdayContainer();
            birthdayContainer = containerFragment.children[0];
            parentContainer.appendChild(containerFragment);

            // Step 2: Add styles to document
            setupStyles();

            // Step 3: Fetch and process birthday data
            const birthdays = await fetchBirthdays();
            if (!birthdays || Object.keys(birthdays).length === 0) {
                throw new Error('No birthday data available');
            }

            // Step 4: Generate and insert the birthday table HTML
            const tableContent = createBirthdayTable(birthdays);
            const finalHTML = `
                <div class="birthday-table-container">
                    <div class="vertical-header">Student Birthdays</div>
                    <table class="birthday-table">
                        ${tableContent}
                    </table>
                </div>`;

            birthdayContainer.innerHTML = finalHTML;

            // Step 5: Set up image cycling for multi-image students
            setupImageCyclers(birthdayContainer);

        } catch (error) {
            console.error('Failed to initialize birthday display:', error);
            handleInitializationError(birthdayContainer, error);
        }
    }

    /**
     * Sets up image cycling for all applicable student portraits
     * @param {HTMLElement} container - The main container element
     * 
     * Finds all image containers with multiple images and initializes
     * the cycling behavior for each one.
     */
    function setupImageCyclers(container) {
        const imageContainers = container.querySelectorAll('.image-container');
        
        imageContainers.forEach(container => {
            const images = container.dataset.images?.split(',');
            
            if (images?.length > 1) {
                // Remove duplicates and filter out invalid URLs
                const uniqueImages = [...new Set(images)].filter(url => {
                    try {
                        new URL(url);
                        return true;
                    } catch {
                        console.warn(`Invalid image URL skipped: ${url}`);
                        return false;
                    }
                });

                if (uniqueImages.length > 1) {
                    setupImageCycling(container, uniqueImages);
                }
            }
        });
    }

    /**
     * Handles errors during initialization
     * @param {HTMLElement} container - The container element
     * @param {Error} error - The error that occurred
     * 
     * Displays user-friendly error messages and attempts recovery
     * where possible. Also provides detailed logging for debugging.
     */
    function handleInitializationError(container, error) {
        if (!container) return;

        // Define error messages for known error types
        const errorMessages = {
            'Failed to fetch': 'Unable to connect to the server. Please check your internet connection.',
            'No birthday data available': 'Birthday information is temporarily unavailable.',
            default: 'An unexpected error occurred while loading birthday information.'
        };

        // Find appropriate error message
        const message = errorMessages[error.message] || errorMessages.default;

        // Create error display
        container.innerHTML = `
            <div class="birthday-table-container">
                <div class="vertical-header">Student Birthdays</div>
                <table class="birthday-table">
                    <tr>
                        <td style="text-align: center; padding: 20px;">
                            <div style="color: #666;">
                                ${message}<br>
                                <small>The display will automatically retry in a few moments.</small>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>`;

        // Attempt recovery after delay
        setTimeout(() => {
            if (container.isConnected) {  // Check if container is still in DOM
                initBirthdayAndClock();
            }
        }, 30000);  // Retry after 30 seconds
    }

    /**
     * Resource cleanup function
     * 
     * Handles cleanup of any resources or event listeners when the
     * component is removed or the page is unloaded.
     */
    function cleanup() {
        // Cancel all animation frames
        const allContainers = document.querySelectorAll('.image-container');
        allContainers.forEach(container => {
            if (container._animationFrame) {
                cancelAnimationFrame(container._animationFrame);
            }
        });

        // Clear cache
        dataCache.clear();
    }

    // Add cleanup handler
    window.addEventListener('unload', cleanup);

    /**
     * Performance Monitoring
     * ====================
     * Optional monitoring code for debugging performance issues.
     * Only active when DEBUG flag is true.
     */
    const DEBUG = false;

    if (DEBUG) {
        // Performance monitoring wrapper
        const performanceMonitor = (fn, name) => async (...args) => {
            const start = performance.now();
            try {
                return await fn(...args);
            } finally {
                const duration = performance.now() - start;
                console.log(`${name} took ${duration.toFixed(2)}ms`);
            }
        };

        // Wrap main initialization with performance monitoring
        initBirthdayAndClock = performanceMonitor(
            initBirthdayAndClock, 
            'Birthday display initialization'
        );
    }

    // Initialize the birthday display
    initBirthdayAndClock();

})();  // End of IIFE