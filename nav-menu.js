/**
 * Shared Navigation Menu Script
 * Handles navbar injection and hamburger menu toggle for mobile navigation
 */

const navbarHTML = `
    <header class="header">
        <nav class="navbar container">
            <a href="/" class="nav-logo">ITU UltiMate</a>
            <ul class="nav-menu">
                <li class="nav-item"><a href="/" class="nav-link">Anasayfa</a></li>
                <li class="nav-item"><a href="/programlayici" class="nav-link">Programlayıcı</a></li>
                <li class="nav-item"><a href="/yts" class="nav-link">Yoklama (YTS)</a></li>
                <li class="nav-item"><a href="/ortalamahesaplayici" class="nav-link">Ortalama</a></li>
                <li class="nav-item nav-dropdown">
                    <span class="nav-dropdown-trigger">
                        Not Defteri <i class="fas fa-chevron-down"></i>
                    </span>
                    <div class="nav-dropdown-content">
                        <a href="/dersnotlari"><i class="fas fa-book"></i> Ders Notları</a>
                        <a href="/dersrehberi"><i class="fas fa-compass"></i> Ders Rehberleri</a>
                        <a href="/dersprogramarsiv"><i class="fas fa-archive"></i> Ders Programı Arşivi</a>
                    </div>
                </li>
                <li class="nav-item nav-dropdown">
                    <span class="nav-dropdown-trigger">
                        Kampüs <i class="fas fa-chevron-down"></i>
                    </span>
                    <div class="nav-dropdown-content">
                        <a href="/ituconnect"><i class="fas fa-comments"></i> ITU Connect</a>
                        <a href="/campus.html"><i class="fas fa-map-marker-alt"></i> Kampüste Gez</a>
                    </div>
                </li>
            </ul>
            <div class="hamburger">
                <span class="bar"></span>
                <span class="bar"></span>
                <span class="bar"></span>
            </div>
        </nav>
    </header>
`;

document.addEventListener('DOMContentLoaded', () => {
    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    if (navbarPlaceholder) {
        navbarPlaceholder.innerHTML = navbarHTML;
    }

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

                // Close user dropdown if open
                const userDropdown = document.querySelector(".user-dropdown");
                if (userDropdown) {
                    userDropdown.classList.remove("active");
                }

                // Close nav dropdowns if open
                document.querySelectorAll(".nav-dropdown.active").forEach(d => {
                    d.classList.remove("active");
                });
            }

            // Reset animation lock after transition completes
            setTimeout(() => {
                isAnimating = false;
            }, 400);
        }

        // Helper function to check if in mobile mode
        function isMobileMode() {
            const isPortraitMobile = window.innerWidth <= 768;
            const isLandscapeSmallHeight = window.innerHeight <= 600 && window.innerWidth <= 1024;
            return isPortraitMobile || isLandscapeSmallHeight;
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
                if (isMobileMode()) {
                    e.preventDefault();
                    e.stopPropagation();
                    userDropdown.classList.toggle("active");
                }
            });
        }

        // Handle nav dropdown on mobile (Not Defteri, etc.)
        document.querySelectorAll(".nav-dropdown").forEach(dropdown => {
            const trigger = dropdown.querySelector(".nav-dropdown-trigger");
            if (trigger) {
                trigger.addEventListener("click", (e) => {
                    if (isMobileMode()) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Close other dropdowns first
                        document.querySelectorAll(".nav-dropdown.active").forEach(d => {
                            if (d !== dropdown) d.classList.remove("active");
                        });
                        dropdown.classList.toggle("active");
                    }
                });
            }
        });

        // Close nav dropdowns when clicking dropdown links on mobile
        document.querySelectorAll(".nav-dropdown-content a").forEach(link => {
            link.addEventListener("click", () => {
                if (isMobileMode()) {
                    toggleMenu(false);
                }
            });
        });

        // Handle orientation changes
        window.addEventListener("orientationchange", () => {
            setTimeout(() => {
                // Close menu if switching to desktop view
                if (!isMobileMode()) {
                    toggleMenu(false);
                }
            }, 100);
        });

        // Handle resize events
        let resizeTimeout;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Close menu if switching to desktop view
                if (!isMobileMode() && navMenu.classList.contains("active")) {
                    toggleMenu(false);
                }
            }, 250);
        });
    }
});
