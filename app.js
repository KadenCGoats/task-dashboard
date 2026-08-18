const today = '2026-08-18';
const supabaseClient = window.supabase.createClient('https://dpwilpykkbevbebxtbqz.supabase.co', 'sb_publishable_SYxM76v9OQW2ric_l5crJg_Ntxnlj4i');
let currentUser = null;
const initialTasks = [
  { id: 1, title: 'Prepare Q3 review presentation', list: 'Work', dueDate: today, priority: 'high', notes: '', estimate: 45, done: false },
  { id: 2, title: 'Reply to design feedback', list: 'Work', dueDate: today, priority: 'medium', notes: '', estimate: 20, done: false },
  { id: 3, title: 'Book dentist appointment', list: 'Personal', dueDate: '2026-08-19', priority: 'high', notes: '', estimate: 10, done: false },
  { id: 4, title: 'Update portfolio case study', list: 'Personal', dueDate: '2026-08-20', priority: 'low', notes: '', estimate: 60, done: false },
  { id: 5, title: 'Read chapter 4 of Atomic Habits', list: 'Learning', dueDate: '2026-08-21', priority: 'low', notes: '', estimate: 30, done: false },
  { id: 6, title: 'Send project status update', list: 'Work', dueDate: today, priority: 'medium', notes: '', estimate: 15, done: false },
  { id: 7, title: 'Plan weekend groceries', list: 'Personal', dueDate: '2026-08-22', priority: 'low', notes: '', estimate: 20, done: false },
  { id: 8, title: 'Review accessibility checklist', list: 'Work', dueDate: '2026-08-22', priority: 'medium', notes: '', estimate: 30, done: false },
  { id: 9, title: 'Watch JavaScript course lesson', list: 'Learning', dueDate: '2026-08-23', priority: 'low', notes: '', estimate: 45, done: false },
  { id: 10, title: 'Organize downloads folder', list: 'Personal', dueDate: '2026-08-23', priority: 'low', notes: '', estimate: 25, done: false },
  { id: 11, title: 'Draft next sprint goals', list: 'Work', dueDate: '2026-08-23', priority: 'medium', notes: '', estimate: 30, done: false }
];

let tasks = [];
let lists = [];
const completedList = 'Completed';
const defaultListColors = ['#ef735f', '#74b999', '#83a8d1'];
let listColors = {};
lists = lists.filter((list) => list !== completedList);
let activeFilter = 'all';
let activeList = null;
let editingId = null;
const priorityRank = { high: 0, medium: 1, low: 2 };
const taskList = document.querySelector('#task-list');
const tasksPanel = document.querySelector('.tasks-panel');
const calendarPanel = document.querySelector('#calendar-panel');
const calendarGrid = document.querySelector('#calendar-grid');
let calendarDate = new Date(`${today}T12:00:00`);
let calendarListFilter = 'all';
const dialog = document.querySelector('#task-dialog');
const form = document.querySelector('#task-form');
const listDialog = document.querySelector('#list-dialog');
const listForm = document.querySelector('#list-form');
let editingListName = null;
const themeToggle = document.querySelector('#theme-toggle');
const themeToggleLabel = document.querySelector('#theme-toggle-label');

