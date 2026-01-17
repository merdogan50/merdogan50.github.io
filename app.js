/**
 * Course Schedule System v6
 * Standard Layout + AI Workflow + Full JSON Export
 * merdogan50.github.io
 */

const isAdminMode = new URLSearchParams(window.location.search).has('admin');

// Data stores
let programsData = null;
let currentProgram = null;
let settingsData = null;
let sessionsData = null;
let instructorsData = null;
let coursesData = null;
let blocksData = null;
let currentEditSession = null;
let selectedInstructors = [];
let addSelectedInstructors = [];
let selectedCourse = null;
let addSelectedCourse = null;
let weekDates = [];

// DOM elements
const scheduleContainer = document.getElementById('scheduleContainer');
const instructorViewContainer = document.getElementById('instructorViewContainer');
const weekFilter = document.getElementById('weekFilter');
const dateFilter = document.getElementById('dateFilter');
const blockFilter = document.getElementById('blockFilter');
const locationFilter = document.getElementById('locationFilter');
const instructorSearch = document.getElementById('instructorSearch');
const alertsPanel = document.getElementById('alertsPanel');
const alertsList = document.getElementById('alertsList');
const yearSelect = document.getElementById('yearSelect');
const termSelect = document.getElementById('termSelect');
const groupSelect = document.getElementById('groupSelect');

// ==================== INIT ====================

async function init() {
    if (isAdminMode) {
        document.body.classList.add('admin-mode');
        console.log('🔐 Admin mode');
    }

    try {
        await loadAllData();
        setupProgramSelector();
        calculateWeekDates();
        populateFilters();
        renderSchedule();
        setupEventListeners();
        updateSettingsDisplay();
        updateLastUpdate();
    } catch (error) {
        console.error('Init error:', error);
        showError('Error loading data: ' + error.message);
    }
}

async function loadAllData() {
    const [programs, settings, sessions, instructors, courses, blocks] = await Promise.all([
        fetch('data/programs.json').then(r => r.json()),
        fetch('data/settings.json').then(r => r.json()),
        fetch('data/sessions.json').then(r => r.json()),
        fetch('data/instructors.json').then(r => r.json()),
        fetch('data/courses.json').then(r => r.json()),
        fetch('data/blocks.json').then(r => r.json())
    ]);

    // Check localStorage
    const saved = {
        programs: localStorage.getItem('schedulePrograms_v6'),
        settings: localStorage.getItem('scheduleSettings_v6'),
        sessions: localStorage.getItem('scheduleSessions_v6'),
        blocks: localStorage.getItem('scheduleBlocks_v6'),
        instructors: localStorage.getItem('scheduleInstructors_v6'),
        courses: localStorage.getItem('scheduleCourses_v6')
    };

    programsData = saved.programs ? JSON.parse(saved.programs) : programs;
    settingsData = saved.settings ? JSON.parse(saved.settings) : settings;
    sessionsData = saved.sessions ? JSON.parse(saved.sessions) : sessions;
    blocksData = saved.blocks ? JSON.parse(saved.blocks) : blocks;
    instructorsData = saved.instructors ? JSON.parse(saved.instructors) : instructors;
    coursesData = saved.courses ? JSON.parse(saved.courses) : courses;

    currentProgram = programsData.programs[0];
}

function setupProgramSelector() {
    yearSelect.innerHTML = programsData.academicYears.map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = currentProgram?.academicYear || '2025-2026';

    termSelect.innerHTML = programsData.terms.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    termSelect.value = currentProgram?.term || 2;

    updateGroupOptions();
}

function updateGroupOptions() {
    const term = programsData.terms.find(t => t.id === parseInt(termSelect.value));
    if (!term) return;

    groupSelect.innerHTML = term.groups.map(g => `<option value="${g}">Group ${g}</option>`).join('');
    groupSelect.value = currentProgram?.group || term.groups[0];
}

function calculateWeekDates() {
    weekDates = [];
    const startDate = new Date(currentProgram?.startDate || settingsData?.startDate || '2025-09-01');
    const totalWeeks = currentProgram?.totalWeeks || settingsData?.totalWeeks || 14;
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const holidays = currentProgram?.holidays || [];

    for (let w = 0; w < totalWeeks; w++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (w * 7));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 4);

        const dates = weekDays.map((day, d) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + d);
            const dateStr = formatDateISO(dayDate);
            return {
                day,
                date: dateStr,
                display: formatDateDisplay(dayDate),
                isHoliday: holidays.includes(dateStr)
            };
        });

        weekDates.push({
            weekNumber: w + 1,
            startDate: formatDateISO(weekStart),
            endDate: formatDateISO(weekEnd),
            startDisplay: formatDateDisplay(weekStart),
            endDisplay: formatDateDisplay(weekEnd),
            dates
        });
    }
}

