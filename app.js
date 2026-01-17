/**
 * Course Schedule Management System v4
 * Admin/Public Mode with Excel Import
 * maruninternalmedicine.github.io
 */

// Check admin mode from URL
const isAdminMode = new URLSearchParams(window.location.search).has('admin');

// Data stores
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
let currentBlockId = null;

// Calculated dates
let weekDates = [];

// DOM elements
const scheduleContainer = document.getElementById('scheduleContainer');
const instructorViewContainer = document.getElementById('instructorViewContainer');
const weekFilter = document.getElementById('weekFilter');
const blockFilter = document.getElementById('blockFilter');
const locationFilter = document.getElementById('locationFilter');
const instructorSearch = document.getElementById('instructorSearch');
const alertsPanel = document.getElementById('alertsPanel');
const alertsList = document.getElementById('alertsList');
const blockListEl = document.getElementById('blockList');

/**
 * Initialize application
 */
async function init() {
    // Set admin mode on body
    if (isAdminMode) {
        document.body.classList.add('admin-mode');
        console.log('🔐 Admin mode enabled');
    }

    try {
        await loadAllData();
        calculateWeekDates();
        populateFilters();
        if (isAdminMode) {
            renderBlockPanel();
        }
        renderSchedule();
        setupEventListeners();
        updateSettingsDisplay();
        updateLastUpdate();
    } catch (error) {
        console.error('Init error:', error);
        showError('Error loading data: ' + error.message);
    }
}

/**
 * Load all JSON data
 */
async function loadAllData() {
    const [settings, sessions, instructors, courses, blocks] = await Promise.all([
        fetch('data/settings.json').then(r => r.json()),
        fetch('data/sessions.json').then(r => r.json()),
        fetch('data/instructors.json').then(r => r.json()),
        fetch('data/courses.json').then(r => r.json()),
        fetch('data/blocks.json').then(r => r.json())
    ]);

    // Check localStorage for updates (admin)
    const savedSettings = localStorage.getItem('scheduleSettings_v4');
    const savedSessions = localStorage.getItem('scheduleSessions_v4');
    const savedBlocks = localStorage.getItem('scheduleBlocks_v4');
    const savedInstructors = localStorage.getItem('scheduleInstructors_v4');
    const savedCourses = localStorage.getItem('scheduleCourses_v4');

    settingsData = savedSettings ? JSON.parse(savedSettings) : settings;
    sessionsData = savedSessions ? JSON.parse(savedSessions) : sessions;
    blocksData = savedBlocks ? JSON.parse(savedBlocks) : blocks;
    instructorsData = savedInstructors ? JSON.parse(savedInstructors) : instructors;
    coursesData = savedCourses ? JSON.parse(savedCourses) : courses;
}

/**
 * Calculate week dates from start date
 */
function calculateWeekDates() {
    weekDates = [];
    if (!settingsData?.startDate) return;

    const startDate = new Date(settingsData.startDate);
    const totalWeeks = settingsData.totalWeeks || 14;
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (let w = 0; w < totalWeeks; w++) {
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + (w * 7));

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 4);

        const dates = weekDays.map((day, d) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + d);
            return { day, date: formatDateISO(dayDate), display: formatDateDisplay(dayDate) };
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
function formatDateDisplay(date) {
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function updateSettingsDisplay() {
    const startDateEl = document.getElementById('startDateDisplay');
    const totalWeeksEl = document.getElementById('totalWeeksDisplay');
    if (settingsData) {
        startDateEl.textContent = formatDateDisplay(new Date(settingsData.startDate));
        totalWeeksEl.textContent = settingsData.totalWeeks || 14;
    }
}

function populateFilters() {
    weekFilter.innerHTML = '<option value="all">All Weeks</option>';
    weekDates.forEach((week, idx) => {
        const opt = document.createElement('option');
        opt.value = idx + 1;
        opt.textContent = `Week ${idx + 1} (${week.startDisplay})`;
        weekFilter.appendChild(opt);
    });

    blockFilter.innerHTML = '<option value="all">All Blocks</option>';
    blocksData?.blocks?.forEach(block => {
        const opt = document.createElement('option');
        opt.value = block.id;
        opt.textContent = block.name;
        blockFilter.appendChild(opt);
    });

    // Time selects
    ['editTime', 'addTime'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        (settingsData?.sessionTimes || []).forEach(time => {
            const opt = document.createElement('option');
            opt.value = time;
            opt.textContent = time;
            select.appendChild(opt);
        });
    });
}