function setTheme(isDark) {
  document.documentElement.classList.toggle('dark-mode', isDark);
  document.body.classList.toggle('dark-mode', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggleLabel.textContent = isDark ? 'Light mode' : 'Dark mode';
  localStorage.setItem('task-dashboard-theme', isDark ? 'dark' : 'light');
}

function taskFromRow(row) {
  return { id: row.id, title: row.title, list: row.list, previousList: row.previous_list, dueDate: row.due_date || today, priority: row.priority || 'medium', notes: row.notes || '', estimate: row.estimate || 0, done: row.done, completedAt: row.completed_at };
}

function taskToRow(task, includeId = false) {
  return { ...(includeId ? { id: task.id } : {}), user_id: currentUser.id, title: task.title, list: task.list, previous_list: task.previousList || null, due_date: task.dueDate || today, priority: task.priority, notes: task.notes || '', estimate: Number(task.estimate) || 0, done: Boolean(task.done), completed_at: task.completedAt || null };
}

async function loadData() {
  const [taskResult, listResult] = await Promise.all([
    supabaseClient.from('tasks').select('*').eq('user_id', currentUser.id).order('id'),
    supabaseClient.from('lists').select('*').eq('user_id', currentUser.id).order('id')
  ]);
  if (taskResult.error) throw taskResult.error;
  if (listResult.error) throw listResult.error;
  tasks = (taskResult.data || []).map(taskFromRow);
  const localTasks = JSON.parse(localStorage.getItem('task-dashboard-tasks') || 'null');
  const localLists = JSON.parse(localStorage.getItem('task-dashboard-lists') || 'null');
  if (!tasks.length) {
    const seedTasks = Array.isArray(localTasks) && localTasks.length ? localTasks : initialTasks;
    const { data, error } = await supabaseClient.from('tasks').insert(seedTasks.map((task) => taskToRow({ ...task, dueDate: task.dueDate || today }))).select();
    if (error) throw error;
    tasks = (data || []).map(taskFromRow);
  }
  lists = (listResult.data || []).map((row) => row.name).filter((name) => name !== completedList);
  if (!lists.length) {
    lists = Array.isArray(localLists) && localLists.length ? localLists.filter((name) => name !== completedList) : ['Work', 'Personal', 'Learning'];
    const { data, error } = await supabaseClient.from('lists').insert(lists.map((name, index) => ({ user_id: currentUser.id, name, color: defaultListColors[index % defaultListColors.length] }))).select();
    if (error) throw error;
    listColors = Object.fromEntries((data || []).map((row) => [row.name, row.color]));
  } else {
    listColors = Object.fromEntries((listResult.data || []).map((row) => [row.name, row.color]).filter((entry) => entry[1]));
  }
  lists = lists.filter((list, index) => lists.indexOf(list) === index);
}

function dateLabel(date) {
  if (date === today) return 'Due today';
  if (date === '2026-08-19') return 'Due tomorrow';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function dueFilter(date) { return date === today ? 'today' : date > today ? 'upcoming' : 'overdue'; }
function escapeHtml(value) { return String(value || '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
function formatDuration(minutes) { if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return remainder ? `${hours}h ${remainder}m` : `${hours}h`; }
function getListColor(list, index = lists.indexOf(list)) { const storedColor = listColors[list]; if (/^#[0-9a-f]{6}$/i.test(storedColor || '')) return storedColor; return list === completedList ? '#5eaa82' : defaultListColors[(index < 0 ? 0 : index) % defaultListColors.length]; }

function currentVisibleTasks() {
  const query = document.querySelector('#task-search').value.trim().toLowerCase();
  let visible = tasks.filter((task) => {
    const matchesFilter = activeFilter === 'all' || dueFilter(task.dueDate) === activeFilter;
    const matchesList = !activeList || (activeList === completedList ? task.done : task.list === activeList && !task.done);
    const matchesSearch = !query || `${task.title} ${task.notes} ${task.list}`.toLowerCase().includes(query);
    return matchesFilter && matchesList && matchesSearch;
  });
  const sort = document.querySelector('#task-sort').value;
  if (sort === 'due') visible.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  if (sort === 'priority') visible.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
  if (sort === 'list') visible.sort((a, b) => a.list.localeCompare(b.list));
  return visible;
}

function renderLists() {
  const listRows = lists.map((list, index) => `<div class="list-row"><label class="list-color-picker" style="background:${getListColor(list, index)}" title="Change ${escapeHtml(list)} color"><input type="color" value="${getListColor(list, index)}" data-color-list="${escapeHtml(list)}" aria-label="Change ${escapeHtml(list)} color"></label><button class="nav-item ${activeList === list ? 'active' : ''}" data-list="${escapeHtml(list)}">${escapeHtml(list)} <b>${tasks.filter((task) => task.list === list && !task.done).length}</b></button><button class="list-edit" data-edit-list="${escapeHtml(list)}" aria-label="Rename ${escapeHtml(list)}">✎</button><button class="list-delete" data-delete-list="${escapeHtml(list)}" aria-label="Delete ${escapeHtml(list)}">×</button></div>`).join('');
  const completedCount = tasks.filter((task) => task.done).length;
  document.querySelector('#list-nav').innerHTML = listRows;
  document.querySelector('#completed-nav-count').textContent = completedCount;
  document.querySelectorAll('[data-list]').forEach((item) => item.addEventListener('click', () => { activeList = item.dataset.list; activeFilter = 'all'; setCalendarVisibility(false); setActiveTab('all'); render(); }));
  document.querySelectorAll('[data-color-list]').forEach((input) => input.addEventListener('input', () => setListColor(input.dataset.colorList, input.value)));
  document.querySelectorAll('[data-edit-list]').forEach((item) => item.addEventListener('click', (event) => { event.stopPropagation(); openListEditor(item.dataset.editList); }));
  document.querySelectorAll('[data-delete-list]').forEach((item) => item.addEventListener('click', (event) => { event.stopPropagation(); deleteList(item.dataset.deleteList); }));
  document.querySelector('#task-list-select').innerHTML = lists.map((list) => `<option>${escapeHtml(list)}</option>`).join('');
}

function openListEditor(listName = null) {
  editingListName = listName;
  document.querySelector('#list-dialog-title').textContent = listName ? 'Rename list' : 'Add a list';
  document.querySelector('#list-submit').innerHTML = listName ? 'Save list <span>↗</span>' : 'Add list <span>↗</span>';
  document.querySelector('#list-name').value = listName || '';
  listDialog.showModal();
  document.querySelector('#list-name').focus();
}

async function saveListName(newName) {
  if (!newName || newName === editingListName || lists.includes(newName)) return;
  if (editingListName) {
    const { error } = await supabaseClient.from('lists').update({ name: newName }).eq('user_id', currentUser.id).eq('name', editingListName);
    if (error) throw error;
    lists = lists.map((list) => list === editingListName ? newName : list);
    tasks = tasks.map((task) => task.list === editingListName ? { ...task, list: newName } : task.previousList === editingListName ? { ...task, previousList: newName } : task);
    if (listColors[editingListName]) { listColors[newName] = listColors[editingListName]; delete listColors[editingListName]; }
    if (activeList === editingListName) activeList = newName;
  } else {
    const { data, error } = await supabaseClient.from('lists').insert({ user_id: currentUser.id, name: newName, color: getListColor(newName, lists.length) }).select().single();
    if (error) throw error;
    lists.push(newName);
    listColors[newName] = data.color;
  }
  render();
}

async function setListColor(list, color) {
  const { error } = await supabaseClient.from('lists').update({ color }).eq('user_id', currentUser.id).eq('name', list);
  if (error) { alert(error.message); return; }
  listColors[list] = color;
  render();
}

async function deleteList(listName) {
  if (!confirm(`Delete the ${listName} list? Tasks in it will move to another list.`)) return;
  const replacement = lists.find((list) => list !== listName);
  if (!replacement) { alert('Add another list before deleting this one.'); return; }
  const affectedTasks = tasks.filter((task) => task.list === listName || task.previousList === listName);
  const updatedTasks = affectedTasks.map((task) => ({ ...task, list: task.list === listName ? replacement : task.list, previousList: task.previousList === listName ? replacement : task.previousList }));
  const taskUpdates = updatedTasks.map((task) => supabaseClient.from('tasks').update(taskToRow(task)).eq('id', task.id).eq('user_id', currentUser.id));
  const { error: taskError } = await Promise.all(taskUpdates).then((results) => ({ error: results.find((result) => result.error)?.error }));
  if (taskError) { alert(taskError.message); return; }
  const { error } = await supabaseClient.from('lists').delete().eq('user_id', currentUser.id).eq('name', listName);
  if (error) { alert(error.message); return; }
  tasks = tasks.map((task) => updatedTasks.find((updated) => updated.id === task.id) || task);
  lists = lists.filter((list) => list !== listName);
  delete listColors[listName];
  if (activeList === listName) activeList = null;
  render();
}

function setCalendarVisibility(isVisible) {
  tasksPanel.hidden = isVisible;
  calendarPanel.hidden = !isVisible;
}

function calendarDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarDate);
  document.querySelector('#calendar-month').textContent = monthName;
  const listFilter = document.querySelector('#calendar-list-filter');
  listFilter.innerHTML = [`<option value="all">All lists</option>`, ...lists.map((list) => `<option value="${escapeHtml(list)}">${escapeHtml(list)}</option>`), `<option value="${completedList}">${completedList}</option>`].join('');
  listFilter.value = calendarListFilter;
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  let monthTaskCount = 0;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(year, month, index - startOffset + 1);
    const dateKey = calendarDateKey(date);
    const inMonth = date.getMonth() === month;
    const dayTasks = tasks.filter((task) => task.dueDate === dateKey && (calendarListFilter === 'all' || task.list === calendarListFilter || (calendarListFilter === completedList && task.done)));
    if (inMonth) monthTaskCount += dayTasks.length;
    const taskMarkup = dayTasks.map((task) => `<button class="calendar-task ${task.done ? 'done' : ''}" style="--task-color:${getListColor(task.list)}" data-calendar-toggle="${task.id}" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</button>`).join('');
    return `<div class="calendar-day ${inMonth ? '' : 'other-month'} ${dateKey === today ? 'today' : ''}"><span class="calendar-number">${date.getDate()}</span>${taskMarkup}</div>`;
  }).join('');
  calendarGrid.innerHTML = cells || '<div class="calendar-empty">No dates to show.</div>';
  document.querySelector('#calendar-caption').textContent = `${monthTaskCount} task${monthTaskCount === 1 ? '' : 's'} this month`;
  document.querySelectorAll('[data-calendar-toggle]').forEach((button) => button.addEventListener('click', () => toggleTask(Number(button.dataset.calendarToggle))));
}

function render() {
  renderLists();
  const tabCounts = { all: tasks.length, today: tasks.filter((task) => dueFilter(task.dueDate) === 'today').length, upcoming: tasks.filter((task) => dueFilter(task.dueDate) === 'upcoming').length };
  document.querySelectorAll('.tab').forEach((tab) => { tab.querySelector('span').textContent = tabCounts[tab.dataset.filter]; });
  const visibleTasks = currentVisibleTasks();
  renderCalendar();
  taskList.innerHTML = visibleTasks.length ? visibleTasks.map((task) => `<div class="task-row ${task.done ? 'done' : ''} ${task.dueDate < today && !task.done ? 'overdue' : ''}"><button class="check" data-toggle="${task.id}" aria-label="${task.done ? 'Mark incomplete' : 'Mark complete'}">${task.done ? '✓' : ''}</button><button class="task-info" data-description-toggle="${task.id}" aria-expanded="false" aria-label="Show description for ${escapeHtml(task.title)}"><span class="task-title">${escapeHtml(task.title)}</span><span class="task-meta"><span><i class="priority ${task.priority}" style="background:${getListColor(task.list)}"></i>${escapeHtml(task.list)}</span><span>${task.priority} priority</span>${task.estimate ? `<span>${task.estimate}m</span>` : ''}</span><span class="task-description">${escapeHtml(task.notes || 'No description added.')}</span></button><span class="task-date">${dateLabel(task.dueDate)}</span><button class="task-action edit-task" data-edit="${task.id}" aria-label="Edit ${escapeHtml(task.title)}">✎</button><button class="task-action delete-task" data-delete="${task.id}" aria-label="Delete ${escapeHtml(task.title)}">×</button></div>`).join('') : '<div class="empty-state">No tasks match this view.</div>';
  const open = tasks.filter((task) => !task.done).length;
  document.querySelector('#task-caption').textContent = activeList ? `${visibleTasks.length} tasks in ${activeList}` : `${open} open tasks across all lists`;
  document.querySelector('#open-total').textContent = open;
  document.querySelector('#today-total').textContent = tasks.filter((task) => dueFilter(task.dueDate) === 'today' && !task.done).length;
  const completedTasks = tasks.filter((task) => task.completedAt);
  document.querySelector('#completed-total').textContent = completedTasks.length;
  document.querySelector('#inbox-count').textContent = tasks.filter((task) => dueFilter(task.dueDate) === 'today' && !task.done).length;
  const remainingToday = tasks.filter((task) => dueFilter(task.dueDate) === 'today' && !task.done);
  const focusMinutes = remainingToday.reduce((total, task) => total + (Number(task.estimate) || 0), 0);
  document.querySelector('#focus-time-total').textContent = formatDuration(focusMinutes);
  document.querySelector('#focus-time-caption').textContent = `${remainingToday.length} task${remainingToday.length === 1 ? '' : 's'} left today`;
  document.querySelector('#focus-time-progress').style.width = `${Math.min(100, Math.round((focusMinutes / 300) * 100))}%`;
  renderFocusList(remainingToday.filter((task) => task.priority === 'high'));
  renderWeeklyProgress(completedTasks);
  document.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => toggleTask(Number(button.dataset.toggle))));
  document.querySelectorAll('[data-description-toggle]').forEach((item) => item.addEventListener('click', () => {
    const expanded = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', String(!expanded));
  }));
  document.querySelectorAll('[data-edit]').forEach((item) => item.addEventListener('click', () => openEditor(Number(item.dataset.edit))));
  document.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', () => deleteTask(Number(button.dataset.delete))));
}