function getSessionDate(session) {
    const block = blocksData?.blocks?.find(b => b.id === session.blockId);
    if (!block?.weeks?.length) return null;

    const weekOfBlock = session.weekOfBlock || 1;
    const weekIndex = block.weeks[Math.min(weekOfBlock - 1, block.weeks.length - 1)] - 1;
    if (weekIndex < 0 || weekIndex >= weekDates.length) return null;

    const week = weekDates[weekIndex];
    const dayOfWeek = session.dayOfWeek || 0;
    return week.dates[dayOfWeek] || null;
}

function formatDateISO(date) { return date.toISOString().split('T')[0]; }
function formatDateDisplay(date) { return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`; }

function updateSettingsDisplay() {
    document.getElementById('startDateDisplay').textContent = currentProgram?.startDate ? formatDateDisplay(new Date(currentProgram.startDate)) : '-';
    document.getElementById('totalWeeksDisplay').textContent = currentProgram?.totalWeeks || 14;
}

function populateFilters() {
    weekFilter.innerHTML = '<option value="all">All Weeks</option>';
    weekDates.forEach((week, idx) => {
        weekFilter.innerHTML += `<option value="${idx + 1}">Week ${idx + 1} (${week.startDisplay})</option>`;
    });

    blockFilter.innerHTML = '<option value="all">All Blocks</option>';
    blocksData?.blocks?.forEach(block => {
        blockFilter.innerHTML += `<option value="${block.id}">${block.name}</option>`;
    });

    ['editTime', 'addTime'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = (settingsData?.sessionTimes || []).map(t => `<option value="${t}">${t}</option>`).join('');
    });
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    weekFilter.addEventListener('change', renderSchedule);
    dateFilter.addEventListener('change', renderSchedule);
    blockFilter.addEventListener('change', renderSchedule);
    locationFilter.addEventListener('change', renderSchedule);
    instructorSearch.addEventListener('input', debounce(renderSchedule, 300));
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    yearSelect.addEventListener('change', handleProgramChange);
    termSelect.addEventListener('change', () => { updateGroupOptions(); handleProgramChange(); });
    groupSelect.addEventListener('change', handleProgramChange);

    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    document.getElementById('instructorViewBtn').addEventListener('click', showInstructorView);
    document.getElementById('closeAlerts').addEventListener('click', () => alertsPanel.classList.add('hidden'));
    document.getElementById('closeInstructorView').addEventListener('click', hideInstructorView);
    document.getElementById('instructorViewSearch').addEventListener('input', debounce(renderInstructorList, 300));

    if (isAdminMode) {
        document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
        document.getElementById('blockManagerBtn')?.addEventListener('click', openBlockManager);
        document.getElementById('aiWorkflowBtn')?.addEventListener('click', openAiWorkflow);
        document.getElementById('addSessionBtn')?.addEventListener('click', openAddModal);
        document.getElementById('changeSettingsBtn')?.addEventListener('click', openSettingsModal);
        document.getElementById('importDataBtn')?.addEventListener('click', openImportModal);
        document.getElementById('exportDataBtn')?.addEventListener('click', exportAllData);
        document.getElementById('newProgramBtn')?.addEventListener('click', createNewProgram);

        document.getElementById('settingsForm')?.addEventListener('submit', handleSettingsSave);
        document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
        document.getElementById('addSessionForm')?.addEventListener('submit', handleAddSubmit);

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.import-tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`import${btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1)}Tab`)?.classList.remove('hidden');
            });
        });

        setupSearchDropdown('courseSearchInput', 'courseDropdown', 'course', 'edit');
        setupSearchDropdown('instructorSearchInput', 'instructorDropdown', 'instructor', 'edit');
        setupSearchDropdown('addCourseSearchInput', 'addCourseDropdown', 'course', 'add');
        setupSearchDropdown('addInstructorSearchInput', 'addInstructorDropdown', 'instructor', 'add');
    }
}

function handleProgramChange() {
    const programId = `${yearSelect.value}-T${termSelect.value}-G${groupSelect.value}`;
    currentProgram = programsData.programs.find(p => p.id === programId);

    if (!currentProgram) {
        currentProgram = programsData.programs[0];
    }

    calculateWeekDates();
    populateFilters();
    renderSchedule();
    updateSettingsDisplay();
}

function createNewProgram() {
    const programId = `${yearSelect.value}-T${termSelect.value}-G${groupSelect.value}`;
    if (programsData.programs.some(p => p.id === programId)) {
        showError('This program already exists.');
        return;
    }

    const newProgram = {
        id: programId,
        academicYear: yearSelect.value,
        term: parseInt(termSelect.value),
        termName: termSelect.options[termSelect.selectedIndex].text,
        group: parseInt(groupSelect.value),
        groupName: `Group ${groupSelect.value}`,
        startDate: new Date().toISOString().split('T')[0],
        totalWeeks: 14,
        holidays: [],
        createdAt: new Date().toISOString().split('T')[0],
        isActive: true
    };

    programsData.programs.push(newProgram);
    currentProgram = newProgram;
    saveToLocalStorage();
    calculateWeekDates();
    populateFilters();
    renderSchedule();
    updateSettingsDisplay();
    showSuccess(`New program created: ${programId}`);
}

// ==================== RENDER SCHEDULE (Standard Layout) ====================

function renderSchedule() {
    if (!sessionsData || !blocksData) return;

    const selectedWeek = weekFilter.value;
    const selectedDate = dateFilter.value;
    const selectedBlock = blockFilter.value;
    const selectedLocation = locationFilter.value;
    const searchTerm = instructorSearch.value.toLowerCase().trim();

    scheduleContainer.innerHTML = '';
    const sessionsByWeek = {};

    // Filter sessions for current program
    const programSessions = sessionsData.sessions.filter(s => !s.programId || s.programId === currentProgram?.id);

    programSessions.forEach(session => {
        const dateInfo = getSessionDate(session);
        if (!dateInfo) return;

        const block = blocksData.blocks.find(b => b.id === session.blockId);
        if (!block) return;

        if (selectedBlock !== 'all' && session.blockId !== selectedBlock) return;
        if (selectedLocation !== 'all' && session.location !== selectedLocation) return;
        if (selectedDate && dateInfo.date !== selectedDate) return;

        if (searchTerm) {
            const names = getInstructorNames(session.instructorIds);
            if (!names.toLowerCase().includes(searchTerm)) return;
        }

        const weekOfBlock = session.weekOfBlock || 1;
        const weekNumber = block.weeks[Math.min(weekOfBlock - 1, block.weeks.length - 1)];
        if (selectedWeek !== 'all' && weekNumber !== parseInt(selectedWeek)) return;

        if (!sessionsByWeek[weekNumber]) sessionsByWeek[weekNumber] = {};
        const dayKey = `${dateInfo.date}_${session.location}`;
        if (!sessionsByWeek[weekNumber][dayKey]) {
            sessionsByWeek[weekNumber][dayKey] = {
                day: dateInfo.day,
                date: dateInfo.date,
                display: dateInfo.display,
                location: session.location,
                isHoliday: dateInfo.isHoliday,
                sessions: []
            };
        }
        sessionsByWeek[weekNumber][dayKey].sessions.push(session);
    });

    const weekNumbers = Object.keys(sessionsByWeek).map(Number).sort((a, b) => a - b);

    if (weekNumbers.length === 0) {
        scheduleContainer.innerHTML = '<div class="no-results">No sessions found.</div>';
        return;
    }

    weekNumbers.forEach(weekNum => {
        const weekData = weekDates[weekNum - 1];
        const card = document.createElement('div');
        card.className = 'week-card';

        card.innerHTML = `
            <div class="week-header">
                <span class="week-title">Week ${weekNum}</span>
                <span class="week-date">${weekData?.startDisplay || ''} - ${weekData?.endDisplay || ''}</span>
            </div>
        `;

        const table = document.createElement('table');
        table.className = 'schedule-table';
        table.innerHTML = `
            <thead><tr>
                <th class="col-time">Time</th>
                <th class="col-topic">Lecture/Subject</th>
                <th class="col-instructors">Lecturers</th>
                <th class="col-type">Type</th>
                <th class="col-location">Location</th>
                ${isAdminMode ? '<th class="col-actions"></th>' : ''}
            </tr></thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        const days = Object.values(sessionsByWeek[weekNum]).sort((a, b) => a.date.localeCompare(b.date));

        days.forEach(day => {
            // Day header
            const dayRow = document.createElement('tr');
            dayRow.className = 'day-header' + (day.isHoliday ? ' holiday-row' : '');
            const colSpan = isAdminMode ? 6 : 5;
            dayRow.innerHTML = `<td colspan="${colSpan}">${day.day} - ${day.display} - ${day.location || ''}${day.isHoliday ? ' 🎄 HOLIDAY' : ''}</td>`;
            tbody.appendChild(dayRow);

            if (day.isHoliday) return;

            // Sessions
            const sortedSessions = day.sessions.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
            sortedSessions.forEach(session => {
                tbody.appendChild(createSessionRow(session));
            });
        });

        card.appendChild(table);
        scheduleContainer.appendChild(card);
    });
}

