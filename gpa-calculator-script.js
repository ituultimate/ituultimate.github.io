document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const coursesTbody = document.getElementById('courses-tbody');
    const addCourseBtn = document.getElementById('add-course-btn');
    const currentCreditsInput = document.getElementById('current-credits');
    const currentGpaInput = document.getElementById('current-gpa');
    const termGpaBox = document.getElementById('term-gpa');
    const cumulativeGpaBox = document.getElementById('cumulative-gpa');
    const errorMessage = document.getElementById('error-message');

    // --- Grade Values ---
    const gradeValues = {
        'AA': 4.0,
        'BA+': 3.75,
        'BA': 3.5,
        'BB+': 3.25,
        'BB': 3.0,
        'CB+': 2.75,
        'CB': 2.5,
        'CC+': 2.25,
        'CC': 2.0,
        'DC+': 1.75,
        'DC': 1.5,
        'DD+': 1.25,
        'DD': 1.0,
        'FF-VF': 0
    };

    // --- State ---
    let courses = [];
    let courseIdCounter = 0;

    // --- Functions ---
    const createCourseRow = () => {
        const courseId = courseIdCounter++;
        const courseRow = document.createElement('tr');
        courseRow.dataset.courseId = courseId;

        courseRow.innerHTML = `
            <td>
                <input type="text" class="course-name-input" placeholder="Ders Adı">
            </td>
            <td>
                <select class="grade-select">
                    <option value="">Not Seç</option>
                    ${Object.keys(gradeValues).map(grade =>
            `<option value="${grade}">${grade}</option>`
        ).join('')}
                </select>
            </td>
            <td>
                <select class="credit-select">
                    <option value="">Kredi Seç</option>
                    <option value="0.5">0.5</option>
                    <option value="1">1</option>
                    <option value="1.5">1.5</option>
                    <option value="2">2</option>
                    <option value="2.5">2.5</option>
                    <option value="3">3</option>
                    <option value="3.5">3.5</option>
                    <option value="4">4</option>
                    <option value="4.5">4.5</option>
                    <option value="5">5</option>
                    <option value="5.5">5.5</option>
                    <option value="6">6</option>
                    <option value="6.5">6.5</option>
                    <option value="7">7</option>
                    <option value="7.5">7.5</option>
                    <option value="8">8</option>
                </select>
            </td>
            <td>
                <input type="checkbox" class="repeat-checkbox">
            </td>
            <td class="old-grade-cell">
                <select class="old-grade-select">
                    <option value="">Eski Not</option>
                    ${Object.keys(gradeValues).map(grade =>
            `<option value="${grade}">${grade}</option>`
        ).join('')}
                </select>
            </td>
            <td>
                <button class="remove-btn">Kaldır</button>
            </td>
        `;

        // Add event listeners
        const repeatCheckbox = courseRow.querySelector('.repeat-checkbox');
        const oldGradeCell = courseRow.querySelector('.old-grade-cell');
        const removeBtn = courseRow.querySelector('.remove-btn');

        repeatCheckbox.addEventListener('change', () => {
            if (repeatCheckbox.checked) {
                oldGradeCell.classList.add('visible');
            } else {
                oldGradeCell.classList.remove('visible');
            }
            calculateGPA();
        });

        removeBtn.addEventListener('click', () => {
            courseRow.remove();
            courses = courses.filter(c => c.id !== courseId);
            calculateGPA();
        });

        // Add change event listeners to all inputs for automatic recalculation
        const inputs = courseRow.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', calculateGPA);
        });

        return courseRow;
    };

    const addNewCourse = () => {
        const courseRow = createCourseRow();
        coursesTbody.appendChild(courseRow);
        courses.push({ id: courseIdCounter - 1 });
    };

    const calculateGPA = () => {
        // Get current values
        const currentCredits = parseFloat(currentCreditsInput.value) || 0;
        const currentGPA = parseFloat(currentGpaInput.value) || 0;

        // Calculate initial values
        let totalCredits = currentCredits;
        let totalPoints = currentCredits * currentGPA;

        // Calculate term values (for new courses only)
        let termCredits = 0;
        let termPoints = 0;

        // Process each course
        const courseRows = document.querySelectorAll('#courses-tbody tr');
        courseRows.forEach(row => {
            const gradeSelect = row.querySelector('.grade-select');
            const creditSelect = row.querySelector('.credit-select');
            const repeatCheckbox = row.querySelector('.repeat-checkbox');
            const oldGradeSelect = row.querySelector('.old-grade-select');

            const grade = gradeSelect.value;
            const credit = parseFloat(creditSelect.value) || 0;

            if (grade && credit) {
                const gradeValue = gradeValues[grade];

                // Add to term values
                termCredits += credit;
                termPoints += credit * gradeValue;

                // Handle repeat courses
                if (repeatCheckbox.checked && oldGradeSelect.value) {
                    const oldGradeValue = gradeValues[oldGradeSelect.value];

                    // Subtract old values from total
                    totalCredits -= credit;
                    totalPoints -= credit * oldGradeValue;

                    // Add new values to total
                    totalCredits += credit;
                    totalPoints += credit * gradeValue;
                } else {
                    // Just add new values to total
                    totalCredits += credit;
                    totalPoints += credit * gradeValue;
                }
            }
        });

        // Calculate GPAs
        const termGPA = termCredits > 0 ? termPoints / termCredits : 0;
        const cumulativeGPA = totalCredits > 0 ? totalPoints / totalCredits : 0;

        // Update UI
        updateGPABoxes(termGPA, cumulativeGPA);

        // Check for errors
        if (isNaN(termGPA) || isNaN(cumulativeGPA) ||
            termGPA < 0 || termGPA > 4 ||
            cumulativeGPA < 0 || cumulativeGPA > 4) {
            errorMessage.classList.remove('hidden');
        } else {
            errorMessage.classList.add('hidden');
        }
    };

    const updateGPABoxes = (termGPA, cumulativeGPA) => {
        // Update Term GPA
        const termGpaValue = termGpaBox.querySelector('.gpa-value');
        termGpaValue.textContent = termGPA > 0 ? termGPA.toFixed(2) : '-';

        // Update Cumulative GPA
        const cumulativeGpaValue = cumulativeGpaBox.querySelector('.gpa-value');
        cumulativeGpaValue.textContent = cumulativeGPA > 0 ? cumulativeGPA.toFixed(2) : '-';

        // Update styling based on GPA values
        // Term GPA
        termGpaBox.classList.remove('good', 'warning');
        if (termGPA > 0) {
            if (termGPA >= 2.0) {
                termGpaBox.classList.add('good');
            } else {
                termGpaBox.classList.add('warning');
            }
        }

        // Cumulative GPA
        cumulativeGpaBox.classList.remove('good', 'warning');
        if (cumulativeGPA > 0) {
            if (cumulativeGPA >= 2.0) {
                cumulativeGpaBox.classList.add('good');
            } else {
                cumulativeGpaBox.classList.add('warning');
            }
        }
    };

    // --- Event Listeners ---
    addCourseBtn.addEventListener('click', addNewCourse);
    currentCreditsInput.addEventListener('input', calculateGPA);
    currentGpaInput.addEventListener('input', calculateGPA);

    // --- Initial Setup ---
    // Add one course row by default
    addNewCourse();
});