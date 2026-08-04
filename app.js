// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = 'https://sqrrfslqwcgpsmzdovru.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_rb70-VY2GstWzdoXmoUkwg_Iw3EiqFO'; 

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- STATE MANAGEMENT ---
let currentUser = { role: localStorage.getItem('amt_userRole') || null };
let currentTab = 'attendance';

let eventDates = [];
let members = [];

// Load data from Supabase Cloud on startup
async function loadDataFromCloud() {
    try {
        const { data, error } = await db.from('app_data').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            data.forEach(row => {
                if (row.key === 'eventDates') eventDates = row.value || [];
                if (row.key === 'members') members = row.value || [];
            });
        }
        render();
    } catch (err) {
        console.error('Error loading from cloud:', err);
    }
}

// Save data to Supabase Cloud
async function saveData() {
    if (currentUser.role) {
        localStorage.setItem('amt_userRole', currentUser.role);
    } else {
        localStorage.removeItem('amt_userRole');
    }

    try {
        const { error: err1 } = await db.from('app_data').upsert({ id: 1, key: 'eventDates', value: eventDates }, { onConflict: 'id' });
        if (err1) alert('Save Error (Events): ' + err1.message);

        const { error: err2 } = await db.from('app_data').upsert({ id: 2, key: 'members', value: members }, { onConflict: 'id' });
        if (err2) alert('Save Error (Members): ' + err2.message);
    } catch (err) {
        alert('CRITICAL ERROR: ' + err.message);
        console.error('Error saving to cloud:', err);
    }
}

// --- DOM ELEMENTS ---
const loginOverlay = document.getElementById('loginOverlay');
const navAttendance = document.getElementById('navAttendance');
const navMembers = document.getElementById('navMembers');

const viewAttendance = document.getElementById('viewAttendance');
const viewRanking = document.getElementById('viewRanking');
const viewMembersSection = document.getElementById('viewMembersSection');

// --- AUTHENTICATION LOGIC ---
function loginAs(role) {
    currentUser.role = role;
    saveData();
    if (loginOverlay) loginOverlay.style.display = 'none';
    render();
}

function logout() {
    currentUser.role = null;
    localStorage.removeItem('amt_userRole');
    if (loginOverlay) loginOverlay.style.display = 'flex';
}

if (currentUser.role && loginOverlay) {
    loginOverlay.style.display = 'none';
}

// --- SPA VIEW ROUTING ---
function switchView(tabName) {
    currentTab = tabName;

    if (viewAttendance) viewAttendance.style.display = 'none';
    if (viewRanking) viewRanking.style.display = 'none';
    if (viewMembersSection) viewMembersSection.style.display = 'none';

    if (navAttendance) navAttendance.classList.remove('sidebar__item--active');
    if (navMembers) navMembers.classList.remove('sidebar__item--active');

    if (tabName === 'attendance' && viewAttendance) {
        viewAttendance.style.display = 'flex';
        if (navAttendance) navAttendance.classList.add('sidebar__item--active');
    } else if (tabName === 'ranking' && viewRanking) {
        viewRanking.style.display = 'flex';
    } else if (tabName === 'members' && viewMembersSection) {
        viewMembersSection.style.display = 'flex';
        if (navMembers) navMembers.classList.add('sidebar__item--active');
    }

    render();
}

if (navAttendance) {
    navAttendance.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('attendance');
    });
}

if (navMembers) {
    navMembers.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('members');
    });
}

// --- RENDERING CONTROLLER ---
function render() {
    const searchInput = document.getElementById('searchInput');
    const filterQuery = searchInput ? searchInput.value.toLowerCase() : '';
    const isAdmin = currentUser.role === 'admin';
    const totalEvents = eventDates.length;

    const adminPanel = document.getElementById('adminPanel');
    const importBtn = document.getElementById('importBtn');
    const userRoleDisplay = document.getElementById('userRoleDisplay');

    if (adminPanel) adminPanel.style.display = isAdmin ? 'flex' : 'none';
    if (importBtn) importBtn.style.display = isAdmin ? 'block' : 'none';
    if (userRoleDisplay) userRoleDisplay.innerText = isAdmin ? 'ADMIN (STAFF)' : 'MEMBER (READ-ONLY)';

    members.sort((a, b) => b.attended - a.attended);

    const totalAttendedCount = members.reduce((sum, m) => sum + (m.attended || 0), 0);
    const avgAttendance = members.length ? (totalAttendedCount / members.length) : 0;
    const avgRate = totalEvents > 0 ? (avgAttendance / totalEvents) * 100 : 0;

    const filteredMembers = members.filter(m => m.name.toLowerCase().includes(filterQuery));

    const kpiMembers = document.getElementById('kpiMembers');
    const kpiAvgAttendance = document.getElementById('kpiAvgAttendance');
    const kpiAvgRate = document.getElementById('kpiAvgRate');
    
    if (kpiMembers) kpiMembers.innerText = members.length;
    if (kpiAvgAttendance) kpiAvgAttendance.innerText = avgAttendance.toFixed(1);
    if (kpiAvgRate) kpiAvgRate.innerText = `${avgRate.toFixed(1)}%`;

    if (currentTab === 'attendance') {
        renderAttendanceTable(filteredMembers, isAdmin, totalEvents);
    } else if (currentTab === 'members') {
        renderMembersList(filteredMembers, isAdmin, totalEvents);
    }
}

// --- RENDER MEMBERS TAB ---
function renderMembersList(filteredMembers, isAdmin, totalEvents) {
    const tbody = document.getElementById('membersListTableBody');
    const badge = document.getElementById('membersCountBadge');
    
    if (badge) badge.innerText = `${filteredMembers.length} Members`;
    if (!tbody) return;

    tbody.innerHTML = '';

    if (filteredMembers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 24px; color: #8c93a6;">No members found.</td></tr>`;
        return;
    }

    filteredMembers.forEach((member, index) => {
        const rate = totalEvents > 0 ? (((member.attended || 0) / totalEvents) * 100).toFixed(1) : 0;
        const isActive = (member.attended || 0) > 0 || totalEvents === 0;

        let rowHTML = `
            <tr>
                <td class="col-rank">${index + 1}</td>
                <td class="col-name">
                    ${member.hasPlus ? '<span style="color:#d99f26; margin-right:4px;">+</span>' : ''}${member.name}
                </td>
                <td style="text-align: center;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 800; ${isActive ? 'background: #e6f4ea; color: #137333;' : 'background: #fce8e6; color: #c5221f;'}">
                        ${isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                </td>
                <td style="text-align: center; font-weight: 800; color: var(--color-primary);">${member.attended || 0} / ${totalEvents}</td>
                <td style="text-align: center;"><span style="font-weight: 800;">${rate}%</span></td>
                <td class="col-actions">
                    ${isAdmin ? `<button class="btn-icon-action" onclick="deleteMember(${member.id})" title="Delete Member">🗑️</button>` : '<span style="color:#ccc;">—</span>'}
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', rowHTML);
    });
}

function deleteMember(id) {
    if (!confirm('Are you sure you want to remove this member?')) return;
    members = members.filter(m => m.id !== id);
    saveData();
    render();
}

// --- INITIALIZATION ---
if (typeof supabase !== 'undefined') {
    loadDataFromCloud();
} else {
    window.addEventListener('DOMContentLoaded', () => {
        loadDataFromCloud();
    });
}