function createSessionRow(session) {
    const row = document.createElement('tr');
    row.dataset.sessionId = session.id;

    const course = coursesData?.courses?.find(c => c.id === session.courseId);
    const courseName = course?.name || session.courseId || '';
    const instructorNames = getInstructorNames(session.instructorIds);
    const typeClass = session.type === 'practice' ? 'practice' : 'lecture';
    const typeLabel = session.type === 'practice' ? 'Practical' : 'Theoretical';

    // Subgroup badge
    let subgroupBadge = '';
    if (session.subgroup && session.subgroup !== 'all') {
        const badgeClass = session.subgroup.toLowerCase();
        subgroupBadge = `<span class="subgroup-badge ${badgeClass}">${session.subgroup}</span>`;
    }

    row.innerHTML = `
        <td class="cell-time">${session.time || ''}</td>
        <td>${escapeHtml(courseName)}${subgroupBadge}</td>
        <td>${formatInstructorTags(instructorNames)}</td>
        <td class="cell-type ${typeClass}">${typeLabel}</td>
        <td class="cell-location">${session.location || ''}</td>
        ${isAdminMode ? `<td><button class="edit-btn" onclick="openEditModal('${session.id}')">✏️</button></td>` : ''}
    `;
    return row;
}

function getInstructorNames(instructorIds) {
    if (!instructorIds || !instructorsData) return '';
    return instructorIds.map(id => {
        const inst = instructorsData.instructors.find(i => i.id === id);
        return inst ? `${inst.title || ''} ${inst.name}`.trim() : id;
    }).join(', ');
}

