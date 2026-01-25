document.addEventListener('DOMContentLoaded', () => {
    // ============================================================= -->
    // FIREBASE CONFIG                                               -->
    // ============================================================= -->
    const firebaseConfig = {
        apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
        authDomain: "ituultimate-7d97f.firebaseapp.com",
        projectId: "ituultimate-7d97f",
        storageBucket: "ituultimate-7d97f.firebasestorage.app",
        messagingSenderId: "1000938340000",
        appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();

    // ============================================================= -->
    // DOM ELEMENTS & CONSTANTS                                       -->
    // ============================================================= -->
    // const subjectPrefixSelect = ... (BUNU SİLİN)
    const subjectDropdownList = document.getElementById('subject-dropdown-list'); // BUNU EKLEYİN
    const specificCourseSelect = document.getElementById('specific-course-select');
    const crnSectionListContainer = document.getElementById('crn-section-list-container');
    const addedCoursesList = document.getElementById('added-courses-list');
    const subjectSearchInput = document.getElementById('subject-search-input');
    const timeLabelsContainer = document.getElementById('timeLabels');
    const gridContainer = document.getElementById('grid');
    const USER_SCHEDULE_KEY = 'ituUltimateUserSchedule';

    const schedulerContainer = document.getElementById('scheduler-container');
    const closePanelBtn = document.getElementById('close-panel-btn');
    const openPanelBtn = document.getElementById('open-panel-btn');

    let allCoursesNested = {};

    // --- Color Management for Visual Grid ---
    const availableColors = ["rgb(252, 161, 241)", "rgb(91, 150, 210)", "rgb(115, 44, 196)", "rgb(135, 147, 61)", "rgb(178, 168, 144)", "rgb(196, 145, 145)", "rgb(53, 118, 161)", "rgb(184, 114, 106)", "rgb(17, 47, 137)", "rgb(27, 176, 139)", "rgb(175, 217, 239)", "rgb(114, 203, 180)"];
    const crnColors = {};
    let remainingColors = [...availableColors];
    function getNextColor() { if (remainingColors.length === 0) remainingColors = [...availableColors]; return remainingColors.shift(); }
    function releaseColor(crn) { if (crnColors[crn]) { remainingColors.push(crnColors[crn]); delete crnColors[crn]; } }

    const togglePanel = (isOpen) => {
        if (isOpen) {
            schedulerContainer.classList.remove('panel-closed');
            openPanelBtn.classList.remove('visible');
        } else {
            schedulerContainer.classList.add('panel-closed');
            openPanelBtn.classList.add('visible');
        }
        // Save the state to localStorage
        localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(isOpen));
    };

    // --- CORE FUNCTIONS ---
    const getUserSchedule = () => JSON.parse(localStorage.getItem(USER_SCHEDULE_KEY)) || [];
    const saveUserSchedule = (schedule) => localStorage.setItem(USER_SCHEDULE_KEY, JSON.stringify(schedule));

    const fetchAndGroupCourses = async () => {
        try {
            const coursesCollection = await db.collection('2526-bahar').get();
            const courses = coursesCollection.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allCoursesNested = courses.reduce((acc, course) => {
                if (!course.code || !course.crn) return acc;
                const prefix = course.code.trim().split(' ')[0];
                const fullCode = course.code.trim();
                const courseName = course.name || 'N/A';
                const courseTitle = `${fullCode} - ${courseName}`;
                const crn = course.crn;
                if (!acc[prefix]) acc[prefix] = {};
                if (!acc[prefix][courseTitle]) acc[prefix][courseTitle] = {};
                if (!acc[prefix][courseTitle][crn]) acc[prefix][courseTitle][crn] = [];
                acc[prefix][courseTitle][crn].push(course);
                return acc;
            }, {});
            const sortedPrefixes = Object.keys(allCoursesNested).sort();
            populateSubjectPrefixDropdown(sortedPrefixes);
        } catch (error) {
            console.error("Error fetching courses: ", error);
            subjectPrefixSelect.innerHTML = '<option value="">Error loading courses</option>';
        }
    };

    // Eski populateSubjectPrefixDropdown fonksiyonunu silin ve bunu yapıştırın:
    const populateSubjectPrefixDropdown = (prefixes) => {
        subjectDropdownList.innerHTML = ''; // Listeyi temizle

        prefixes.forEach(prefix => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.textContent = prefix;

            // Elemana tıklandığında ne olacak?
            item.addEventListener('click', () => {
                subjectSearchInput.value = prefix; // Seçilen dersi inputa yaz
                toggleDropdown(false); // Listeyi kapat
                handleSubjectChange(prefix); // Seçim mantığını tetikle
            });

            subjectDropdownList.appendChild(item);
        });
    };

    // Yardımcı Fonksiyon: Seçim yapıldığında diğer kutuları güncelle
    const handleSubjectChange = (selectedPrefix) => {
        specificCourseSelect.innerHTML = '<option value="" disabled selected>Select a course</option>';
        specificCourseSelect.disabled = true;
        crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please select a course first.</p>';

        if (selectedPrefix) {
            populateSpecificCourseDropdown(selectedPrefix);
        }
    };

    // Yardımcı Fonksiyon: Listeyi aç/kapa
    const toggleDropdown = (show) => {
        if (show) {
            subjectDropdownList.classList.add('show');
        } else {
            subjectDropdownList.classList.remove('show');
        }
    };

    const populateSpecificCourseDropdown = (selectedPrefix) => {
        specificCourseSelect.disabled = false;
        specificCourseSelect.innerHTML = '<option value="" disabled selected>Select a course</option>';
        const coursesForPrefix = allCoursesNested[selectedPrefix];
        const sortedCourseTitles = Object.keys(coursesForPrefix).sort();
        sortedCourseTitles.forEach(title => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            specificCourseSelect.appendChild(option);
        });
    };

    // --- Display CRN sections for a selected course (UPDATED FOR SORTING) ---
    const displayCrnSections = (selectedCourseTitle) => {
        crnSectionListContainer.innerHTML = '';
        const selectedPrefix = subjectSearchInput.value;   // <-- YENİSİ
        const crnsForCourse = allCoursesNested[selectedPrefix][selectedCourseTitle];
        if (!crnsForCourse || Object.keys(crnsForCourse).length === 0) {
            crnSectionListContainer.innerHTML = '<p class="placeholder-text">No sections found for this course.</p>';
            return;
        }

        const userSchedule = getUserSchedule();

        Object.entries(crnsForCourse).forEach(([crn, courseParts]) => {
            const isAlreadyAdded = courseParts.some(part => userSchedule.some(c => c.id === part.id));

            // --- THIS IS THE FIX ---
            // 1. Define the order of the days for sorting
            const dayOrder = { 'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4, 'Cuma': 5 };

            // 2. Sort the course parts based on the day order
            const sortedParts = courseParts.sort((a, b) => {
                const dayA = a.day || '';
                const dayB = b.day || '';
                return (dayOrder[dayA] || 99) - (dayOrder[dayB] || 99);
            });

            // 3. Extract the information in the new, sorted order
            const days = sortedParts.map(p => p.day).filter(Boolean).join(', ');
            const times = sortedParts.map(p => `${p.time?.start}-${p.time?.end}`).filter(Boolean).join(', ');
            const locations = sortedParts.map(p => {
                const buildingCode = p.building || '';
                const room = p.classroom || '';
                return room ? `${buildingCode} ${room}`.trim() : buildingCode;
            }).filter(Boolean).join(', ');

            // Instructors can remain unsorted as they are just a list
            const allInstructors = courseParts.map(p => p.instructor).join(', ');
            const instructors = [...new Set(allInstructors.split(',').map(name => name.trim()).filter(Boolean))].join(', ');
            // --- END OF FIX ---

            const crnSectionItem = document.createElement('div');
            crnSectionItem.className = 'crn-section-item';
            crnSectionItem.innerHTML = `
            <div class="crn-info">
                <strong>${crn} | ${instructors}</strong>
                <span>${days} @ ${times}</span>
                <span>${locations}</span>
            </div>
            <button class="btn btn-primary add-course-btn" data-crn='${crn}' data-course-parts='${JSON.stringify(courseParts)}' ${isAlreadyAdded ? 'disabled' : ''}>
                ${isAlreadyAdded ? 'Added' : 'Add'}
            </button>
        `;
            crnSectionListContainer.appendChild(crnSectionItem);
        });
    };

    // --- RENDER FUNCTIONS ---
    // --- UPDATED Render Schedule Function with Collision Handling ---
    // --- CORRECTED Render Schedule Function with Collision Handling ---
    const renderSchedule = () => {
        // Clear existing events from the grid
        gridContainer.querySelectorAll('.event').forEach(event => event.remove());

        const userSchedule = getUserSchedule();
        if (userSchedule.length === 0) return;

        // --- Step 1: Group courses by day for easier processing ---
        const coursesByDay = userSchedule.reduce((acc, course) => {
            const day = course.day;
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(course);
            return acc;
        }, {});

        // --- Step 2: Define the starting position for each day column ---
        const dayLeftOffset = { 'Pazartesi': 0, 'Salı': 20, 'Çarşamba': 40, 'Perşembe': 60, 'Cuma': 80 };
        const dayWidth = 20; // Each day column is 20% of the grid width

        // --- Step 3: Process each day's courses to handle overlaps ---
        Object.keys(coursesByDay).forEach(day => {
            const dayCourses = coursesByDay[day];
            if (dayCourses.length === 0) return;

            const dayStartLeft = dayLeftOffset[day];

            // --- Step 4: Find all overlapping groups of courses ---
            const processedCourses = new Set();
            const overlapGroups = [];

            dayCourses.forEach(course => {
                if (processedCourses.has(course.id)) return;

                const currentGroup = [course];
                processedCourses.add(course.id);

                let foundNewOverlap = true;
                while (foundNewOverlap) {
                    foundNewOverlap = false;
                    dayCourses.forEach(otherCourse => {
                        if (processedCourses.has(otherCourse.id)) return;

                        const overlaps = currentGroup.some(groupCourse => {
                            const start1 = parseFloat(groupCourse.time.start.replace(':', '.'));
                            const end1 = parseFloat(groupCourse.time.end.replace(':', '.'));
                            const start2 = parseFloat(otherCourse.time.start.replace(':', '.'));
                            const end2 = parseFloat(otherCourse.time.end.replace(':', '.'));
                            return (start1 < end2 && start2 < end1);
                        });

                        if (overlaps) {
                            currentGroup.push(otherCourse);
                            processedCourses.add(otherCourse.id);
                            foundNewOverlap = true;
                        }
                    });
                }
                overlapGroups.push(currentGroup);
            });

            // --- Step 5: Render each group of overlapping courses ---
            overlapGroups.forEach(group => {
                group.sort((a, b) => a.time.start.localeCompare(b.time.start));

                group.forEach((course, index) => {
                    if (!crnColors[course.crn]) crnColors[course.crn] = getNextColor();

                    const [startHour, startMin] = course.time.start.split(':').map(Number);
                    const [endHour, endMin] = course.time.end.split(':').map(Number);
                    const start = startHour + startMin / 60;
                    const end = endHour + endMin / 60;
                    const duration = end - start;
                    const topPosition = (start - 8) * 60;
                    const eventHeight = duration * 60;

                    // --- THE FIX IS HERE ---
                    // Calculate width and left position relative to the day column
                    const groupSize = group.length;
                    const eventWidth = dayWidth / groupSize; // e.g., 20 / 2 = 10%
                    const eventLeft = dayStartLeft + (index * eventWidth); // e.g., 20 + (1 * 10) = 30%

                    const event = document.createElement('div');
                    event.className = `event`; // No longer need day-specific classes
                    event.style.backgroundColor = crnColors[course.crn];
                    event.style.top = `${topPosition}px`;
                    event.style.height = `${eventHeight}px`;
                    event.style.width = `${eventWidth}%`;
                    event.style.left = `${eventLeft}%`;
                    event.style.boxSizing = 'border-box';

                    event.innerHTML = `
    <div class="event-title">${course.code}</div>
    <div class="event-crn">${course.crn}</div>
    <div class="event-time">${course.time.start} - ${course.time.end}</div>
    <div class="event-location">${course.building} ${course.classroom}</div>
                `;
                    gridContainer.appendChild(event);
                });
            });
        });
    };

    const renderAddedCoursesList = () => {
        const userSchedule = getUserSchedule();
        if (userSchedule.length === 0) {
            addedCoursesList.innerHTML = '<li class="placeholder-text">Eklediğin dersler burada görünür.</li>';
            return;
        }
        const scheduleByCrn = userSchedule.reduce((acc, course) => {
            if (!acc[course.crn]) acc[course.crn] = [];
            acc[course.crn].push(course);
            return acc;
        }, {});
        addedCoursesList.innerHTML = '';
        Object.entries(scheduleByCrn).forEach(([crn, courseParts]) => {
            const firstPart = courseParts[0];
            const listItem = document.createElement('li');
            listItem.dataset.crn = crn;
            listItem.innerHTML = `
                <span class="course-info-text"><strong>${firstPart.code}</strong> (${crn}) - ${firstPart.instructor}</span>
                <button class="drop-button" data-crn='${crn}'>Drop</button>
            `;
            addedCoursesList.appendChild(listItem);
        });
    };

    // --- ACTION FUNCTIONS ---
    const addCourseToSchedule = (e) => {
        if (e.target.classList.contains('add-course-btn') && !e.target.disabled) {
            const coursePartsToAdd = JSON.parse(e.target.dataset.courseParts);
            let userSchedule = getUserSchedule();
            coursePartsToAdd.forEach(part => {
                if (!userSchedule.some(c => c.id === part.id)) {
                    userSchedule.push(part);
                }
            });
            saveUserSchedule(userSchedule);
            renderSchedule();
            renderAddedCoursesList();
            e.target.textContent = 'Added';
            e.target.disabled = true;
        }
    };

    const dropCourseByCrn = (crn) => {

        let userSchedule = getUserSchedule();
        userSchedule = userSchedule.filter(c => c.crn !== crn);
        saveUserSchedule(userSchedule);
        renderSchedule();
        renderAddedCoursesList();
        displayCrnSections(specificCourseSelect.value);

    };

    // --- VISUAL GRID INITIALIZATION ---
    function initializeVisualGrid() {
        const startHour = 8; const endHour = 18; const hourHeight = 60;
        const totalHeight = (endHour - startHour) * hourHeight;
        timeLabelsContainer.style.height = `${totalHeight}px`;
        gridContainer.style.height = `${totalHeight}px`;
        for (let i = startHour; i < endHour; i += 0.5) {
            const currentTop = (i - startHour) * hourHeight; const isHalfHour = i % 1 !== 0;
            const timeSlot = document.createElement('div'); timeSlot.className = isHalfHour ? 'time-slot half-hour' : 'time-slot'; timeSlot.style.top = `${currentTop}px`;
            const hourPart = Math.floor(i).toString().padStart(2, '0'); const minPart = isHalfHour ? '30' : '00'; timeSlot.textContent = `${hourPart}:${minPart}`;
            timeLabelsContainer.appendChild(timeSlot);
            const line = document.createElement('div'); line.className = isHalfHour ? 'grid-line half-hour-line' : 'grid-line'; line.style.top = `${currentTop}px`; gridContainer.appendChild(line);
        }
        for (let d = 1; d < 5; d++) {
            const vLine = document.createElement('div'); vLine.className = 'vertical-line'; vLine.style.left = `${d * 20}%`; gridContainer.appendChild(vLine);
        }
    }

    // --- EVENT LISTENERS ---
    /* --- YENİ SEARCH INPUT MANTIĞI --- */

    // 1. Inputa tıklandığında veya odaklanıldığında listeyi aç
    subjectSearchInput.addEventListener('focus', () => {
        // Filtreleme yapmadan tüm listeyi göster veya mevcut aramayı koru
        filterDropdown(subjectSearchInput.value);
        toggleDropdown(true);
    });

    // 2. Yazı yazıldığında listeyi filtrele
    subjectSearchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toUpperCase(); // Büyük harfe çevir
        filterDropdown(searchTerm);
        toggleDropdown(true);

        // Eğer kullanıcı elle geçerli bir şey yazıp sildiyse alt kutuları sıfırla
        if (searchTerm === "") {
            specificCourseSelect.disabled = true;
            specificCourseSelect.innerHTML = '<option value="" disabled selected>Please select a subject first.</option>';
        }
    });

    // 3. Dışarı tıklandığında listeyi kapat
    document.addEventListener('click', (e) => {
        // Eğer tıklanan yer input veya liste değilse kapat
        if (!subjectSearchInput.contains(e.target) && !subjectDropdownList.contains(e.target)) {
            toggleDropdown(false);
        }
    });

    // Yardımcı Fonksiyon: Listeyi kelimeye göre süz
    function filterDropdown(searchTerm) {
        const items = subjectDropdownList.querySelectorAll('.dropdown-item');
        let hasMatch = false;

        items.forEach(item => {
            const text = item.textContent.toUpperCase();
            if (text.includes(searchTerm)) {
                item.style.display = 'block';
                hasMatch = true;
            } else {
                item.style.display = 'none';
            }
        });

        // Hiç eşleşme yoksa listeyi gizleyebiliriz veya "Sonuç yok" diyebiliriz
        // Şimdilik sadece boş görünmesini engellemek yeterli
    }

    specificCourseSelect.addEventListener('change', (e) => {
        const selectedCourseTitle = e.target.value;
        if (selectedCourseTitle) {
            displayCrnSections(selectedCourseTitle);
        } else {
            crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please select a course first.</p>';
        }
    });

    crnSectionListContainer.addEventListener('click', addCourseToSchedule);
    addedCoursesList.addEventListener('click', (e) => {
        if (e.target.classList.contains('drop-button')) {
            const crn = e.target.dataset.crn;
            dropCourseByCrn(crn);
        }
    });

    // --- NEW: Event Listeners for Panel Toggle ---
    closePanelBtn.addEventListener('click', () => togglePanel(false));
    openPanelBtn.addEventListener('click', () => togglePanel(true));

    // --- INITIAL LOAD ---
    initializeVisualGrid();
    renderSchedule();
    renderAddedCoursesList();
    fetchAndGroupCourses();

    // --- NEW: Restore panel state on load ---
    const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
    if (savedPanelState !== null) {
        const isPanelOpen = JSON.parse(savedPanelState);
        // Set initial state without transition
        schedulerContainer.style.transition = 'none';
        togglePanel(isPanelOpen);
        // Re-enable transition after a short delay
        setTimeout(() => {
            schedulerContainer.style.transition = '';
        }, 50);
    }

    // --- HAMBURGER MENU LOGIC ---
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    hamburger.addEventListener("click", () => {
        hamburger.classList.toggle("active");
        navMenu.classList.toggle("active");
    });
    document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
        hamburger.classList.remove("active");
        navMenu.classList.remove("active");
    }));
});