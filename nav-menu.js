/**
 * Shared Navigation Menu Script
 * Handles hamburger menu toggle for mobile navigation with smooth animations
 */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    let isAnimating = false;

    if (hamburger && navMenu) {
        // Create close button for mobile menu
        const closeBtn = document.createElement('div');
        closeBtn.className = 'menu-close-btn';
        closeBtn.setAttribute('aria-label', 'Close menu');
        closeBtn.style.display = 'none';
        document.body.appendChild(closeBtn);

        // Toggle menu function with smooth animation
        function toggleMenu(show) {
            if (isAnimating) return;
            isAnimating = true;

            if (show) {
                hamburger.classList.add("active");
                navMenu.classList.add("active");
                closeBtn.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                hamburger.classList.remove("active");
                navMenu.classList.remove("active");
                closeBtn.style.display = 'none';
                document.body.style.overflow = '';

                // Close dropdown if open
                const userDropdown = document.querySelector(".user-dropdown");
                if (userDropdown) {
                    userDropdown.classList.remove("active");
                }
            }

            // Reset animation lock after transition completes
            setTimeout(() => {
                isAnimating = false;
            }, 400);
        }

        // Hamburger click handler
        hamburger.addEventListener("click", () => {
            const isOpen = navMenu.classList.contains("active");
            toggleMenu(!isOpen);
        });

        // Close button click handler
        closeBtn.addEventListener("click", () => {
            toggleMenu(false);
        });

        // Close menu when clicking outside
        document.addEventListener("click", (e) => {
            const isOpen = navMenu.classList.contains("active");
            if (isOpen && !navMenu.contains(e.target) && !hamburger.contains(e.target) && !closeBtn.contains(e.target)) {
                toggleMenu(false);
            }
        });

        // Close menu on escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains("active")) {
                toggleMenu(false);
            }
        });

        // Close menu when clicking nav links
        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", () => {
                toggleMenu(false);
            });
        });

        // Helper function to check if in mobile mode
        function isMobileMode() {
            const isPortraitMobile = window.innerWidth <= 768;
            const isLandscapeSmallHeight = window.innerHeight <= 500 && window.matchMedia('(orientation: landscape)').matches;
            return isPortraitMobile || isLandscapeSmallHeight;
        }

        // Handle user dropdown on mobile
        const userDropdown = document.querySelector(".user-dropdown");
        const userEmail = document.querySelector(".user-email");

        if (userDropdown && userEmail) {
            userEmail.addEventListener("click", (e) => {
                // Only toggle dropdown on mobile (when hamburger is visible)
                if (isMobileMode()) {
                    e.preventDefault();
                    e.stopPropagation();
                    userDropdown.classList.toggle("active");
                }
            });
        }

        // Handle orientation changes
        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                if (!isMobileMode()) {
                    // Close menu if switching to desktop view
                    toggleMenu(false);
                }
            }, 100);
        });

        // Handle resize events
        let resizeTimeout;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (!isMobileMode()) {
                    // Close menu and reset display if switching to desktop view
                    if (navMenu.classList.contains("active")) {
                        toggleMenu(false);
                    }
                    // Ensure nav-menu display is reset for desktop
                    navMenu.style.display = '';
                } else {
                    // Ensure nav-menu display is set for mobile
                    navMenu.style.display = '';
                }
            }, 250);
        });
    }
});