function formatInstructorTags(names) {
    if (!names) return '<span class="instructor-tag">-</span>';
    return names.split(',').map(n => `<span class="instructor-tag">${escapeHtml(n.trim())}</span>`).join('');
}

function clearFilters() {
    weekFilter.value = 'all';
    dateFilter.value = '';
    blockFilter.value = 'all';
    locationFilter.value = 'all';
    instructorSearch.value = '';
    renderSchedule();
}

// ==================== INSTRUCTOR VIEW ====================

function showInstructorView() {
    scheduleContainer.classList.add('hidden');
    document.querySelector('.program-selector')?.classList.add('hidden');
    document.querySelector('.settings-bar')?.classList.add('hidden');
    document.querySelector('.filters-bar')?.classList.add('hidden');
    instructorViewContainer.classList.remove('hidden');
    renderInstructorList();
}

function hideInstructorView() {
    instructorViewContainer.classList.add('hidden');
    scheduleContainer.classList.remove('hidden');
    document.querySelector('.program-selector')?.classList.remove('hidden');
    document.querySelector('.settings-bar')?.classList.remove('hidden');
    document.querySelector('.filters-bar')?.classList.remove('hidden');
}

function renderInstructorList() {
    const container = document.getElementById('instructorScheduleList');
    const searchTerm = document.getElementById('instructorViewSearch').value.toLowerCase().trim();

    const instructorSessions = {};

    sessionsData?.sessions?.forEach(session => {
        const dateInfo = getSessionDate(session);
        if (!dateInfo) return;
        const course = coursesData?.courses?.find(c => c.id === session.courseId);

        (session.instructorIds || []).forEach(instId => {
            const inst = instructorsData?.instructors?.find(i => i.id === instId);
            const name = inst ? `${inst.title || ''} ${inst.name}`.trim() : instId;

            if (!instructorSessions[name]) instructorSessions[name] = [];
            instructorSessions[name].push({
                date: dateInfo.display,
                time: session.time,
                topic: course?.name || session.courseId,
                location: session.location,
                subgroup: session.subgroup
            });
        });
    });

    let instructors = Object.entries(instructorSessions).sort((a, b) => a[0].localeCompare(b[0], 'tr'));
    if (searchTerm) instructors = instructors.filter(([name]) => name.toLowerCase().includes(searchTerm));

    container.innerHTML = instructors.map(([name, sessions]) => `
        <div class="instructor-card">
            <div class="instructor-card-header">
                <span class="instructor-card-name">${escapeHtml(name)}</span>
                <span class="instructor-card-count">${sessions.length} sessions</span>
            </div>
            <div class="instructor-sessions">
                ${sessions.map(s => `
                    <div class="instructor-session-item">
                        <span class="instructor-session-date">${s.date}</span>
                        <span>${s.time || ''}</span>
                        <span>${escapeHtml(s.topic || '')} ${s.subgroup && s.subgroup !== 'all' ? `(${s.subgroup})` : ''}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('') || '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Enter your name to see your schedule.</p>';
}

// ==================== BLOCK MANAGER ====================

function openBlockManager() {
    renderBlockTable();
    document.getElementById('blockManagerModal').classList.remove('hidden');
}

function closeBlockManager() {
    document.getElementById('blockManagerModal').classList.add('hidden');
}

function renderBlockTable() {
    const tbody = document.getElementById('blockTableBody');
    const sortedBlocks = [...blocksData.blocks].sort((a, b) => a.order - b.order);

    tbody.innerHTML = sortedBlocks.map(block => `
        <tr>
            <td><strong>${block.order}</strong></td>
            <td>${escapeHtml(block.name)}</td>
            <td>Week ${block.weeks?.join(', ') || '-'}</td>
            <td><span class="color-swatch" style="background:${block.color}"></span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editBlock('${block.id}')">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBlock('${block.id}')">×</button>
            </td>
        </tr>
    `).join('');

    document.getElementById('blockOrderInput').value = sortedBlocks.map(b => b.order).join(',');
}

function applyBlockOrder() {
    const input = document.getElementById('blockOrderInput').value;
    const newOrder = input.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));

    if (newOrder.length !== blocksData.blocks.length) {
        showError(`Please enter ${blocksData.blocks.length} numbers separated by commas.`);
        return;
    }

    const sortedBlocks = [...blocksData.blocks].sort((a, b) => a.order - b.order);

    let currentWeek = 1;
    newOrder.forEach((oldOrder, newIdx) => {
        const block = sortedBlocks.find(b => b.order === oldOrder);
        if (block) {
            block.order = newIdx + 1;
            const weekCount = block.weeks?.length || 1;
            block.weeks = Array.from({ length: weekCount }, (_, w) => currentWeek + w);
            currentWeek += weekCount;
        }
    });

    renderBlockTable();
    renderSchedule();
    saveToLocalStorage();
    showSuccess('Block order updated.');
}