// ==================== BLOCK PANEL ====================

function renderBlockPanel() {
    if (!blocksData || !blockListEl) return;
    blockListEl.innerHTML = '';

    [...blocksData.blocks].sort((a, b) => a.order - b.order).forEach(block => {
        const tag = document.createElement('div');
        tag.className = 'block-tag';
        tag.style.backgroundColor = block.color;
        tag.draggable = true;
        tag.dataset.blockId = block.id;

        const weeksStr = block.weeks ? `W${block.weeks.join('-')}` : '';
        tag.innerHTML = `<span class="drag-handle">⋮⋮</span> ${block.name} <span class="week-badge">${weeksStr}</span>`;

        tag.addEventListener('dragstart', handleDragStart);
        tag.addEventListener('dragover', handleDragOver);
        tag.addEventListener('drop', handleDrop);
        tag.addEventListener('dragend', handleDragEnd);

        blockListEl.appendChild(tag);
    });
}

let draggedBlock = null;

function handleDragStart(e) {
    draggedBlock = e.target;
    e.target.classList.add('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    const target = e.target.closest('.block-tag');
    if (target && target !== draggedBlock) {
        const rect = target.getBoundingClientRect();
        target.classList.toggle('drag-before', e.clientY < rect.top + rect.height / 2);
        target.classList.toggle('drag-after', e.clientY >= rect.top + rect.height / 2);
    }
}

function handleDrop(e) {
    e.preventDefault();
    const target = e.target.closest('.block-tag');
    if (!target || target === draggedBlock) return;

    const draggedId = draggedBlock.dataset.blockId;
    const targetId = target.dataset.blockId;
    const draggedData = blocksData.blocks.find(b => b.id === draggedId);
    const targetData = blocksData.blocks.find(b => b.id === targetId);
    if (!draggedData || !targetData) return;

    const rect = target.getBoundingClientRect();
    const newOrder = e.clientY < rect.top + rect.height / 2 ? targetData.order : targetData.order + 1;

    reorderBlocks(draggedId, newOrder);
    document.querySelectorAll('.block-tag').forEach(el => el.classList.remove('drag-before', 'drag-after'));
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.block-tag').forEach(el => el.classList.remove('drag-before', 'drag-after'));
}

function reorderBlocks(movedBlockId, newPosition) {
    const movedBlock = blocksData.blocks.find(b => b.id === movedBlockId);
    if (!movedBlock) return;

    blocksData.blocks.sort((a, b) => a.order - b.order);
    const idx = blocksData.blocks.findIndex(b => b.id === movedBlockId);
    blocksData.blocks.splice(idx, 1);
    blocksData.blocks.splice(Math.min(newPosition - 1, blocksData.blocks.length), 0, movedBlock);

    let currentWeek = 1;
    blocksData.blocks.forEach((block, i) => {
        block.order = i + 1;
        const weekCount = block.weeks?.length || 1;
        block.weeks = Array.from({ length: weekCount }, (_, w) => currentWeek + w);
        currentWeek += weekCount;
    });

    renderBlockPanel();
    renderSchedule();
    saveToLocalStorage();
    showSuccess('Block order updated. Sessions reassigned.');
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    weekFilter.addEventListener('change', renderSchedule);
    blockFilter.addEventListener('change', renderSchedule);
    locationFilter.addEventListener('change', renderSchedule);
    instructorSearch.addEventListener('input', debounce(renderSchedule, 300));
    document.getElementById('clearFilters').addEventListener('click', clearFilters);

    document.getElementById('exportPdfBtn').addEventListener('click', exportToPdf);
    document.getElementById('instructorViewBtn').addEventListener('click', showInstructorView);
    document.getElementById('closeAlerts').addEventListener('click', () => alertsPanel.classList.add('hidden'));
    document.getElementById('closeInstructorView').addEventListener('click', hideInstructorView);
    document.getElementById('instructorViewSearch').addEventListener('input', debounce(renderInstructorList, 300));

    // Admin only listeners
    if (isAdminMode) {
        document.getElementById('settingsBtn')?.addEventListener('click', openSettingsModal);
        document.getElementById('blockManagerBtn')?.addEventListener('click', openBlockManager);
        document.getElementById('validateBtn')?.addEventListener('click', validateSchedule);
        document.getElementById('addSessionBtn')?.addEventListener('click', openAddModal);
        document.getElementById('changeStartDate')?.addEventListener('click', openSettingsModal);
        document.getElementById('importDataBtn')?.addEventListener('click', openImportModal);
        document.getElementById('exportDataBtn')?.addEventListener('click', exportAllData);

        document.getElementById('settingsForm')?.addEventListener('submit', handleSettingsSave);
        document.getElementById('editForm')?.addEventListener('submit', handleEditSubmit);
        document.getElementById('addSessionForm')?.addEventListener('submit', handleAddSubmit);

        // Import tabs
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

// ==================== RENDER SCHEDULE ====================

function renderSchedule() {
    if (!sessionsData || !blocksData) return;

    const selectedWeek = weekFilter.value;
    const selectedBlock = blockFilter.value;
    const selectedLocation = locationFilter.value;
    const searchTerm = instructorSearch.value.toLowerCase().trim();

    scheduleContainer.innerHTML = '';
    const sessionsByWeek = {};

    sessionsData.sessions.forEach(session => {
        const dateInfo = getSessionDate(session);
        if (!dateInfo) return;

        const block = blocksData.blocks.find(b => b.id === session.blockId);
        if (!block) return;

        if (selectedBlock !== 'all' && session.blockId !== selectedBlock) return;
        if (selectedLocation !== 'all' && session.location !== selectedLocation) return;

        if (searchTerm) {
            const names = getInstructorNames(session.instructorIds);
            if (!names.toLowerCase().includes(searchTerm)) return;
        }

        const weekOfBlock = session.weekOfBlock || 1;
        const weekNumber = block.weeks[Math.min(weekOfBlock - 1, block.weeks.length - 1)];
        if (selectedWeek !== 'all' && weekNumber !== parseInt(selectedWeek)) return;

        if (!sessionsByWeek[weekNumber]) sessionsByWeek[weekNumber] = {};
        if (!sessionsByWeek[weekNumber][dateInfo.date]) {
            sessionsByWeek[weekNumber][dateInfo.date] = {
                day: dateInfo.day,
                date: dateInfo.date,
                display: dateInfo.display,
                location: session.location,
                sessions: []
            };
        }
        sessionsByWeek[weekNumber][dateInfo.date].sessions.push(session);
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
                <th class="col-instructor">Lecturers</th>
                <th class="col-type">Theoretical/<br>Practical</th>
                <th class="col-location">Location</th>
                ${isAdminMode ? '<th class="col-actions"></th>' : ''}
            </tr></thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        const days = Object.values(sessionsByWeek[weekNum]).sort((a, b) => a.date.localeCompare(b.date));

        days.forEach(day => {
            const dayRow = document.createElement('tr');
            dayRow.className = 'day-header';
            dayRow.innerHTML = `<td colspan="${isAdminMode ? 6 : 5}">${day.day} - ${day.display} - ${day.location || ''}</td>`;
            tbody.appendChild(dayRow);

            day.sessions.sort((a, b) => (a.time || '').localeCompare(b.time || '')).forEach(session => {
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
    const typeDisplay = session.type === 'practice' ? 'Practical' : 'Theoretical';
    const typeClass = session.type === 'practice' ? 'practice' : 'lecture';
    const locationClass = session.location === 'Pendik' ? 'location-pendik' : 'location-basibuyuk';

    row.innerHTML = `
        <td class="cell-time">${session.time || ''}</td>
        <td class="cell-topic">${escapeHtml(courseName)}</td>
        <td class="cell-instructor">${formatInstructorTags(instructorNames)}</td>
        <td class="cell-type ${typeClass}">${typeDisplay}</td>
        <td><span class="cell-location ${locationClass}">${session.location || ''}</span></td>
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
    return names.split(',').map(n => `<span class="instructor-tag" title="${escapeHtml(n.trim())}">${escapeHtml(n.trim())}</span>`).join('');
}

function clearFilters() {
    weekFilter.value = 'all';
    blockFilter.value = 'all';
    locationFilter.value = 'all';
    instructorSearch.value = '';
    renderSchedule();
}

// ==================== INSTRUCTOR VIEW ====================

function showInstructorView() {
    scheduleContainer.classList.add('hidden');
    document.querySelector('.block-panel')?.classList.add('hidden');
    document.querySelector('.filters-bar')?.classList.add('hidden');
    document.querySelector('.settings-bar')?.classList.add('hidden');
    instructorViewContainer.classList.remove('hidden');
    renderInstructorList();
}

function hideInstructorView() {
    instructorViewContainer.classList.add('hidden');
    scheduleContainer.classList.remove('hidden');
    document.querySelector('.block-panel')?.classList.remove('hidden');
    document.querySelector('.filters-bar')?.classList.remove('hidden');
    document.querySelector('.settings-bar')?.classList.remove('hidden');
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
                topic: course?.name || session.courseId
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
                        <span class="instructor-session-time">${s.time || ''}</span>
                        <span class="instructor-session-topic">${escapeHtml(s.topic || '')}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('') || '<p style="text-align:center;color:var(--text-secondary);padding:2rem;">Enter your name to see your schedule.</p>';
}

// ==================== ADMIN MODALS ====================

function openSettingsModal() {
    document.getElementById('semesterStartDate').value = settingsData?.startDate || '';
    document.getElementById('totalWeeksInput').value = settingsData?.totalWeeks || 14;
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function handleSettingsSave(e) {
    e.preventDefault();
    settingsData.startDate = document.getElementById('semesterStartDate').value;
    settingsData.totalWeeks = parseInt(document.getElementById('totalWeeksInput').value);

    calculateWeekDates();
    populateFilters();
    renderSchedule();
    updateSettingsDisplay();
    saveToLocalStorage();
    closeSettingsModal();
    showSuccess('Settings saved. Dates recalculated.');
}

// Block Manager
function openBlockManager() {
    document.getElementById('blockManagerModal').classList.remove('hidden');
    renderBlockManagerList();
}

function closeBlockManager() {
    document.getElementById('blockManagerModal').classList.add('hidden');
}

function renderBlockManagerList() {
    const list = document.getElementById('blockManagerList');
    list.innerHTML = '';

    [...blocksData.blocks].sort((a, b) => a.order - b.order).forEach(block => {
        const item = document.createElement('div');
        item.className = 'block-manager-item' + (currentBlockId === block.id ? ' active' : '');
        item.style.borderLeft = `4px solid ${block.color}`;
        item.textContent = block.name;
        item.onclick = () => selectBlock(block.id);
        list.appendChild(item);
    });
}

function selectBlock(blockId) {
    currentBlockId = blockId;
    renderBlockManagerList();
    renderBlockSessions(blockId);
}

function renderBlockSessions(blockId) {
    const block = blocksData.blocks.find(b => b.id === blockId);
    const header = document.getElementById('blockContentHeader');
    const list = document.getElementById('blockSessionsList');

    header.innerHTML = `<h4>${block?.name || 'Unknown'} <span style="color:var(--text-secondary);font-weight:normal;">(${block?.weeks?.map(w => 'Week ' + w).join(', ') || ''})</span></h4>`;

    const blockSessions = sessionsData.sessions.filter(s => s.blockId === blockId);

    if (blockSessions.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary);">No sessions in this block.</p>';
        return;
    }

    list.innerHTML = blockSessions.map(session => {
        const course = coursesData?.courses?.find(c => c.id === session.courseId);
        return `
            <div class="block-session-item">
                <span>${session.time || ''} - ${escapeHtml(course?.name || session.courseId || '')}</span>
                <button class="btn btn-sm btn-secondary" onclick="openEditModal('${session.id}'); closeBlockManager();">Edit</button>
            </div>
        `;
    }).join('');
}

function addNewBlock() {
    const name = prompt('Enter new block name:');
    if (!name) return;

    const id = name.toLowerCase().replace(/\s+/g, '_');
    const maxOrder = Math.max(...blocksData.blocks.map(b => b.order), 0);
    const maxWeek = Math.max(...blocksData.blocks.flatMap(b => b.weeks || []), 0);

    blocksData.blocks.push({
        id,
        name,
        shortName: name.substring(0, 4),
        weeks: [maxWeek + 1],
        color: `hsl(${Math.random() * 360}, 70%, 50%)`,
        order: maxOrder + 1
    });

    renderBlockManagerList();
    renderBlockPanel();
    saveToLocalStorage();
    showSuccess(`Block "${name}" added.`);
}

// Edit Modal
function openEditModal(sessionId) {
    const session = sessionsData.sessions.find(s => s.id === sessionId);
    if (!session) return;

    currentEditSession = session;
    document.getElementById('editTime').value = session.time || '';
    document.getElementById('editType').value = session.type || 'lecture';
    document.getElementById('editLocation').value = session.location || 'Pendik';
    document.getElementById('editSubgroup').value = session.subgroup || 'all';

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
    currentEditSession.location = document.getElementById('editLocation').value;
    currentEditSession.subgroup = document.getElementById('editSubgroup').value;
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

    sessionsData.sessions.push({
        id: `s${Date.now()}`,
        blockId: document.getElementById('addBlock').value,
        weekOfBlock: 1,
        dayOfWeek: parseInt(document.getElementById('addDayOfWeek').value),
        time: document.getElementById('addTime').value,
        courseId: addSelectedCourse?.id || '',
        instructorIds: addSelectedInstructors.map(i => i.id),
        type: document.getElementById('addType').value,
        location: document.getElementById('addLocation').value,
        subgroup: document.getElementById('addSubgroup').value
    });

    saveToLocalStorage();
    renderSchedule();
    closeAddModal();
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

function openImportModal() {
    document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

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
                    name: row.Name || row.name || '',
                    title: row.Title || row.title || '',
                    department: row.Department || row.department || ''
                }));
                showSuccess(`Imported ${json.length} instructors.`);
            } else {
                coursesData.courses = json.map((row, i) => ({
                    id: `c${String(i + 1).padStart(3, '0')}`,
                    name: row.Name || row.name || '',
                    blockId: row.Block || row.block || ''
                }));
                showSuccess(`Imported ${json.length} courses.`);
            }

            saveToLocalStorage();
            fileInput.value = '';
            closeImportModal();
        } catch (err) {
            showError('Error reading Excel file: ' + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function exportAllData() {
    const data = {
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

    showSuccess('Data exported successfully.');
}

// ==================== VALIDATION ====================

function validateSchedule() {
    const issues = [];
    const slots = {};

    sessionsData?.sessions?.forEach(session => {
        const dateInfo = getSessionDate(session);
        if (!dateInfo) return;

        const key = `${dateInfo.date}_${session.time}`;
        (session.instructorIds || []).forEach(instId => {
            if (!slots[instId]) slots[instId] = {};
            if (slots[instId][key]) {
                const inst = instructorsData?.instructors?.find(i => i.id === instId);
                issues.push({ type: 'error', message: `Conflict: ${inst?.name || instId} has multiple sessions at ${dateInfo.display} ${session.time}` });
            }
            slots[instId][key] = true;
        });
    });

    alertsList.innerHTML = issues.length === 0
        ? '<div class="alert-item success"><span>✅</span><div>No conflicts found.</div></div>'
        : issues.map(i => `<div class="alert-item error"><span>❌</span><div>${escapeHtml(i.message)}</div></div>`).join('');

    alertsPanel.classList.remove('hidden');
}

function exportToPdf() {
    weekFilter.value = 'all';
    renderSchedule();
    setTimeout(() => window.print(), 100);
}

// ==================== STORAGE ====================

function saveToLocalStorage() {
    localStorage.setItem('scheduleSettings_v4', JSON.stringify(settingsData));
    localStorage.setItem('scheduleSessions_v4', JSON.stringify(sessionsData));
    localStorage.setItem('scheduleBlocks_v4', JSON.stringify(blocksData));
    localStorage.setItem('scheduleInstructors_v4', JSON.stringify(instructorsData));
    localStorage.setItem('scheduleCourses_v4', JSON.stringify(coursesData));
    updateLastUpdate();
}

function updateLastUpdate() {
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('en-US');
}

function showSuccess(msg) {
    alertsList.innerHTML = `<div class="alert-item success"><span>✅</span><div>${msg}</div></div>`;
    alertsPanel.classList.remove('hidden');
    setTimeout(() => alertsPanel.classList.add('hidden'), 3000);
}

function showError(msg) {
    alertsList.innerHTML = `<div class="alert-item error"><span>❌</span><div>${msg}</div></div>`;
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