function renderFocusList(tasksToFocus) {
  document.querySelector('#focus-list').innerHTML = tasksToFocus.length ? tasksToFocus.map((task) => `<div class="focus-item"><span class="priority-dot high"></span><div><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.list)} · Due today</small></div><span class="focus-time">${task.estimate ? `${task.estimate}m` : 'No estimate'}</span></div>`).join('') : '<div class="empty-state">No high-priority tasks due today.</div>';
}

function renderWeeklyProgress(completedTasks) {
  const counts = Object.fromEntries([...document.querySelectorAll('.bars i')].map((bar) => [bar.dataset.day, 0]));
  completedTasks.forEach((task) => { const completedDate = task.completedAt.slice(0, 10); if (completedDate in counts) counts[completedDate] += 1; });
  const maxCount = Math.max(1, ...Object.values(counts));
  document.querySelectorAll('.bars i').forEach((bar) => { bar.style.height = `${counts[bar.dataset.day] ? Math.max(12, (counts[bar.dataset.day] / maxCount) * 100) : 0}%`; });
  document.querySelector('#weekly-completed-total').textContent = Object.values(counts).reduce((total, count) => total + count, 0);
  document.querySelector('#weekly-completed-change').textContent = completedTasks.length ? 'Tracked this week' : 'Start tracking';
}