function addNewBlock() {
    const name = prompt('Enter new block name:');
    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const maxOrder = Math.max(...blocksData.blocks.map(b => b.order), 0);
    const maxWeek = Math.max(...blocksData.blocks.flatMap(b => b.weeks || []), 0);

    blocksData.blocks.push({
        id, name,
        shortName: name.substring(0, 4),
        weeks: [maxWeek + 1],
        color: `hsl(${Math.random() * 360}, 60%, 50%)`,
        order: maxOrder + 1
    });

    renderBlockTable();
    populateFilters();
    saveToLocalStorage();
    showSuccess(`Block "${name}" added.`);
}

function editBlock(blockId) {
    const block = blocksData.blocks.find(b => b.id === blockId);
    if (!block) return;

    const newName = prompt('Block name:', block.name);
    if (newName) block.name = newName;

    const newWeeks = prompt('Weeks (comma separated):', block.weeks?.join(','));
    if (newWeeks) block.weeks = newWeeks.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));

    renderBlockTable();
    populateFilters();
    renderSchedule();
    saveToLocalStorage();
}

function deleteBlock(blockId) {
    if (!confirm('Delete this block?')) return;
    blocksData.blocks = blocksData.blocks.filter(b => b.id !== blockId);
    renderBlockTable();
    populateFilters();
    renderSchedule();
    saveToLocalStorage();
}

// ==================== AI WORKFLOW ====================

function openAiWorkflow() {
    document.getElementById('aiWorkflowModal').classList.remove('hidden');
}

function closeAiWorkflow() {
    document.getElementById('aiWorkflowModal').classList.add('hidden');
}

function exportForAi() {
    // Create comprehensive JSON with ALL data
    const exportData = {
        _description: "Complete Schedule Data for AI Editing",
        _instructions: "Edit this JSON and import back. Keep the structure intact.",

        program: {
            id: currentProgram?.id,
            academicYear: currentProgram?.academicYear,
            term: currentProgram?.term,
            termName: currentProgram?.termName,
            group: currentProgram?.group,
            groupName: currentProgram?.groupName,
            startDate: currentProgram?.startDate,
            totalWeeks: currentProgram?.totalWeeks,
            holidays: currentProgram?.holidays || []
        },

        weekDates: weekDates.map(w => ({
            weekNumber: w.weekNumber,
            startDate: w.startDate,
            endDate: w.endDate,
            days: w.dates.map(d => ({
                day: d.day,
                date: d.date,
                isHoliday: d.isHoliday
            }))
        })),

        blocks: blocksData.blocks.map(b => ({
            id: b.id,
            name: b.name,
            weeks: b.weeks,
            order: b.order,
            color: b.color
        })),

        instructors: instructorsData.instructors.map(i => ({
            id: i.id,
            name: i.name,
            title: i.title || '',
            department: i.department || ''
        })),

        courses: coursesData.courses.map(c => ({
            id: c.id,
            name: c.name,
            blockId: c.blockId || ''
        })),

        sessions: sessionsData.sessions.filter(s => !s.programId || s.programId === currentProgram?.id).map(s => {
            const dateInfo = getSessionDate(s);
            const course = coursesData.courses.find(c => c.id === s.courseId);
            const instNames = (s.instructorIds || []).map(id => {
                const inst = instructorsData.instructors.find(i => i.id === id);
                return inst ? `${inst.title || ''} ${inst.name}`.trim() : id;
            });

            return {
                id: s.id,
                blockId: s.blockId,
                weekOfBlock: s.weekOfBlock || 1,
                dayOfWeek: s.dayOfWeek,
                dayName: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][s.dayOfWeek] || '',
                date: dateInfo?.date || '',
                time: s.time,
                courseId: s.courseId,
                courseName: course?.name || '',
                instructorIds: s.instructorIds,
                instructorNames: instNames,
                type: s.type,
                subgroup: s.subgroup || 'all',
                location: s.location
            };
        }),

        settings: {
            sessionTimes: settingsData.sessionTimes,
            locations: settingsData.locations,
            courseTypes: settingsData.courseTypes
        },

        _aiNotes: {
            subgroupOptions: ['all', 'A', 'B'],
            typeOptions: ['lecture', 'practice'],
            locationOptions: settingsData.locations,
            dayOfWeekMapping: { 0: 'Monday', 1: 'Tuesday', 2: 'Wednesday', 3: 'Thursday', 4: 'Friday' }
        }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_for_ai_${currentProgram?.id || 'export'}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('JSON exported for AI. Open the file and share with AI.');
}

