/**
 * Course Scheduler Script (Programlayıcı)
 * Uses modern ES modules with shared Firebase config
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

let allCoursesNested = {};
let currentUser = null;
let currentSchedule = [];

// --- Color Management ---
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

// =============================================================
// DATA MANAGEMENT
// =============================================================

const loadSchedule = async () => {
    if (currentUser) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists() && docSnap.data().schedule) {
                currentSchedule = docSnap.data().schedule;
                localStorage.setItem(USER_SCHEDULE_KEY, JSON.stringify(currentSchedule));
            } else {
                currentSchedule = [];
            }
        } catch (error) {
            console.error("Program çekilirken hata:", error);
            currentSchedule = JSON.parse(localStorage.getItem(USER_SCHEDULE_KEY)) || [];
        }
    } else {
        currentSchedule = JSON.parse(localStorage.getItem(USER_SCHEDULE_KEY)) || [];
    }

    renderSchedule();
    renderAddedCoursesList();
};

const saveSchedule = async (newSchedule) => {
    currentSchedule = newSchedule;
    localStorage.setItem(USER_SCHEDULE_KEY, JSON.stringify(newSchedule));

    if (currentUser) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await setDoc(userDocRef, {
                schedule: newSchedule,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.error("Program kaydedilirken hata:", error);
        }
    }
};

// =============================================================
// FETCH COURSES
// =============================================================
const fetchAndGroupCourses = async () => {
    if (!subjectSearchInput || !subjectDropdownList) return;

    try {
        const coursesCollection = collection(db, '2025-2026-bahar');
        const coursesSnapshot = await getDocs(coursesCollection);

        if (coursesSnapshot.empty) {
            subjectDropdownList.innerHTML = '<div style="padding:10px; color:red;">Veritabanı Boş</div>';
            return;
        }

        const courses = coursesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
        console.log("--- STEP 1: All courses fetched from Firebase ---", courses);

        allCoursesNested = courses.reduce((acc, course) => {
            console.log("--- Processing course ---", course);

            if (!course.crn) {
                console.error(`FILTERING OUT: Course with ID "${course.id}" is missing the 'crn' field.`);
                return acc;
            }

            const codeString = String(course.code || '').trim();
            if (!codeString) {
                console.error(`FILTERING OUT: Course with CRN "${course.crn}" has an empty or invalid 'code' field.`);
                return acc;
            }

            const prefix = codeString.split(' ')[0];
            if (!prefix) {
                console.error(`FILTERING OUT: Course with CRN "${course.crn}" and code "${codeString}" has no prefix.`);
                return acc;
            }

            const fullCode = codeString;
            const courseName = course.name || 'N/A';
            const courseTitle = `${fullCode} - ${courseName}`;
            const crn = course.crn;

            console.log(`--- Adding course: Prefix="${prefix}", Title="${courseTitle}", CRN="${crn}" ---`);

            if (!acc[prefix]) acc[prefix] = {};
            if (!acc[prefix][courseTitle]) acc[prefix][courseTitle] = {};
            if (!acc[prefix][courseTitle][crn]) acc[prefix][courseTitle][crn] = [];

            acc[prefix][courseTitle][crn].push(course);
            return acc;
        }, {});

        console.log("--- STEP 2: Final nested data structure ---", allCoursesNested);

        const sortedPrefixes = Object.keys(allCoursesNested).sort();
        console.log("--- STEP 3: Final list of prefixes for dropdown ---", sortedPrefixes);

        populateSubjectPrefixDropdown(sortedPrefixes);

    } catch (error) {
        console.error("Error fetching courses: ", error);
        subjectDropdownList.innerHTML = `<div style="padding:10px; color:red;">Hata: ${error.message}</div>`;
    }
};

const populateSubjectPrefixDropdown = (prefixes, filterText = "") => {
    subjectDropdownList.innerHTML = '';
    const filtered = prefixes.filter(p => p.toUpperCase().includes(filterText.toUpperCase()));

    filtered.forEach(prefix => {
        const item = document.createElement('div');
        item.className = 'dropdown-item';
        item.textContent = prefix;
        item.addEventListener('click', () => {
            subjectSearchInput.value = prefix;
            toggleDropdown(false);
            handleSubjectChange(prefix);
        });
        subjectDropdownList.appendChild(item);
    });

    if (filtered.length === 0) subjectDropdownList.innerHTML = '<div style="padding:10px; color:#999;">Sonuç yok</div>';
};

const handleSubjectChange = (selectedPrefix) => {
    specificCourseSelect.innerHTML = '<option value="" disabled selected>Ders seçin</option>';
    specificCourseSelect.disabled = true;
    crnSectionListContainer.innerHTML = '<p class="placeholder-text">Önce ders seçmelisiniz</p>';
    if (selectedPrefix) populateSpecificCourseDropdown(selectedPrefix);
};

const toggleDropdown = (show) => {
    if (show) { subjectDropdownList.classList.add('show'); subjectDropdownList.style.display = 'block'; }
    else { subjectDropdownList.classList.remove('show'); subjectDropdownList.style.display = 'none'; }
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

const displayCrnSections = (selectedCourseTitle) => {
    crnSectionListContainer.innerHTML = '';
    const selectedPrefix = subjectSearchInput.value;

    if (!allCoursesNested[selectedPrefix] || !allCoursesNested[selectedPrefix][selectedCourseTitle]) {
        crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please re-select the subject.</p>';
        return;
    }

    const crnsForCourse = allCoursesNested[selectedPrefix][selectedCourseTitle];

    Object.entries(crnsForCourse).forEach(([crn, courseParts]) => {
        const isAlreadyAdded = courseParts.some(part => currentSchedule.some(c => c.id === part.id));

        const dayOrder = { 'Pazartesi': 1, 'Salı': 2, 'Çarşamba': 3, 'Perşembe': 4, 'Cuma': 5 };
        const sortedParts = courseParts.sort((a, b) => (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99));

        const days = sortedParts.map(p => p.day).filter(Boolean).join(', ');
        const times = sortedParts.map(p => `${p.time?.start}-${p.time?.end}`).filter(Boolean).join(', ');
        const locations = sortedParts.map(p => `${p.building || ''} ${p.classroom || ''}`.trim()).filter(Boolean).join(', ');
        const instructors = [...new Set(courseParts.map(p => p.instructor).join(', ').split(',').map(n => n.trim()).filter(Boolean))].join(', ');

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

// --- RENDER SCHEDULE ---
const renderSchedule = () => {
    gridContainer.querySelectorAll('.event').forEach(event => event.remove());

    if (currentSchedule.length === 0) return;

    const coursesByDay = currentSchedule.reduce((acc, course) => {
        if (!acc[course.day]) acc[course.day] = [];
        acc[course.day].push(course);
        return acc;
    }, {});

    const dayLeftOffset = { 'Pazartesi': 0, 'Salı': 20, 'Çarşamba': 40, 'Perşembe': 60, 'Cuma': 80 };
    const dayWidth = 20;

    Object.keys(coursesByDay).forEach(day => {
        const dayCourses = coursesByDay[day];
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
                const eventWidth = dayWidth / group.length;
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
    if (currentSchedule.length === 0) {
        addedCoursesList.innerHTML = '<li class="placeholder-text">Eklediğin dersler burada görünür.</li>';
        return;
    }
    const scheduleByCrn = currentSchedule.reduce((acc, course) => {
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

// --- ACTIONS ---
const addCourseToSchedule = (e) => {
    if (e.target.classList.contains('add-course-btn') && !e.target.disabled) {
        const coursePartsToAdd = JSON.parse(e.target.dataset.courseParts);

        const newSchedule = [...currentSchedule];
        coursePartsToAdd.forEach(part => {
            if (!newSchedule.some(c => c.id === part.id)) {
                newSchedule.push(part);
            }
        });

        saveSchedule(newSchedule);

        e.target.textContent = 'Added';
        e.target.disabled = true;

        renderSchedule();
        renderAddedCoursesList();
    }
};

const dropCourseByCrn = (crn) => {
    const newSchedule = currentSchedule.filter(c => c.crn !== crn);

    releaseColor(crn);
    saveSchedule(newSchedule);

    renderSchedule();
    renderAddedCoursesList();

    if (specificCourseSelect.value) displayCrnSections(specificCourseSelect.value);
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
subjectSearchInput.addEventListener('focus', () => {
    const sortedPrefixes = Object.keys(allCoursesNested).sort();
    populateSubjectPrefixDropdown(sortedPrefixes, subjectSearchInput.value);
    toggleDropdown(true);
});

subjectSearchInput.addEventListener('input', (e) => {
    const sortedPrefixes = Object.keys(allCoursesNested).sort();
    populateSubjectPrefixDropdown(sortedPrefixes, e.target.value);
    toggleDropdown(true);
    if (e.target.value === "") {
        specificCourseSelect.disabled = true;
        specificCourseSelect.innerHTML = '<option value="" disabled selected>Please select a subject first.</option>';
    }
});

document.addEventListener('click', (e) => {
    if (!subjectSearchInput.contains(e.target) && !subjectDropdownList.contains(e.target)) toggleDropdown(false);
});

specificCourseSelect.addEventListener('change', (e) => {
    const selectedCourseTitle = e.target.value;
    if (selectedCourseTitle) displayCrnSections(selectedCourseTitle);
    else crnSectionListContainer.innerHTML = '<p class="placeholder-text">Please select a course first.</p>';
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

// =============================================================
// INITIALIZATION
// =============================================================
initializeVisualGrid();
fetchAndGroupCourses();

// Panel Durumunu Geri Yükle
const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
if (savedPanelState !== null) {
    const isPanelOpen = JSON.parse(savedPanelState);
    schedulerContainer.style.transition = 'none';
    togglePanel(isPanelOpen);
    setTimeout(() => { schedulerContainer.style.transition = ''; }, 50);
}

// KULLANICI GİRİŞ DURUMUNU DİNLE
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Kullanıcı giriş yaptı:", user.email);
        currentUser = user;
    } else {
        console.log("Misafir kullanıcı");
        currentUser = null;
    }
    loadSchedule();
});
