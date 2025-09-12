// Import CSS
import 'flatpickr/dist/flatpickr.min.css';
import 'font-awesome/css/font-awesome.min.css';
import '../css/style.css';

// Import JS libraries
import flatpickr from 'flatpickr';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import confetti from 'canvas-confetti';

// Gán các thư viện vào window để code gốc không bị lỗi
window.flatpickr = flatpickr;
window.marked = marked;
window.DOMPurify = DOMPurify;
window.confetti = confetti;

class TodoApp {
    constructor() {
        // --- DOM Elements ---
        this.mainTitle = document.getElementById('main-title');
        this.categoryList = document.getElementById('category-list');
        this.categoryInput = document.getElementById('category-input');
        this.addCategoryBtn = document.getElementById('add-category-btn');
        this.addTaskBtn = document.getElementById('add-task-btn');
        this.taskList = document.getElementById('task-list');
        this.filterContainer = document.getElementById('filter-container');
        this.clearCompletedBtn = document.getElementById('clear-completed-btn');
        this.sortSelect = document.getElementById('sort-select');
        this.modalContainer = document.getElementById('modal-container');
        this.aiAdvisorBtn = document.getElementById('ai-advisor-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.menuBtn = document.getElementById('menu-btn');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarOverlay = document.getElementById('sidebar-overlay');

        // --- Stat Elements ---
        this.statsTodayEl = document.getElementById('stats-today');
        this.statsOverdueEl = document.getElementById('stats-overdue');
        this.statsPendingEl = document.getElementById('stats-pending');
        this.statsCompletedEl = document.getElementById('stats-completed');
        this.greetingSubtitle = document.getElementById('greeting-subtitle');

        // --- App State ---
        this.data = JSON.parse(localStorage.getItem('todoData_v2')) || {
            categories: [{ id: 1, name: 'Công việc' }, { id: 2, name: 'Cá nhân' }],
            tasks: [],
            activeCategoryId: 1
        };
        this.currentFilter = 'all';
        this.currentSortMode = 'default';
        this.priorities = ['low', 'medium', 'high'];
        this.notificationTimeouts = {};
        this.flatpickrInstance = null;
        this.draggedTaskId = null;

        // --- Sound ---
        this.notificationSound = new Audio('/sound/notification.mp3'); // Đường dẫn từ thư mục public
        this.notificationSound.preload = 'auto';
    }

    init() {
        this.addEventListeners();
        this.renderAll();
        this.data.tasks.forEach(task => this.scheduleNotification(task));
    }

    // --- Data Persistence ---
    saveData() {
        localStorage.setItem('todoData_v2', JSON.stringify(this.data));
    }

    // --- Core Rendering ---
    renderAll() {
        this.renderCategories();
        this.renderTasks();
        this.updateGlobalStats();
    }

    renderCategories() {
        this.categoryList.innerHTML = '';
        this.data.categories.forEach(cat => {
            const li = document.createElement('li');
            const pendingCount = this.data.tasks.filter(t => t.categoryId === cat.id && !t.completed).length;

            li.className = `category-item flex justify-between items-center px-3 py-2.5 text-sm text-slate-600 rounded-lg cursor-pointer ${cat.id === this.data.activeCategoryId ? 'active' : ''}`;
            li.dataset.id = cat.id;
            li.innerHTML = `
                <span class="flex items-center">
                    <i class="fa-solid fa-folder w-6 text-center text-slate-500"></i>
                    <span class="ml-3">${cat.name}</span>
                </span>
                <div class="flex items-center">
                    ${pendingCount > 0 ? `<span class="task-count mr-2">${pendingCount}</span>` : ''}
                    ${cat.id !== 1 && cat.id !== 2 ? `<button data-action="delete-category" class="text-slate-400 hover:text-red-500 text-xs transition-colors"><i class="fas fa-trash-alt"></i></button>` : ''}
                </div>
            `;
            this.categoryList.appendChild(li);
        });
    }

    renderTasks() {
        this.taskList.innerHTML = '';
        const activeCategory = this.data.categories.find(c => c.id === this.data.activeCategoryId);
        this.mainTitle.textContent = activeCategory ? activeCategory.name : 'Vui lòng chọn hạng mục';

        let tasksToRender = this.data.tasks
            .filter(task => task.categoryId === this.data.activeCategoryId)
            .filter(task => {
                if (this.currentFilter === 'pending') return !task.completed;
                if (this.currentFilter === 'completed') return task.completed;
                return true;
            });

        // Sorting Logic
        if (this.currentSortMode === 'priority') {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            tasksToRender.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
        } else if (this.currentSortMode === 'dueDate') {
            tasksToRender.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).getTime() : Infinity;
                const dateB = b.dueDate ? new Date(b.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).getTime() : Infinity;
                return dateA - dateB;
            });
        }

        if (tasksToRender.length === 0) {
            this.taskList.innerHTML = `
                <div class="text-center p-12">
                    <svg class="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-slate-900">Không có công việc</h3>
                    <p class="mt-1 text-sm text-slate-500">Bắt đầu bằng cách thêm một công việc mới.</p>
                </div>`;
        } else {
            tasksToRender.forEach(task => this.taskList.appendChild(this.createTaskElement(task)));
        }

        const hasCompletedTasks = this.data.tasks.some(t => t.categoryId === this.data.activeCategoryId && t.completed);
        this.clearCompletedBtn.classList.toggle('hidden', !hasCompletedTasks);
    }

    createTaskElement(task) {
        const li = document.createElement('li');
        const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) < new Date();

        li.className = `task-item group flex items-start justify-between p-4 border-b border-slate-100 ${task.completed ? 'completed' : ''}`;
        li.dataset.id = task.id;
        li.draggable = true;

        let dueDateHTML = '';
        if (task.dueDate) {
            dueDateHTML = `<div class="due-date-text mt-1 text-xs flex items-center ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'}">
                               <i class="fas fa-bell mr-1.5"></i> ${task.dueDate}
                           </div>`;
        }

        const priorityTitles = {
            low: 'Ưu tiên: Thấp (nhấn để đổi)',
            medium: 'Ưu tiên: Trung bình (nhấn để đổi)',
            high: 'Ưu tiên: Cao (nhấn để đổi)'
        };

        li.innerHTML = `
            <div data-action="toggle-priority" class="absolute inset-y-0 left-0 w-5 cursor-pointer" title="${priorityTitles[task.priority] || 'Ưu tiên trung bình'}">
                <div class="absolute inset-y-0 left-0 w-1 priority-${task.priority}"></div>
            </div>
            <div class="flex items-start flex-1 min-w-0 mr-4 ml-5">
                <input id="task-${task.id}" type="checkbox" data-action="toggle-complete" class="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0 mt-0.5" ${task.completed ? 'checked' : ''}>
                <div class="ml-4 flex-1 min-w-0">
                    <label for="task-${task.id}" class="font-medium cursor-pointer block">${task.text}</label>
                    ${dueDateHTML}
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 ml-4">
                <div class="task-actions opacity-0 group-hover:opacity-100 flex items-center space-x-2">
                    <button data-action="edit" class="text-slate-400 hover:text-indigo-600" title="Chỉnh sửa"><i class="fas fa-pencil-alt text-sm me-2"></i></button>
                    <button data-action="delete" class="text-slate-400 hover:text-red-500" title="Xóa"><i class="fas fa-trash-alt text-sm me-2"></i></button>
                </div>
            </div>
        `;
        return li;
    }

    updateGlobalStats() {
        const allTasks = this.data.tasks;
        const today = new Date().setHours(0, 0, 0, 0);

        const todayCount = allTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate.split(' ')[0].replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).setHours(0, 0, 0, 0) === today).length;
        const overdueCount = allTasks.filter(t => !t.completed && t.dueDate && new Date(t.dueDate.split(' ')[0].replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).setHours(0, 0, 0, 0) < today).length;
        const pendingCount = allTasks.filter(t => !t.completed).length;
        const completedCount = allTasks.filter(t => t.completed).length;

        this.statsTodayEl.textContent = todayCount;
        this.statsOverdueEl.textContent = overdueCount;
        this.statsPendingEl.textContent = pendingCount;
        this.statsCompletedEl.textContent = completedCount;
    }

    // --- Event Handlers & Actions ---
    addEventListeners() {
        // Sidebar toggle
        this.menuBtn.addEventListener('click', () => this.toggleSidebar());
        this.sidebarOverlay.addEventListener('click', () => this.toggleSidebar());

        this.addCategoryBtn.addEventListener('click', () => this.addCategory());
        this.categoryInput.addEventListener('keypress', e => { if (e.key === 'Enter') this.addCategory(); });
        this.addTaskBtn.addEventListener('click', () => this.showTaskModal());
        this.aiAdvisorBtn.addEventListener('click', () => this.getAIAdvice());
        this.settingsBtn.addEventListener('click', () => this.showSettingsModal());
        this.sortSelect.addEventListener('change', e => {
            this.currentSortMode = e.target.value;
            this.renderTasks();
        });

        this.categoryList.addEventListener('click', e => {
            const categoryItem = e.target.closest('.category-item');
            if (!categoryItem) return;
            const categoryId = Number(categoryItem.dataset.id);
            const action = e.target.closest('[data-action]')?.dataset.action;

            if (action === 'delete-category') {
                this.showConfirmModal('Xóa hạng mục?', `Hành động này sẽ xóa tất cả công việc trong hạng mục này. Bạn có chắc chắn?`, () => {
                    this.data.tasks.forEach(t => { if (t.categoryId === categoryId) this.cancelNotification(t.id); });
                    this.data.tasks = this.data.tasks.filter(t => t.categoryId !== categoryId);
                    this.data.categories = this.data.categories.filter(c => c.id !== categoryId);
                    if (this.data.activeCategoryId === categoryId) this.data.activeCategoryId = this.data.categories[0]?.id || null;
                    this.saveData();
                    this.renderAll();
                });
            } else {
                this.data.activeCategoryId = categoryId;
                this.saveData();
                this.renderAll();
                if (this.sidebar.classList.contains('open')) {
                    this.toggleSidebar();
                }
            }
        });

        this.taskList.addEventListener('click', e => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;
            const taskId = Number(taskItem.dataset.id);
            const task = this.data.tasks.find(t => t.id === taskId);
            if (!task) return;
            const action = e.target.closest('[data-action]')?.dataset.action;

            switch (action) {
                case 'toggle-priority':
                    const currentPriorityIndex = this.priorities.indexOf(task.priority);
                    task.priority = this.priorities[(currentPriorityIndex + 1) % this.priorities.length];
                    break;
                case 'toggle-complete':
                    const pendingBefore = this.data.tasks.filter(t => t.categoryId === this.data.activeCategoryId && !t.completed).length;
                    task.completed = e.target.checked;
                    const pendingAfter = this.data.tasks.filter(t => t.categoryId === this.data.activeCategoryId && !t.completed).length;
                    if (pendingBefore > 0 && pendingAfter === 0) {
                        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                    }
                    if (task.completed) this.cancelNotification(task.id); else this.scheduleNotification(task);
                    break;
                case 'edit':
                    this.showTaskModal(task);
                    return;
                case 'delete':
                    this.showConfirmModal('Xóa công việc?', `Bạn có chắc muốn xóa công việc "${task.text}"?`, () => {
                        this.cancelNotification(taskId);
                        this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
                        this.saveData();
                        this.renderAll();
                    });
                    return;
                default:
                    if (!e.target.closest('button') && !e.target.closest('[data-action="toggle-priority"]')) {
                        const checkbox = taskItem.querySelector(`#task-${task.id}`);
                        checkbox.checked = !checkbox.checked;
                        const event = new Event('click', { bubbles: true });
                        checkbox.dispatchEvent(event);
                    }
                    return;
            }
            this.saveData();
            this.renderAll();
        });

        // Drag and Drop
        this.taskList.addEventListener('dragstart', e => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                this.draggedTaskId = Number(taskItem.dataset.id);
                setTimeout(() => taskItem.classList.add('dragging'), 0);
            }
        });
        this.taskList.addEventListener('dragend', e => {
            e.target.closest('.task-item')?.classList.remove('dragging');
            this.draggedTaskId = null;
        });
        this.taskList.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (dragging) {
                if (afterElement == null) this.taskList.appendChild(dragging);
                else this.taskList.insertBefore(dragging, afterElement);
            }
        });
        this.taskList.addEventListener('drop', e => {
            e.preventDefault();

            if (this.draggedTaskId === null) { return; }

            this.currentSortMode = 'default';
            this.sortSelect.value = 'default';
            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const draggedTaskIndex = this.data.tasks.findIndex(t => t.id === this.draggedTaskId);

            if (draggedTaskIndex < 0) {
                this.draggedTaskId = null;
                return;
            }

            const [draggedTask] = this.data.tasks.splice(draggedTaskIndex, 1);
            if (afterElement == null) {
                this.data.tasks.push(draggedTask);
            } else {
                const afterElementId = Number(afterElement.dataset.id);
                const afterElementIndex = this.data.tasks.findIndex(t => t.id === afterElementId);
                this.data.tasks.splice(afterElementIndex, 0, draggedTask);
            }
            this.saveData();
            this.renderTasks();
        });

        this.filterContainer.addEventListener('click', e => {
            const target = e.target.closest('.filter-btn');
            if (!target) return;
            this.currentFilter = target.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');
            this.renderTasks();
        });

        this.clearCompletedBtn.addEventListener('click', () => {
            this.showConfirmModal('Dọn dẹp?', 'Xóa tất cả công việc đã hoàn thành trong hạng mục này?', () => {
                this.data.tasks.forEach(t => { if (t.categoryId === this.data.activeCategoryId && t.completed) this.cancelNotification(t.id); });
                this.data.tasks = this.data.tasks.filter(t => t.categoryId !== this.data.activeCategoryId || !t.completed);
                this.saveData();
                this.renderAll();
            });
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    addCategory() {
        const name = this.categoryInput.value.trim();
        if (name) {
            this.data.categories.push({ id: Date.now(), name });
            this.categoryInput.value = '';
            this.saveData();
            this.renderCategories();
        }
    }

    toggleSidebar() {
        this.sidebar.classList.toggle('open');
        this.sidebarOverlay.classList.toggle('hidden');
    }

    // --- Modals & Notifications ---
    showSettingsModal() {
        const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10">
                <div class="p-6 border-b flex justify-between items-center">
                    <h3 class="text-lg font-medium">Cài đặt</h3>
                    <button id="modal-close-btn" class="text-slate-400 hover:text-slate-600 text-2xl font-light">&times;</button>
                </div>
                <div class="p-6">
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>Thông báo trên trình duyệt</h4>
                            <p>Nhận nhắc nhở khi công việc sắp đến hạn.</p>
                        </div>
                        <div class="setting-item-action">
                            <button id="modal-notification-btn"></button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.modalContainer.innerHTML = modalContent;
        this.modalContainer.classList.replace('hidden', 'flex');

        const notificationBtn = document.getElementById('modal-notification-btn');
        this.updateNotificationSettingUI(notificationBtn);

        document.getElementById('modal-close-btn').onclick = () => this.hideModal();
        this.modalContainer.querySelector('.modal-backdrop').onclick = () => this.hideModal();
        notificationBtn.onclick = (e) => this.handleNotificationClick(e.currentTarget);
    }

    showTaskModal(task = null) {
        const isEditing = task !== null;
        const title = isEditing ? 'Chỉnh sửa công việc' : 'Thêm công việc mới';
        const taskText = isEditing ? task.text : '';
        const dueDate = isEditing ? task.dueDate : '';
        const priority = isEditing ? task.priority : 'medium';

        const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10">
                <div class="p-6 border-b"><h3 class="text-lg font-medium">${title}</h3></div>
                <form id="task-form" class="p-6">
                    <div class="space-y-5">
                        <div>
                            <label for="task-text-input" class="block text-sm font-medium text-gray-700 mb-1">Tên công việc</label>
                            <input type="text" id="task-text-input" value="${taskText}" class="form-input" required>
                        </div>
                        <div>
                            <label for="due-date-input" class="block text-sm font-medium text-gray-700 mb-1">Hạn chót</label>
                             <div class="relative">
                                <i class="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                                <input type="text" id="due-date-input" placeholder="Chọn ngày và giờ..." class="form-input pl-9">
                            </div>
                        </div>
                        <div>
                            <label for="priority-select" class="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
                            <div class="select-wrapper">
                                <select id="priority-select" class="form-select">
                                    <option value="high" ${priority === 'high' ? 'selected' : ''}>Cao</option>
                                    <option value="medium" ${priority === 'medium' ? 'selected' : ''}>Trung bình</option>
                                    <option value="low" ${priority === 'low' ? 'selected' : ''}>Thấp</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="mt-8 flex justify-end space-x-3">
                        <button type="button" id="modal-cancel-btn" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Hủy</button>
                        <button type="submit" class="inline-flex justify-center py-2 px-4 border shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Lưu</button>
                    </div>
                </form>
            </div>
        `;
        this.modalContainer.innerHTML = modalContent;
        this.modalContainer.classList.replace('hidden', 'flex');

        const dueDateInput = document.getElementById('due-date-input');
        this.flatpickrInstance = flatpickr(dueDateInput, {
            enableTime: true, dateFormat: "d/m/Y H:i", time_24hr: true, defaultDate: dueDate
        });

        document.getElementById('modal-cancel-btn').onclick = () => this.hideModal();
        this.modalContainer.querySelector('.modal-backdrop').onclick = () => this.hideModal();
        document.getElementById('task-form').onsubmit = (e) => {
            e.preventDefault();
            const newTaskData = {
                text: document.getElementById('task-text-input').value.trim(),
                dueDate: dueDateInput.value || null,
                priority: document.getElementById('priority-select').value
            };

            if (newTaskData.text === '') return;

            if (isEditing) {
                Object.assign(task, newTaskData);
                this.scheduleNotification(task);
            } else {
                const newTask = { id: Date.now(), completed: false, categoryId: this.data.activeCategoryId, ...newTaskData };
                this.data.tasks.push(newTask);
                this.scheduleNotification(newTask);
            }
            this.saveData();
            this.renderAll();
            this.hideModal();
        };
    }

    showConfirmModal(title, text, onConfirm) {
        const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 text-center">
                <h3 class="text-lg font-bold mb-4">${title}</h3>
                <p class="text-slate-600 mb-6">${text}</p>
                <div class="flex justify-center gap-4">
                    <button id="modal-cancel-btn" class="px-6 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">Hủy</button>
                    <button id="modal-confirm-btn" class="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition">Xác nhận</button>
                </div>
            </div>`;
        this.modalContainer.innerHTML = modalContent;
        this.modalContainer.classList.replace('hidden', 'flex');
        document.getElementById('modal-cancel-btn').onclick = () => this.hideModal();
        this.modalContainer.querySelector('.modal-backdrop').onclick = () => this.hideModal();
        document.getElementById('modal-confirm-btn').onclick = () => {
            onConfirm();
            this.hideModal();
        };
    }

    hideModal() {
        this.modalContainer.classList.replace('flex', 'hidden');
        this.modalContainer.innerHTML = '';
        if (this.flatpickrInstance) {
            this.flatpickrInstance.destroy();
            this.flatpickrInstance = null;
        }
    }

    // --- Notifications ---
    updateNotificationSettingUI(btn) {
        if (!btn) return;
        if (!('Notification' in window)) {
            btn.textContent = 'Không hỗ trợ';
            btn.disabled = true;
            return;
        }

        switch (Notification.permission) {
            case 'granted':
                btn.textContent = 'Đã bật';
                btn.className = 'btn-granted';
                btn.title = 'Thông báo đã được cho phép. Nhấn để kiểm tra.';
                break;
            case 'denied':
                btn.textContent = 'Đã chặn';
                btn.className = 'btn-denied';
                btn.title = 'Bạn đã chặn thông báo. Vui lòng bật trong cài đặt trình duyệt.';
                break;
            default:
                btn.textContent = 'Bật';
                btn.className = 'btn-default';
                btn.title = 'Nhấn để cho phép gửi thông báo.';
                break;
        }
    }

    handleNotificationClick(btn) {
        if (!('Notification' in window)) return;

        if (Notification.permission === 'granted') {
            this.notificationSound.currentTime = 0;
            this.notificationSound.play();
            new Notification('Kiểm tra thành công!', { body: 'Bạn sẽ nhận được thông báo như thế này.', icon: '/images/apple-touch-icon.png', silent: true });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.notificationSound.currentTime = 0;
                    this.notificationSound.play();
                    new Notification('Thông báo đã được bật!', { body: 'Ứng dụng giờ đây có thể gửi nhắc nhở cho bạn.', icon: '/images/apple-touch-icon.png', silent: true });
                }
                this.updateNotificationSettingUI(btn);
            });
        }
    }

    scheduleNotification(task) {
        if (this.notificationTimeouts[task.id]) clearTimeout(this.notificationTimeouts[task.id]);
        if (!task.dueDate || task.completed) return;

        const dueDate = new Date(task.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/, '$3-$2-$1T$4:$5:00'));
        const timeDiff = dueDate.getTime() - new Date().getTime();

        if (timeDiff > 0) {
            this.notificationTimeouts[task.id] = setTimeout(() => {
                if (Notification.permission === 'granted') {
                    this.notificationSound.currentTime = 0;
                    this.notificationSound.play();
                    new Notification('Nhắc nhở công việc!', { body: `Đã đến hạn cho công việc: "${task.text}"`, icon: '/images/apple-touch-icon.png', silent: true });
                }
                delete this.notificationTimeouts[task.id];
            }, timeDiff);
        }
    }

    cancelNotification(taskId) {
        if (this.notificationTimeouts[taskId]) {
            clearTimeout(this.notificationTimeouts[taskId]);
            delete this.notificationTimeouts[taskId];
        }
    }

    // --- AI Advisor ---
    parseMarkdown(markdown) {
        if (!markdown || !window.marked || !window.DOMPurify) return markdown.replace(/\n/g, '<br>');
        window.marked.setOptions({ breaks: true, gfm: true });
        return window.DOMPurify.sanitize(window.marked.parse(markdown));
    }

    async getAIAdvice() {
        const pendingTasks = this.data.tasks.filter(t => t.categoryId === this.data.activeCategoryId && !t.completed);
        if (pendingTasks.length === 0) {
            this.showConfirmModal('Cố vấn AI', 'Bạn không có công việc nào cần làm trong mục này!', () => { });
            return;
        }

        const loadingHTML = `<div class="modal-backdrop fixed inset-0"></div><div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 text-center"><div class="flex justify-center items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div><p class="ml-3 text-gray-600">AI đang suy nghĩ...</p></div></div>`;
        this.modalContainer.innerHTML = loadingHTML;
        this.modalContainer.classList.replace('hidden', 'flex');

        const taskListString = pendingTasks.map(t => `- ${t.text} (Ưu tiên: ${t.priority}, Hạn: ${t.dueDate || 'Không'})`).join('\n');
        const prompt = `Bạn là một trợ lý năng suất. Dựa vào danh sách công việc sau đây, hãy đưa ra lời khuyên ngắn gọn, hữu ích bằng tiếng Việt để giúp tôi hoàn thành chúng. Sử dụng Markdown để định dạng (in đậm, gạch đầu dòng).\n\nCông việc:\n${taskListString}`;

        try {
            const payload = { contents: [{ parts: [{ text: prompt }] }] };
            const apiKey = import.meta.env.VITE_AI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`API error: ${response.status}`);

            const result = await response.json();
            const advice = this.parseMarkdown(result.candidates[0].content.parts[0].text);

            const adviceHTML = `
                <div class="modal-backdrop fixed inset-0"></div>
                <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10 flex flex-col max-h-[85vh]">
                    <div class="p-5 border-b flex-shrink-0"><h3 class="text-lg font-medium flex items-center"><i class="fas fa-robot text-indigo-600 mr-3"></i> Cố vấn AI</h3></div>
                    <div class="p-6 text-left text-gray-700 overflow-y-auto prose">${advice}</div>
                    <div class="p-4 bg-slate-50 flex justify-end flex-shrink-0 border-t"><button id="modal-close-btn" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Đóng</button></div>
                </div>`;
            this.modalContainer.innerHTML = adviceHTML;
            document.getElementById('modal-close-btn').onclick = () => this.hideModal();
            this.modalContainer.querySelector('.modal-backdrop').onclick = () => this.hideModal();
        } catch (error) {
            console.error("AI Error:", error);
            this.showConfirmModal('Lỗi!', 'Không thể nhận được lời khuyên từ AI. Vui lòng kiểm tra lại kết nối mạng.', () => { });
        }
    }
}

// Chạy ứng dụng sau khi DOM đã tải xong
document.addEventListener('DOMContentLoaded', () => {
    const app = new TodoApp();
    app.init();
});