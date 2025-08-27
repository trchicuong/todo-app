class TodoApp {
    constructor() {
        this.docElement = document.documentElement;
        this.mainTitle = document.getElementById('main-title');
        this.categoryList = document.getElementById('category-list');
        this.categoryInput = document.getElementById('category-input');
        this.addCategoryBtn = document.getElementById('add-category-btn');
        this.taskInput = document.getElementById('task-input');
        this.dueDateInput = document.getElementById('due-date-input');
        this.addTaskBtn = document.getElementById('add-task-btn');
        this.taskList = document.getElementById('task-list');
        this.filterContainer = document.getElementById('filter-container');
        this.clearCompletedBtn = document.getElementById('clear-completed-btn');
        this.sortSelect = document.getElementById('sort-select');
        this.modalContainer = document.getElementById('modal-container');
        this.aiAdvisorBtn = document.getElementById('ai-advisor-btn');
        this.statTotalEl = document.getElementById('stat-total');
        this.statPendingEl = document.getElementById('stat-pending');
        this.statCompletedEl = document.getElementById('stat-completed');
        this.statProgressEl = document.getElementById('stat-progress');

        this.data = JSON.parse(localStorage.getItem('todoData')) || {
            categories: [{ id: 1, name: 'Công việc' }, { id: 2, name: 'Cá nhân' }],
            tasks: [],
            activeCategoryId: 1
        };
        this.currentFilter = 'all';
        this.priorities = ['low', 'medium', 'high'];
        this.currentSortMode = 'default';
        this.notificationTimeouts = {};

        this.flatpickrInstance = flatpickr(this.dueDateInput, {
            enableTime: true,
            dateFormat: "d/m/Y H:i",
            time_24hr: true,
        });
    }

    init() {
        this.docElement.classList.add('dark');
        this.requestNotificationPermission();
        this.addEventListeners();
        this.renderAll();
        this.data.tasks.forEach(task => this.scheduleNotification(task));
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
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
                    const notificationSound = new Audio('sound/notification.mp3');
                    notificationSound.play();
                    new Notification('Nhắc nhở công việc!', {
                        body: `Đã đến hạn cho công việc: "${task.text}"`,
                        icon: 'images/favicon-32x32.png'
                    });
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

    saveData() {
        localStorage.setItem('todoData', JSON.stringify(this.data));
    }

    renderAll() {
        this.renderCategories();
        this.renderTasks();
    }

    renderCategories() {
        this.categoryList.innerHTML = '';
        this.data.categories.forEach(cat => {
            const li = document.createElement('li');
            li.className = `category-item flex justify-between items-center p-2 rounded-lg cursor-pointer text-slate-300 hover:bg-white/10 transition-colors duration-200 ${cat.id === this.data.activeCategoryId ? 'active' : ''}`;
            li.dataset.id = cat.id;
            li.innerHTML = `<span class="font-medium">${cat.name}</span>${cat.id !== 1 && cat.id !== 2 ? `<button data-action="delete-category" class="text-slate-400 hover:text-red-500 text-xs transition-colors"><i class="fas fa-trash-alt"></i></button>` : ''}`;
            this.categoryList.appendChild(li);
        });
    }

    renderTasks() {
        this.taskList.innerHTML = '';
        const activeCategory = this.data.categories.find(c => c.id === this.data.activeCategoryId);
        this.mainTitle.textContent = activeCategory ? activeCategory.name : 'Chọn một hạng mục';
        const allTasksInCategory = this.data.tasks.filter(task => task.categoryId === this.data.activeCategoryId);

        const totalTasks = allTasksInCategory.length;
        const completedTasks = allTasksInCategory.filter(t => t.completed).length;
        const pendingTasks = totalTasks - completedTasks;
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        this.statTotalEl.innerHTML = `<div class="flex items-center"><div class="p-2 bg-blue-900/50 rounded-lg mr-3"><i class="fas fa-layer-group text-blue-500"></i></div><div><p class="text-sm text-slate-400">Tổng số</p><p class="text-2xl font-bold text-slate-100">${totalTasks}</p></div></div>`;
        this.statPendingEl.innerHTML = `<div class="flex items-center"><div class="p-2 bg-orange-900/50 rounded-lg mr-3"><i class="fas fa-clock text-orange-500"></i></div><div><p class="text-sm text-slate-400">Cần làm</p><p class="text-2xl font-bold text-slate-100">${pendingTasks}</p></div></div>`;
        this.statCompletedEl.innerHTML = `<div class="flex items-center"><div class="p-2 bg-green-900/50 rounded-lg mr-3"><i class="fas fa-check-circle text-green-500"></i></div><div><p class="text-sm text-slate-400">Hoàn thành</p><p class="text-2xl font-bold text-slate-100">${completedTasks}</p></div></div>`;
        this.statProgressEl.innerHTML = `<div><div class="flex justify-between items-center mb-1"><p class="text-sm text-slate-400">Tiến độ</p><p class="text-sm font-semibold text-indigo-400">${progress}%</p></div><div class="w-full bg-slate-600/80 rounded-full h-2.5"><div class="bg-indigo-500 h-2.5 rounded-full" style="width: ${progress}%"></div></div></div>`;

        let tasksToRender = allTasksInCategory.filter(task => {
            if (this.currentFilter === 'pending') return !task.completed;
            if (this.currentFilter === 'completed') return task.completed;
            return true;
        });

        if (this.currentSortMode === 'priority') {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            tasksToRender.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        } else if (this.currentSortMode === 'dueDate') {
            tasksToRender.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).getTime() : Infinity;
                const dateB = b.dueDate ? new Date(b.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')).getTime() : Infinity;
                return dateA - dateB;
            });
        }

        if (tasksToRender.length === 0) {
            const emptyMessage = allTasksInCategory.length > 0 ? 'Không có công việc nào khớp.' : 'Chưa có công việc nào.';
            this.taskList.innerHTML = `<li class="text-center text-slate-400 p-4">${emptyMessage}</li>`;
        } else {
            tasksToRender.forEach(task => {
                const li = document.createElement('li');
                const isOverdue = task.dueDate && !task.completed && new Date(task.dueDate.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')) < new Date();
                li.className = `task-item group flex items-center bg-slate-900/40 p-3 rounded-lg shadow-sm border border-slate-700/50 transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${task.completed ? 'completed' : ''}`;
                li.dataset.id = task.id;
                li.draggable = true;

                let dueDateHTML = '';
                if (task.dueDate) {
                    dueDateHTML = `<div class="mt-1 text-xs flex items-center ${isOverdue ? 'text-red-500' : 'text-slate-400'}"><i class="fas fa-bell mr-1.5"></i> ${task.dueDate}</div>`;
                }

                li.innerHTML = `<div class="priority-dot priority-${task.priority} mr-3 flex-shrink-0" data-action="toggle-priority"></div><div class="flex-grow"><span class="task-text text-slate-200 cursor-pointer" data-action="toggle-complete">${task.text}</span>${dueDateHTML}</div><div class="flex items-center gap-2 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"><button data-action="edit" class="px-2 text-slate-400 hover:text-indigo-500"><i class="fas fa-pencil-alt"></i></button><button data-action="delete" class="px-2 text-slate-400 hover:text-red-500"><i class="fas fa-trash-alt"></i></button></div>`;
                this.taskList.appendChild(li);
            });
        }

        this.clearCompletedBtn.classList.toggle('hidden', !tasksToRender.some(task => task.completed));
    }

    addCategory() {
        const name = this.categoryInput.value.trim();
        if (name) {
            const newCategory = { id: Date.now(), name };
            this.data.categories.push(newCategory);
            this.categoryInput.value = '';
            this.saveData();
            this.renderCategories();
        }
    }

    addTask() {
        const taskText = this.taskInput.value.trim();
        if (taskText === '' || !this.data.activeCategoryId) return;
        const dueDate = this.dueDateInput.value || null;
        const newTask = { id: Date.now(), text: taskText, completed: false, priority: 'medium', categoryId: this.data.activeCategoryId, dueDate: dueDate };
        this.data.tasks.push(newTask);
        this.scheduleNotification(newTask);
        this.saveData();
        this.renderTasks();
        this.taskInput.value = '';
        this.flatpickrInstance.clear();
        this.taskInput.focus();
    }

    enableEditing(taskItem) {
        const task = this.data.tasks.find(t => t.id === Number(taskItem.dataset.id));
        if (!task) return;

        const taskContentWrapper = taskItem.querySelector('.flex-grow');
        taskItem.classList.add('editing');
        const input = document.createElement('input');
        input.type = 'text';
        input.value = task.text;
        input.className = 'w-full p-1 border-b-2 border-indigo-500 focus:outline-none bg-transparent text-slate-200';

        const dateInputWrapper = document.createElement('div');
        dateInputWrapper.className = 'relative mt-2';
        dateInputWrapper.innerHTML = `
            <input type="text" placeholder="Chọn hạn chót..." class="w-full p-1 border-b-2 border-indigo-500 focus:outline-none bg-transparent text-slate-200 text-sm">
            <i class="fas fa-calendar-alt absolute right-1 top-1/2 -translate-y-1/2 text-slate-400"></i>
        `;
        const dateInput = dateInputWrapper.querySelector('input');

        taskContentWrapper.innerHTML = '';
        taskContentWrapper.appendChild(input);
        taskContentWrapper.appendChild(dateInputWrapper);

        const editorFlatpickr = flatpickr(dateInput, {
            enableTime: true,
            dateFormat: "d/m/Y H:i",
            time_24hr: true,
            defaultDate: task.dueDate
        });

        input.focus();

        const saveEdit = () => {
            const newText = input.value.trim();
            const newDate = dateInput.value || null;
            if (task && newText) {
                task.text = newText;
                task.dueDate = newDate;
                this.scheduleNotification(task);
            }
            this.saveData();
            this.renderTasks();
        };

        const handleBlur = (e) => {
            setTimeout(() => {
                if (!taskContentWrapper.contains(document.activeElement)) {
                    saveEdit();
                }
            }, 150);
        };

        input.addEventListener('blur', handleBlur);
        dateInput.addEventListener('blur', handleBlur);
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') input.blur(); });
    }

    showModal(content) {
        this.modalContainer.innerHTML = content;
        this.modalContainer.classList.remove('hidden');
    }

    hideModal() {
        this.modalContainer.classList.add('hidden');
    }

    showConfirmModal(title, text, onConfirmAction) {
        const content = `<div class="modal-box glass-container p-6 rounded-lg shadow-xl text-center w-full max-w-sm"><h2 class="text-lg font-bold mb-4 text-slate-100">${title}</h2><p class="text-slate-300 mb-6">${text}</p><div class="flex justify-center gap-4"><button id="modal-cancel-btn" class="bg-slate-700/50 text-slate-200 px-6 py-2 rounded-lg hover:bg-slate-600/50 transition">Hủy</button><button id="modal-confirm-btn" class="bg-red-500 text-white px-6 py-2 rounded-lg hover:bg-red-600 transition">Xác nhận</button></div></div>`;
        this.showModal(content);
        document.getElementById('modal-cancel-btn').onclick = () => this.hideModal();
        document.getElementById('modal-confirm-btn').onclick = () => {
            onConfirmAction();
            this.hideModal();
        };
    }

    parseMarkdown(markdown) {
        if (!markdown) return '';
        if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
            return markdown.replace(/\n/g, '<br>');
        }
        marked.setOptions({ breaks: true, gfm: true });
        const rawHtml = marked.parse(markdown);
        return DOMPurify.sanitize(rawHtml);
    }

    async getAIAdvice() {
        const pendingTasks = this.data.tasks.filter(t => t.categoryId === this.data.activeCategoryId && !t.completed);
        if (pendingTasks.length === 0) {
            this.showConfirmModal('Cố vấn AI', 'Bạn không có công việc nào cần làm. Hãy tận hưởng thời gian rảnh!', () => { });
            return;
        }

        const loadingHTML = `<div class="modal-box glass-container p-6 rounded-lg shadow-xl text-center w-full max-w-md"><div class="flex justify-center items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div><p class="ml-3 text-slate-300">AI đang suy nghĩ...</p></div></div>`;
        this.showModal(loadingHTML);

        const taskListString = pendingTasks.map(t => `- ${t.text} (Ưu tiên: ${t.priority}, Hạn: ${t.dueDate || 'Không có'})`).join('\n');
        const prompt = `Bạn là một trợ lý năng suất chuyên nghiệp. Dựa vào danh sách công việc sau đây, hãy đưa ra lời khuyên ngắn gọn, hữu ích và khích lệ bằng tiếng Việt để giúp tôi hoàn thành chúng hiệu quả. Sử dụng Markdown để định dạng câu trả lời (ví dụ: dùng **chữ đậm**, *chữ nghiêng*, và gạch đầu dòng).\n\nDanh sách công việc:\n${taskListString}`;

        try {
            const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`API error: ${response.statusText}`);

            const result = await response.json();
            const advice = this.parseMarkdown(result.candidates[0].content.parts[0].text);

            const adviceHTML = `<div class="modal-box glass-container rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[85vh]"><div class="p-6 flex-shrink-0 border-b border-white/10"><h2 class="text-lg font-bold text-slate-100 flex items-center"><i class="fas fa-robot text-indigo-500 mr-3"></i> Cố vấn AI</h2></div><div id="modal-content" class="p-6 text-left text-slate-300 overflow-y-auto prose dark:prose-invert">${advice}</div><div class="p-4 flex justify-end flex-shrink-0 border-t border-white/10"><button id="modal-close-btn" class="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition">Đóng</button></div></div>`;
            this.showModal(adviceHTML);
            document.getElementById('modal-close-btn').onclick = () => this.hideModal();

        } catch (error) {
            console.error("API Error:", error);
            const errorHTML = `<div class="modal-box glass-container p-6 rounded-lg shadow-xl text-center w-full max-w-sm"><h2 class="text-lg font-bold mb-4 text-red-500">Lỗi!</h2><p class="text-slate-300 mb-6">Không thể nhận được lời khuyên từ AI lúc này. Vui lòng thử lại sau.</p><div class="flex justify-center"><button id="modal-close-btn" class="bg-slate-700/50 text-slate-200 px-6 py-2 rounded-lg">Đóng</button></div></div>`;
            this.showModal(errorHTML);
            document.getElementById('modal-close-btn').onclick = () => this.hideModal();
        }
    }

    addEventListeners() {
        this.addCategoryBtn.addEventListener('click', () => this.addCategory());
        this.categoryInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addCategory(); });
        this.addTaskBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.addTask(); });
        this.aiAdvisorBtn.addEventListener('click', () => this.getAIAdvice());
        this.sortSelect.addEventListener('change', (e) => {
            this.currentSortMode = e.target.value;
            this.renderTasks();
        });

        this.categoryList.addEventListener('click', (e) => {
            const categoryItem = e.target.closest('.category-item');
            if (!categoryItem) return;
            const categoryId = Number(categoryItem.dataset.id);
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'delete-category') {
                this.showConfirmModal('Xóa hạng mục?', `Hành động này sẽ xóa tất cả công việc trong hạng mục này. Bạn có chắc chắn?`, () => {
                    this.data.categories = this.data.categories.filter(c => c.id !== categoryId);
                    this.data.tasks.forEach(t => { if (t.categoryId === categoryId) this.cancelNotification(t.id); });
                    this.data.tasks = this.data.tasks.filter(t => t.categoryId !== categoryId);
                    if (this.data.activeCategoryId === categoryId) { this.data.activeCategoryId = 1; }
                    this.saveData();
                    this.renderAll();
                });
            } else {
                this.data.activeCategoryId = categoryId;
                this.saveData();
                this.renderAll();
            }
        });

        this.taskList.addEventListener('click', (e) => {
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
                    const allTasksInCategory = this.data.tasks.filter(t => t.categoryId === this.data.activeCategoryId);
                    const pendingCountBefore = allTasksInCategory.filter(t => !t.completed).length;
                    task.completed = !task.completed;
                    if (task.completed) this.cancelNotification(task.id); else this.scheduleNotification(task);
                    const pendingCountAfter = allTasksInCategory.filter(t => !t.completed).length;
                    if (pendingCountBefore > 0 && pendingCountAfter === 0) {
                        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                    }
                    break;
                case 'edit':
                    this.enableEditing(taskItem);
                    return;
                case 'delete':
                    this.showConfirmModal('Xóa công việc?', `Bạn có chắc muốn xóa công việc "${task.text}"?`, () => {
                        this.cancelNotification(taskId);
                        this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
                        this.saveData();
                        this.renderTasks();
                    });
                    return;
            }
            this.saveData();
            this.renderTasks();
        });

        this.taskList.addEventListener('dragstart', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) {
                this.draggedTaskId = Number(taskItem.dataset.id);
                setTimeout(() => taskItem.classList.add('dragging'), 0);
            }
        });
        this.taskList.addEventListener('dragend', (e) => {
            const taskItem = e.target.closest('.task-item');
            if (taskItem) taskItem.classList.remove('dragging');
            this.draggedTaskId = null;
        });
        this.taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (dragging) {
                if (afterElement == null) this.taskList.appendChild(dragging);
                else this.taskList.insertBefore(dragging, afterElement);
            }
        });
        this.taskList.addEventListener('drop', (e) => {
            e.preventDefault();
            this.currentSortMode = 'default';
            this.sortSelect.value = 'default';

            const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
            const draggedTaskIndex = this.data.tasks.findIndex(t => t.id === this.draggedTaskId);
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

        this.filterContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.filter-btn');
            if (!target) return;
            this.currentFilter = target.dataset.filter;
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('bg-indigo-500', 'text-white');
                btn.classList.add('bg-slate-700/50', 'text-slate-300');
            });
            target.classList.add('bg-indigo-500', 'text-white');
            target.classList.remove('bg-slate-700/50', 'text-slate-300');
            this.renderTasks();
        });
        this.clearCompletedBtn.addEventListener('click', () => {
            this.showConfirmModal('Dọn dẹp?', 'Xóa tất cả các công việc đã hoàn thành trong hạng mục này?', () => {
                this.data.tasks.forEach(t => { if (t.categoryId === this.data.activeCategoryId && t.completed) this.cancelNotification(t.id); });
                this.data.tasks = this.data.tasks.filter(t => t.categoryId !== this.data.activeCategoryId || !t.completed);
                this.saveData();
                this.renderTasks();
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
}

const app = new TodoApp();
document.addEventListener('DOMContentLoaded', () => app.init());