function importFromAi() {
    const jsonText = document.getElementById('aiJsonInput').value.trim();
    if (!jsonText) {
        showError('Please paste the JSON from AI.');
        return;
    }

    try {
        const data = JSON.parse(jsonText);

        // Import program settings
        if (data.program) {
            const program = programsData.programs.find(p => p.id === data.program.id);
            if (program) {
                Object.assign(program, data.program);
                currentProgram = program;
            }
        }

        // Import blocks
        if (data.blocks) {
            blocksData.blocks = data.blocks.map(b => ({
                id: b.id,
                name: b.name,
                shortName: (b.name || '').substring(0, 4),
                weeks: b.weeks,
                order: b.order,
                color: b.color || '#607D8B'
            }));
        }

        // Import sessions
        if (data.sessions) {
            // Remove old program sessions
            sessionsData.sessions = sessionsData.sessions.filter(s => s.programId && s.programId !== currentProgram?.id);

            // Add new sessions
            data.sessions.forEach(s => {
                sessionsData.sessions.push({
                    id: s.id || `s${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    programId: currentProgram?.id,
                    blockId: s.blockId,
                    weekOfBlock: s.weekOfBlock || 1,
                    dayOfWeek: s.dayOfWeek,
                    time: s.time,
                    courseId: s.courseId,
                    instructorIds: s.instructorIds || [],
                    type: s.type,
                    subgroup: s.subgroup || 'all',
                    location: s.location
                });
            });
        }

        // Import instructors if provided
        if (data.instructors) {
            instructorsData.instructors = data.instructors;
        }

        // Import courses if provided
        if (data.courses) {
            coursesData.courses = data.courses;
        }

        saveToLocalStorage();
        calculateWeekDates();
        populateFilters();
        renderSchedule();
        updateSettingsDisplay();
        closeAiWorkflow();
        showSuccess('Schedule imported from AI successfully!');

    } catch (err) {
        showError('Invalid JSON: ' + err.message);
    }
}

// ==================== MODALS ====================

function openSettingsModal() {
    document.getElementById('semesterStartDate').value = currentProgram?.startDate || '';
    document.getElementById('totalWeeksInput').value = currentProgram?.totalWeeks || 14;
    document.getElementById('holidaysInput').value = (currentProgram?.holidays || []).join(', ');
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function handleSettingsSave(e) {
    e.preventDefault();
    if (!currentProgram) return;

    currentProgram.startDate = document.getElementById('semesterStartDate').value;
    currentProgram.totalWeeks = parseInt(document.getElementById('totalWeeksInput').value);

    const holidaysStr = document.getElementById('holidaysInput').value;
    currentProgram.holidays = holidaysStr ? holidaysStr.split(',').map(d => d.trim()).filter(d => d) : [];

    calculateWeekDates();
    populateFilters();
    renderSchedule();
    updateSettingsDisplay();
    saveToLocalStorage();
    closeSettingsModal();
    showSuccess('Settings saved.');
}

// Edit Modal
function openEditModal(sessionId) {
    const session = sessionsData.sessions.find(s => s.id === sessionId);
    if (!session) return;

    currentEditSession = session;
    document.getElementById('editTime').value = session.time || '';
    document.getElementById('editType').value = session.type || 'lecture';
    document.getElementById('editSubgroup').value = session.subgroup || 'all';
    document.getElementById('editLocation').value = session.location || 'Pendik';

    selectedCourse = coursesData?.courses?.find(c => c.id === session.courseId);
    document.getElementById('selectedCourse').innerHTML = selectedCourse
        ? `<span class="selected-tag">${selectedCourse.name} <button type="button" onclick="clearCourse('edit')">×</button></span>`
        : '';

    selectedInstructors = (session.instructorIds || []).map(id => {
        const inst = instructorsData?.instructors?.find(i => i.id === id);
        return inst || { id, name: id, title: '' };
    });
    renderSelectedInstructors('selectedInstructors', 'edit');

    document.getElementById('courseSearchInput').value = '';
    document.getElementById('instructorSearchInput').value = '';
    document.getElementById('editModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('editModal').classList.add('hidden');
    currentEditSession = null;
    selectedInstructors = [];
    selectedCourse = null;
}

function handleEditSubmit(e) {
    e.preventDefault();
    if (!currentEditSession) return;

    currentEditSession.time = document.getElementById('editTime').value;
    currentEditSession.type = document.getElementById('editType').value;
    currentEditSession.subgroup = document.getElementById('editSubgroup').value;
    currentEditSession.location = document.getElementById('editLocation').value;
    currentEditSession.courseId = selectedCourse?.id || currentEditSession.courseId;
    currentEditSession.instructorIds = selectedInstructors.map(i => i.id);

    saveToLocalStorage();
    renderSchedule();
    closeModal();
}

function deleteSession() {
    if (!currentEditSession || !confirm('Delete this session?')) return;
    sessionsData.sessions = sessionsData.sessions.filter(s => s.id !== currentEditSession.id);
    saveToLocalStorage();
    renderSchedule();
    closeModal();
}

// Add Modal
function openAddModal() {
    const blockSelect = document.getElementById('addBlock');
    blockSelect.innerHTML = blocksData.blocks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

    addSelectedInstructors = [];
    addSelectedCourse = null;
    document.getElementById('addSelectedInstructors').innerHTML = '';
    document.getElementById('addSelectedCourse').innerHTML = '';
    document.getElementById('addCourseSearchInput').value = '';
    document.getElementById('addInstructorSearchInput').value = '';
    document.getElementById('addSessionModal').classList.remove('hidden');
}

function closeAddModal() {
    document.getElementById('addSessionModal').classList.add('hidden');
    addSelectedInstructors = [];
    addSelectedCourse = null;
}

function handleAddSubmit(e) {
    e.preventDefault();

    const newSession = {
        id: `s${Date.now()}`,
        programId: currentProgram?.id,
        blockId: document.getElementById('addBlock').value,
        weekOfBlock: 1,
        dayOfWeek: parseInt(document.getElementById('addDayOfWeek').value),
        time: document.getElementById('addTime').value,
        courseId: addSelectedCourse?.id || '',
        instructorIds: addSelectedInstructors.map(i => i.id),
        type: document.getElementById('addType').value,
        location: document.getElementById('addLocation').value,
        subgroup: document.getElementById('addSubgroup').value
    };

    sessionsData.sessions.push(newSession);
    saveToLocalStorage();
    renderSchedule();
    closeAddModal();
    showSuccess('Session added.');
}

// ==================== DROPDOWNS ====================

function setupSearchDropdown(inputId, dropdownId, type, mode) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.addEventListener('focus', () => { updateDropdown(inputId, dropdownId, type, mode); dropdown.classList.remove('hidden'); });
    input.addEventListener('input', () => updateDropdown(inputId, dropdownId, type, mode));
    document.addEventListener('click', (e) => { if (!e.target.closest('.multi-select-container')) dropdown.classList.add('hidden'); });
}

function updateDropdown(inputId, dropdownId, type, mode) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const searchTerm = input.value.toLowerCase().trim();

    dropdown.innerHTML = '';

    if (type === 'instructor') {
        const current = mode === 'edit' ? selectedInstructors : addSelectedInstructors;
        const filtered = (instructorsData?.instructors || []).filter(inst => {
            const name = `${inst.title || ''} ${inst.name}`.toLowerCase();
            return name.includes(searchTerm) && !current.some(c => c.id === inst.id);
        });

        if (!filtered.length) { dropdown.innerHTML = '<div class="dropdown-item disabled">No results</div>'; return; }

        filtered.slice(0, 15).forEach(inst => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<span>${inst.title || ''} ${inst.name}</span><small>${inst.department || ''}</small>`;
            item.onclick = () => {
                if (mode === 'edit') { selectedInstructors.push(inst); renderSelectedInstructors('selectedInstructors', 'edit'); }
                else { addSelectedInstructors.push(inst); renderSelectedInstructors('addSelectedInstructors', 'add'); }
                input.value = '';
                updateDropdown(inputId, dropdownId, type, mode);
            };
            dropdown.appendChild(item);
        });
    } else if (type === 'course') {
        const filtered = (coursesData?.courses || []).filter(c => c.name.toLowerCase().includes(searchTerm));
        if (!filtered.length) { dropdown.innerHTML = '<div class="dropdown-item disabled">No results</div>'; return; }

        filtered.slice(0, 15).forEach(course => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.innerHTML = `<span>${course.name}</span>`;
            item.onclick = () => {
                if (mode === 'edit') {
                    selectedCourse = course;
                    document.getElementById('selectedCourse').innerHTML = `<span class="selected-tag">${course.name} <button type="button" onclick="clearCourse('edit')">×</button></span>`;
                } else {
                    addSelectedCourse = course;
                    document.getElementById('addSelectedCourse').innerHTML = `<span class="selected-tag">${course.name} <button type="button" onclick="clearCourse('add')">×</button></span>`;
                }
                input.value = '';
                dropdown.classList.add('hidden');
            };
            dropdown.appendChild(item);
        });
    }

    dropdown.classList.remove('hidden');
}

function clearCourse(mode) {
    if (mode === 'edit') { selectedCourse = null; document.getElementById('selectedCourse').innerHTML = ''; }
    else { addSelectedCourse = null; document.getElementById('addSelectedCourse').innerHTML = ''; }
}

function renderSelectedInstructors(containerId, mode) {
    const container = document.getElementById(containerId);
    const list = mode === 'edit' ? selectedInstructors : addSelectedInstructors;
    container.innerHTML = list.map(inst => `
        <span class="selected-instructor-tag">${inst.title || ''} ${inst.name}
            <button type="button" class="remove-btn" onclick="removeInstructor('${inst.id}', '${mode}')">&times;</button>
        </span>
    `).join('');
}

function removeInstructor(instId, mode) {
    if (mode === 'edit') { selectedInstructors = selectedInstructors.filter(i => i.id !== instId); renderSelectedInstructors('selectedInstructors', 'edit'); }
    else { addSelectedInstructors = addSelectedInstructors.filter(i => i.id !== instId); renderSelectedInstructors('addSelectedInstructors', 'add'); }
}

// ==================== IMPORT / EXPORT ====================

function openImportModal() { document.getElementById('importModal').classList.remove('hidden'); }
function closeImportModal() { document.getElementById('importModal').classList.add('hidden'); }

function processImport() {
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    const fileInput = document.getElementById(activeTab === 'courses' ? 'courseFileInput' : 'instructorFileInput');

    if (!fileInput.files.length) { alert('Please select a file'); return; }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);

            if (activeTab === 'instructors') {
                instructorsData.instructors = json.map((row, i) => ({
                    id: `i${String(i + 1).padStart(3, '0')}`,
                    name: row.Name || row.name || row.İsim || '',
                    title: row.Title || row.title || row.Ünvan || '',
                    department: row.Department || row.department || row.Bölüm || ''
                }));
                showSuccess(`Imported ${json.length} instructors.`);
            } else {
                coursesData.courses = json.map((row, i) => ({
                    id: `c${String(i + 1).padStart(3, '0')}`,
                    name: row.Name || row.name || row.Ders || '',
                    blockId: row.Block || row.block || row.Blok || ''
                }));
                showSuccess(`Imported ${json.length} courses.`);
            }

            saveToLocalStorage();
            fileInput.value = '';
            closeImportModal();
        } catch (err) {
            showError('Error reading Excel: ' + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function exportAllData() {
    const data = {
        programs: programsData,
        settings: settingsData,
        blocks: blocksData,
        sessions: sessionsData,
        instructors: instructorsData,
        courses: coursesData
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess('Data exported.');
}

function exportToPdf() {
    weekFilter.value = 'all';
    renderSchedule();
    setTimeout(() => window.print(), 100);
}

// ==================== STORAGE & UTILS ====================

function saveToLocalStorage() {
    localStorage.setItem('schedulePrograms_v6', JSON.stringify(programsData));
    localStorage.setItem('scheduleSettings_v6', JSON.stringify(settingsData));
    localStorage.setItem('scheduleSessions_v6', JSON.stringify(sessionsData));
    localStorage.setItem('scheduleBlocks_v6', JSON.stringify(blocksData));
    localStorage.setItem('scheduleInstructors_v6', JSON.stringify(instructorsData));
    localStorage.setItem('scheduleCourses_v6', JSON.stringify(coursesData));
    updateLastUpdate();
}

function updateLastUpdate() {
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('tr-TR');
}

function showSuccess(msg) {
    alertsList.innerHTML = `<div class="alert-item success">✅ ${msg}</div>`;
    alertsPanel.classList.remove('hidden');
    setTimeout(() => alertsPanel.classList.add('hidden'), 3000);
}

function showError(msg) {
    alertsList.innerHTML = `<div class="alert-item error">❌ ${msg}</div>`;
    alertsPanel.classList.remove('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(fn, wait) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

document.addEventListener('DOMContentLoaded', init);
