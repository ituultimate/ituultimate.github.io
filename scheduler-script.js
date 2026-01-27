document.addEventListener('DOMContentLoaded', () => {
    // ============================================================= 
    // FIREBASE CONFIG (DÜZELTİLDİ: Çakışma Önleyici Kontrol)
    // ============================================================= 
    const firebaseConfig = {
        apiKey: "AIzaSyBxoBmV6dJqcl6YaVJ8eYiEpDkQ1fB5Pfw",
        authDomain: "ituultimate-7d97f.firebaseapp.com",
        projectId: "ituultimate-7d97f",
        storageBucket: "ituultimate-7d97f.firebasestorage.app",
        messagingSenderId: "1000938340000",
        appId: "1:1000938340000:web:bd00e04ff5e74b1d3e93c5"
    };

    // Eğer Firebase zaten başlatılmadıysa başlat (Hatayı önler)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.firestore();

    // ============================================================= 
    // DOM ELEMENTS & CONSTANTS                                    
    // ============================================================= 
    const subjectDropdownList = document.getElementById('subject-dropdown-list'); 
    const specificCourseSelect = document.getElementById('specific-course-select');
    const crnSectionListContainer = document.getElementById('crn-section-list-container');
    const addedCoursesList = document.getElementById('added-courses-list');
    const subjectSearchInput = document.getElementById('subject-search-input');
    const timeLabelsContainer = document.getElementById('timeLabels');
    const gridContainer = document.getElementById('grid');
    const USER_SCHEDULE_KEY = 'ituUltimateUserSchedule';
    const PANEL_STATE_KEY = 'itu_scheduler_panel_state';

    const schedulerContainer = document.getElementById('scheduler-container');
    const closePanelBtn = document.getElementById('close-panel-btn');
    const openPanelBtn = document.getElementById('open-panel-btn');

    // Bu değişken tüm ders seçimi mantığı için hayati önem taşıyor
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
        localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(isOpen));
    };

    const getUserSchedule = () => JSON.parse(localStorage.getItem(USER_SCHEDULE_KEY)) || [];
    const saveUserSchedule = (schedule) => localStorage.setItem(USER_SCHEDULE_KEY, JSON.stringify(schedule));

    // ==========================================
    // DERSLERİ ÇEK VE GRUPLA (FİNAL VERSİYON)
    // ==========================================
    async function fetchAndGroupCourses() {
        if (!subjectSearchInput || !subjectDropdownList) return;

        try {
            const snapshot = await db.collection('courses').get();
            
            if (snapshot.empty) {
                subjectDropdownList.innerHTML = '<div style="padding:10px; color:red;">Veritabanı boş!</div>';
                return;
            }

            const courses = [];
            snapshot.forEach(doc => courses.push(doc.data()));

            // 1. ADIM: allCoursesNested objesini doldur (Eski kodların çalışması için ŞART)
            // Yapı: { "BLG": { "BLG 101": { "CRN1": [...] } } }
            allCoursesNested = {}; 

            courses.forEach(course => {
                // Güvenli kod ayıklama
                const fullCode = course.code || course.courseCode || course.dersKodu || "";
                if (!fullCode) return;

                const subjectPrefix = fullCode.split(' ')[0].trim(); // "BLG"
                const courseTitle = fullCode; // "BLG 101"

                if (!allCoursesNested[subjectPrefix]) {
                    allCoursesNested[subjectPrefix] = {};
                }
                if (!allCoursesNested[subjectPrefix][courseTitle]) {
                    allCoursesNested[subjectPrefix][courseTitle] = {};
                }
                if (!allCoursesNested[subjectPrefix][courseTitle][course.crn]) {
                    allCoursesNested[subjectPrefix][courseTitle][course.crn] = [];
                }
                allCoursesNested[subjectPrefix][courseTitle][course.crn].push(course);
            });

            // 2. ADIM: Branş Listesini Oluştur
            const subjects = Object.keys(allCoursesNested).sort();
            console.log("Yüklenen Branşlar:", subjects);

            // 3. ADIM: Listeyi Doldurma Fonksiyonu
            const populateList = (filterText = "") => {
                subjectDropdownList.innerHTML = ""; 
                
                const filteredSubjects = subjects.filter(sub => 
                    sub.toUpperCase().includes(filterText.toUpperCase())
                );

                filteredSubjects.forEach(subject => {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    item.textContent = subject;
                    item.style.padding = "10px";
                    item.style.cursor = "pointer";
                    item.style.borderBottom = "1px solid #eee";

                    item.addEventListener('click', () => {
                        subjectSearchInput.value = subject; 
                        toggleDropdown(false);
                        // Seçim yapıldığında eski mantığı tetikle
                        handleSubjectChange(subject);
                    });

                    subjectDropdownList.appendChild(item);
                });

                if (filteredSubjects.length === 0) {
                    subjectDropdownList.innerHTML = '<div style="padding:10px; color:#999;">Sonuç bulunamadı</div>';
                }
            };

            // İlk yükleme
            populateList();

            // Event Listenerlar
            subjectSearchInput.addEventListener('input', (e) => {
                populateList(e.target.value);
                toggleDropdown(true);
                if (e.target.value === "") {
                    specificCourseSelect.disabled = true;
                    specificCourseSelect.innerHTML = '<option value="" disabled selected>Please select a subject first.</option>';
                }
            });

            subjectSearchInput.addEventListener('focus', () => {
                populateList(subjectSearchInput.value);
                toggleDropdown(true);
            });

        } catch (error) {
            console.error("Dersler çekilirken HATA:", error);
            subjectDropdownList.innerHTML = `<div style="color:red; padding:10px;">Hata: ${error.message}</div>`;
        }
    }

    // Yardımcı Fonksiyon: Seçim yapıldığında diğer kutuları güncelle
    const handleSubjectChange = (selectedPrefix) => {
        specificCourseSelect.innerHTML = '<option value="" disabled selected>Select a course</option>';
        specificCourseSelect.disabled = true;
        crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please select a course first.</p>';

        if (selectedPrefix && allCoursesNested[selectedPrefix]) {
            populateSpecificCourseDropdown(selectedPrefix);
        }
    };

    const toggleDropdown = (show) => {
        if (show) subjectDropdownList.classList.add('show'); // CSS'te .show olmayabilir ama display:block JS ile yapılıyor
        else subjectDropdownList.style.display = 'none'; // Garanti kapatma
        
        // Senin CSS'inde .show yoksa manuel kontrol
        subjectDropdownList.style.display = show ? 'block' : 'none';
    };

    const populateSpecificCourseDropdown = (selectedPrefix) => {
        specificCourseSelect.disabled = false;
        specificCourseSelect.innerHTML = '<option value="" disabled selected>Select a course</option>';
        
        const coursesForPrefix = allCoursesNested[selectedPrefix];
        if(!coursesForPrefix) return;

        const sortedCourseTitles = Object.keys(coursesForPrefix).sort();
        
        sortedCourseTitles.forEach(title => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            specificCourseSelect.appendChild(option);
        });
    };

    // --- Display CRN sections ---
    const displayCrnSections = (selectedCourseTitle) => {
        crnSectionListContainer.innerHTML = '';
        const selectedPrefix = subjectSearchInput.value;
        
        if (!allCoursesNested[selectedPrefix] || !allCoursesNested[selectedPrefix][selectedCourseTitle]) {
             crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please re-select the subject.</p>';
             return;
        }

        const crnsForCourse = allCoursesNested[selectedPrefix][selectedCourseTitle];
        const userSchedule = getUserSchedule();

        Object.entries(crnsForCourse).forEach(([crn, courseParts]) => {
            const isAlreadyAdded = courseParts.some(part => userSchedule.some(c => c.id === part.id));

            // Sorting logic
            const dayOrder = { 'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4, 'Cuma': 5 };
            const sortedParts = courseParts.sort((a, b) => {
                const dayA = a.day || '';
                const dayB = b.day || '';
                return (dayOrder[dayA] || 99) - (dayOrder[dayB] || 99);
            });

            const days = sortedParts.map(p => p.day).filter(Boolean).join(', ');
            const times = sortedParts.map(p => `${p.time?.start}-${p.time?.end}`).filter(Boolean).join(', ');
            const locations = sortedParts.map(p => {
                const buildingCode = p.building || '';
                const room = p.classroom || '';
                return room ? `${buildingCode} ${room}`.trim() : buildingCode;
            }).filter(Boolean).join(', ');

            const allInstructors = courseParts.map(p => p.instructor).join(', ');
            const instructors = [...new Set(allInstructors.split(',').map(name => name.trim()).filter(Boolean))].join(', ');

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

    // --- RENDER SCHEDULE (Visual Grid) ---
    const renderSchedule = () => {
        gridContainer.querySelectorAll('.event').forEach(event => event.remove());

        const userSchedule = getUserSchedule();
        if (userSchedule.length === 0) return;

        const coursesByDay = userSchedule.reduce((acc, course) => {
            const day = course.day;
            if (!acc[day]) acc[day] = [];
            acc[day].push(course);
            return acc;
        }, {});

        const dayLeftOffset = { 'Pazartesi': 0, 'Salı': 20, 'Çarşamba': 40, 'Perşembe': 60, 'Cuma': 80 };
        const dayWidth = 20;

        Object.keys(coursesByDay).forEach(day => {
            const dayCourses = coursesByDay[day];
            if (dayCourses.length === 0) return;
            const dayStartLeft = dayLeftOffset[day];
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
                    const groupSize = group.length;
                    const eventWidth = dayWidth / groupSize;
                    const eventLeft = dayStartLeft + (index * eventWidth);

                    const event = document.createElement('div');
                    event.className = `event`;
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
        releaseColor(crn); // Rengi serbest bırak
        saveUserSchedule(userSchedule);
        renderSchedule();
        renderAddedCoursesList();
        
        // Eğer şu an o ders seçiliyse listeyi güncelle
        if(specificCourseSelect.value) {
            displayCrnSections(specificCourseSelect.value);
        }
    };

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
    
    // Dışarı tıklandığında listeyi kapat
    document.addEventListener('click', (e) => {
        if (!subjectSearchInput.contains(e.target) && !subjectDropdownList.contains(e.target)) {
            toggleDropdown(false);
        }
    });

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

    closePanelBtn.addEventListener('click', () => togglePanel(false));
    openPanelBtn.addEventListener('click', () => togglePanel(true));

    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");
    if(hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });
        document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
        }));
    }

    // --- INITIAL LOAD ---
    initializeVisualGrid();
    renderSchedule();
    renderAddedCoursesList();
    
    // Dersleri çek
    fetchAndGroupCourses();

    const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
    if (savedPanelState !== null) {
        const isPanelOpen = JSON.parse(savedPanelState);
        schedulerContainer.style.transition = 'none';
        togglePanel(isPanelOpen);
        setTimeout(() => {
            schedulerContainer.style.transition = '';
        }, 50);
    }
});
