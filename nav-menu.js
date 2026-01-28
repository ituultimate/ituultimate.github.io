/**
 * Shared Navigation Menu Script
 * Handles hamburger menu toggle for mobile navigation
 */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });

        document.querySelectorAll(".nav-link").forEach(link => {
            link.addEventListener("click", () => {
                hamburger.classList.remove("active");
                navMenu.classList.remove("active");
            });
        });

        // Handle user dropdown on mobile
        const userDropdown = document.querySelector(".user-dropdown");
        const userEmail = document.querySelector(".user-email");

        if (userDropdown && userEmail) {
            userEmail.addEventListener("click", (e) => {
                // Only toggle dropdown on mobile (when hamburger is visible)
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    e.stopPropagation();
                    userDropdown.classList.toggle("active");
                }
            });
        }
    }
});