async function toggleTask(id) {
  tasks = tasks.map((task) => {
    if (task.id !== id) return task;
    const completing = !task.done;
    return completing
      ? { ...task, done: true, completedAt: new Date().toISOString(), previousList: task.list, list: completedList }
      : { ...task, done: false, completedAt: null, list: task.previousList || lists[0], previousList: null };
  });
  const task = tasks.find((item) => item.id === id);
  const { error } = await supabaseClient.from('tasks').update(taskToRow(task)).eq('id', id).eq('user_id', currentUser.id);
  if (error) { alert(error.message); return; }
  render();
}
async function deleteTask(id) { if (confirm('Delete this task?')) { const { error } = await supabaseClient.from('tasks').delete().eq('id', id).eq('user_id', currentUser.id); if (error) { alert(error.message); return; } tasks = tasks.filter((task) => task.id !== id); render(); } }
function setActiveTab(filter) { document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.filter === filter)); }

function openEditor(id = null) {
  editingId = id;
  const task = tasks.find((item) => item.id === id);
  document.querySelector('#dialog-title').textContent = task ? 'Edit task' : 'What needs doing?';
  document.querySelector('#dialog-submit').innerHTML = task ? 'Save changes <span>↗</span>' : 'Create task <span>↗</span>';
  document.querySelector('#task-name').value = task?.title || '';
  const taskListSelect = document.querySelector('#task-list-select');
  if (task?.done) taskListSelect.insertAdjacentHTML('beforeend', `<option value="${completedList}">${completedList}</option>`);
  taskListSelect.value = task?.list || lists[0];
  document.querySelector('#task-due').value = task?.dueDate || today;
  document.querySelector('#task-priority').value = task?.priority || 'medium';
  document.querySelector('#task-notes').value = task?.notes || '';
  document.querySelector('#task-estimate').value = task?.estimate || '';
  dialog.showModal();
  document.querySelector('#task-name').focus();
}

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => { activeFilter = tab.dataset.filter; activeList = null; setCalendarVisibility(false); setActiveTab(activeFilter); render(); }));
document.querySelectorAll('[data-view]').forEach((item) => item.addEventListener('click', () => { document.querySelectorAll('.nav-item.active').forEach((active) => active.classList.remove('active')); item.classList.add('active'); const isCalendar = item.dataset.view === 'calendar'; activeFilter = item.dataset.view === 'inbox' ? 'today' : item.dataset.view === 'upcoming' ? 'upcoming' : 'all'; activeList = item.dataset.view === 'completed' ? completedList : null; setCalendarVisibility(isCalendar); setActiveTab(activeFilter); render(); }));
document.querySelector('#calendar-prev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
document.querySelector('#calendar-next').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
document.querySelector('#calendar-list-filter').addEventListener('change', (event) => { calendarListFilter = event.target.value; renderCalendar(); });
document.querySelectorAll('#open-add, #open-add-bottom').forEach((button) => button.addEventListener('click', () => openEditor()));
document.querySelector('#task-search').addEventListener('input', render);
document.querySelector('#task-sort').addEventListener('change', render);
document.querySelector('#add-list').addEventListener('click', () => openListEditor());
themeToggle.addEventListener('click', () => setTheme(!document.body.classList.contains('dark-mode')));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const taskData = { title: document.querySelector('#task-name').value.trim(), list: document.querySelector('#task-list-select').value, dueDate: document.querySelector('#task-due').value, priority: document.querySelector('#task-priority').value, notes: document.querySelector('#task-notes').value.trim(), estimate: Number(document.querySelector('#task-estimate').value) || 0 };
  let savedTask;
  if (editingId) {
    savedTask = tasks.find((task) => task.id === editingId);
    savedTask = { ...savedTask, ...taskData };
    const { error } = await supabaseClient.from('tasks').update(taskToRow(savedTask)).eq('id', editingId).eq('user_id', currentUser.id);
    if (error) { alert(error.message); return; }
    tasks = tasks.map((task) => task.id === editingId ? savedTask : task);
  } else {
    const newTask = { ...taskData, done: false, completedAt: null };
    const { data, error } = await supabaseClient.from('tasks').insert(taskToRow(newTask)).select().single();
    if (error) { alert(error.message); return; }
    tasks.unshift(taskFromRow(data));
  }
  form.reset(); editingId = null; dialog.close(); render();
});

listForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#list-name').value.trim();
  if (name && name !== editingListName && !lists.includes(name)) await saveListName(name);
  listForm.reset();
  editingListName = null;
  listDialog.close();
});

document.querySelector('#export-tasks').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ tasks, lists }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'tasks.json'; link.click(); URL.revokeObjectURL(link.href); });
document.querySelector('#import-tasks').addEventListener('change', (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { try { const imported = JSON.parse(reader.result); if (!Array.isArray(imported.tasks)) throw new Error('Invalid file'); const { error } = await supabaseClient.from('tasks').insert(imported.tasks.map((task) => taskToRow(task))); if (error) throw error; await loadData(); render(); } catch { alert('That file is not a valid task export or could not be imported.'); } event.target.value = ''; }; reader.readAsText(file); });

const authScreen = document.querySelector('#auth-screen');
const appShell = document.querySelector('.app-shell');
const authForm = document.querySelector('#auth-form');
const authSwitch = document.querySelector('#auth-switch');
const authSubmit = document.querySelector('#auth-submit');
const authMessage = document.querySelector('#auth-message');
const authError = document.querySelector('#auth-error');
let isSignUp = false;

document.querySelector('#close-auth').addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  authScreen.setAttribute('hidden', '');
});

authScreen.addEventListener('click', (event) => {
  if (event.target === authScreen) authScreen.setAttribute('hidden', '');
});

