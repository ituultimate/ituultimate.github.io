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

        // Handle user dropdown on mobile
        const userDropdown = document.querySelector(".user-dropdown");
        const userEmail = document.querySelector(".user-email");

        if (userDropdown && userEmail) {
            userEmail.addEventListener("click", (e) => {
                // Only toggle dropdown on mobile (when hamburger is visible)
                if (window.innerWidth <= 768 || (window.innerWidth <= 1024 && window.innerHeight <= 500)) {
                    e.preventDefault();
                    e.stopPropagation();
                    userDropdown.classList.toggle("active");
                }
            });
        }

        // Handle orientation changes
        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                if (window.innerWidth > 768 && window.innerHeight > 500) {
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
                if (window.innerWidth > 768 && window.innerHeight > 500) {
                    // Close menu if switching to desktop view
                    if (navMenu.classList.contains("active")) {
                        toggleMenu(false);
                    }
                }
            }, 250);
        });
    }
});