function showAuth(message = 'Sign in to keep your tasks available on every device.') {
  authMessage.textContent = message;
  authError.textContent = '';
  authScreen.hidden = false;
  document.querySelector('#account-button').textContent = 'Sign in';
}

authSwitch.addEventListener('click', () => {
  isSignUp = !isSignUp;
  authSubmit.innerHTML = isSignUp ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
  authSwitch.textContent = isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up';
  authMessage.textContent = isSignUp ? 'Create an account to sync your tasks across devices.' : 'Sign in to keep your tasks available on every device.';
  authError.textContent = '';
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  authError.textContent = '';
  authSubmit.disabled = true;
  authSubmit.textContent = isSignUp ? 'Creating account...' : 'Signing in...';
  try {
    const email = document.querySelector('#auth-email').value.trim();
    const password = document.querySelector('#auth-password').value;
    const result = isSignUp ? await supabaseClient.auth.signUp({ email, password }) : await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) { authError.textContent = result.error.message; return; }
    if (isSignUp && !result.data.session) { authMessage.textContent = 'Check your email to confirm your account, then sign in.'; return; }
    authScreen.hidden = true;
    await startApp(result.data.session);
  } catch (error) {
    authError.textContent = error.message || 'The request could not be completed. Check your connection and try again.';
  } finally {
    authSubmit.disabled = false;
    authSubmit.innerHTML = isSignUp ? 'Create account <span>↗</span>' : 'Sign in <span>↗</span>';
  }
});

document.querySelector('#account-button').addEventListener('click', async () => {
  if (currentUser) { await supabaseClient.auth.signOut(); currentUser = null; showAuth(); return; }
  authScreen.hidden = !authScreen.hidden;
  if (!authScreen.hidden) document.querySelector('#auth-email').focus();
});

async function startApp(session = null) {
  const activeSession = session || (await supabaseClient.auth.getSession()).data.session;
  if (!activeSession) { document.querySelector('#account-button').textContent = 'Sign in'; return; }
  currentUser = activeSession.user;
  try {
    await loadData();
    setTheme(localStorage.getItem('task-dashboard-theme') === 'dark');
    authScreen.hidden = true;
    document.querySelector('#account-button').textContent = 'Sign out';
    render();
  } catch (error) {
    showAuth(`Could not load your workspace: ${error.message}`);
  }
}

startApp();
