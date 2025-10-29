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
    this.searchInput = document.getElementById('search-input');
    this.quickAddInput = document.getElementById('quick-add-input');
    this.quickAddVoiceBtn = document.getElementById('quick-add-voice-btn');
    this.quickAddExamplesBtn = document.getElementById('quick-add-examples-btn');
    this.quickAddExamplesMenu = document.getElementById('quick-add-examples-menu');
    this.modalContainer = document.getElementById('modal-container');
    this.aiAdvisorBtn = document.getElementById('ai-advisor-btn');
    this.helpBtn = document.getElementById('help-btn');
    this.reloadBtn = document.getElementById('reload-btn');
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
    // Smart nudge elements
    this.smartNudgeEl = document.getElementById('smart-nudge');
    this.nudgeTextEl = document.getElementById('nudge-text');
    this.nudgeStartBtn = document.getElementById('nudge-start-btn');
    this.nudgeTaskId = null;

    // --- App State ---
    this.data = JSON.parse(localStorage.getItem('todoData_v2')) || {
      categories: [
        { id: 1, name: 'Công việc' },
        { id: 2, name: 'Cá nhân' },
      ],
      tasks: [],
      activeCategoryId: 1,
    };
    // Normalize task schema for backward compatibility
    this.data.tasks = (this.data.tasks || []).map((t) => ({
      id: t.id || Date.now(),
      text: t.text || '',
      completed: !!t.completed,
      categoryId: t.categoryId || 1,
      dueDate: t.dueDate || null,
      priority: t.priority || 'medium',
      tags: Array.isArray(t.tags) ? t.tags : [],
      notes: typeof t.notes === 'string' ? t.notes : '',
      reminderMinutes: typeof t.reminderMinutes === 'number' ? t.reminderMinutes : 0,
      recurrence: t.recurrence || 'none',
      streak: typeof t.streak === 'number' ? t.streak : 0,
      estimatedMinutes: typeof t.estimatedMinutes === 'number' ? t.estimatedMinutes : 0,
    }));
    this.currentFilter = 'all';
    this.currentSortMode = 'default';
    this.searchQuery = '';
    this.searchDebounce = null;
    this.priorities = ['low', 'medium', 'high'];
    this.flatpickrInstance = null;
    this.draggedTaskId = null;

    // --- AI Cooldown State ---
    this.aiCooldownInterval = null; // ticker for button title/badge
    this.aiCooldownModalInterval = null; // ticker for modal countdown

    // --- Push state ---
    this.pushSubscription = null;

    // --- Settings ---
    const defaultSettings = {
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
      dailyBrief: true,
      prioritySuggestions: true,
      showEstimatedBadge: true,
      todayPlanDefaultReminder: 10,
    };
    try {
      const s = JSON.parse(localStorage.getItem('todoSettings_v1'));
      this.settings = {
        ...defaultSettings,
        ...(s || {}),
        quietHours: { ...defaultSettings.quietHours, ...(s?.quietHours || {}) },
      };
    } catch (_) {
      this.settings = defaultSettings;
    }
  }

  async init() {
    this.addEventListeners();
    this.renderAll();
    // Apply saved theme
    const savedTheme = localStorage.getItem('todoTheme');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-mode');
      // remove preload flag if present
      document.documentElement.removeAttribute('data-theme');
    }
    // Daily brief (once per day)
    if (this.settings.dailyBrief) this.maybeShowDailyBrief();
    // Initialize push subscription if available
    await this.initPushSubscription();
    // Schedule push notifications for tasks
    await this.scheduleAllPushNotifications();

    // Restore reload hint state
    if (localStorage.getItem('todo_reload_hint') === '1') this.markReloadNeeded(true);

    // Start AI cooldown ticker if needed
    this.startAICooldownTicker();
  }

  renderAll() {
    this.renderCategories();
    this.renderTasks();
    this.updateGlobalStats();
  }

  saveData() {
    try {
      localStorage.setItem('todoData_v2', JSON.stringify(this.data));
    } catch (err) {
      console.warn('saveData failed:', err);
    }
  }

  updateSettings(patch) {
    // Shallow merge top-level, deep-merge quietHours
    const next = { ...this.settings };
    if (patch.hasOwnProperty('dailyBrief')) next.dailyBrief = !!patch.dailyBrief;
    if (patch.hasOwnProperty('prioritySuggestions'))
      next.prioritySuggestions = !!patch.prioritySuggestions;
    if (patch.hasOwnProperty('showEstimatedBadge'))
      next.showEstimatedBadge = !!patch.showEstimatedBadge;
    if (patch.hasOwnProperty('todayPlanDefaultReminder'))
      next.todayPlanDefaultReminder = Number(patch.todayPlanDefaultReminder) || 0;
    if (patch.quietHours) {
      next.quietHours = {
        ...next.quietHours,
        ...patch.quietHours,
      };
    }
    this.settings = next;
    try {
      localStorage.setItem('todoSettings_v1', JSON.stringify(this.settings));
    } catch (_) {}
    // Re-schedule push notifications with potential quiet hours changes
    this.scheduleAllPushNotifications();
    // Indicate reload suggested
    this.markReloadNeeded(true);
    try {
      localStorage.setItem('todo_reload_hint', '1');
    } catch (_) {}
  }

  renderCategories() {
    this.categoryList.innerHTML = '';
    this.data.categories.forEach((cat) => {
      const li = document.createElement('li');
      const pendingCount = this.data.tasks.filter(
        (t) => t.categoryId === cat.id && !t.completed,
      ).length;

      li.className = `category-item flex justify-between items-center px-3 py-2.5 text-sm text-slate-600 rounded-lg cursor-pointer ${
        cat.id === this.data.activeCategoryId ? 'active' : ''
      }`;
      li.dataset.id = cat.id;
      li.innerHTML = `
                <span class="flex items-center">
                    <i class="fa-solid fa-folder w-6 text-center text-slate-500"></i>
                    <span class="ml-3">${cat.name}</span>
                </span>
                <div class="flex items-center">
                    ${
                      pendingCount > 0 ? `<span class="task-count mr-2">${pendingCount}</span>` : ''
                    }
                    ${
                      cat.id !== 1 && cat.id !== 2
                        ? `<button data-action="delete-category" class="text-slate-400 hover:text-red-500 text-xs transition-colors"><i class="fas fa-trash-alt"></i></button>`
                        : ''
                    }
                </div>
            `;
      this.categoryList.appendChild(li);
    });
  }

  renderTasks() {
    this.taskList.innerHTML = '';
    const activeCategory = this.data.categories.find((c) => c.id === this.data.activeCategoryId);
    this.mainTitle.textContent = activeCategory ? activeCategory.name : 'Vui lòng chọn hạng mục';

    let tasksToRender = this.data.tasks
      .filter((task) => task.categoryId === this.data.activeCategoryId)
      .filter((task) => {
        if (this.currentFilter === 'pending') return !task.completed;
        if (this.currentFilter === 'completed') return task.completed;
        return true;
      })
      .filter((task) => {
        if (!this.searchQuery) return true;
        const hitText = (task.text || '').toLowerCase().includes(this.searchQuery);
        const hitTags = (task.tags || []).some((tag) =>
          (tag || '').toLowerCase().includes(this.searchQuery),
        );
        return hitText || hitTags;
      });

    // Sorting Logic
    if (this.currentSortMode === 'priority') {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      tasksToRender.sort(
        (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
      );
    } else if (this.currentSortMode === 'dueDate') {
      tasksToRender.sort((a, b) => {
        const dateA = a.dueDate ? this.parseDateTime(a.dueDate)?.getTime() ?? Infinity : Infinity;
        const dateB = b.dueDate ? this.parseDateTime(b.dueDate)?.getTime() ?? Infinity : Infinity;
        return dateA - dateB;
      });
    }

    // Smart Nudge: show nearest due within 60 minutes
    const now = new Date();
    const soon = this.data.tasks
      .filter((t) => t.categoryId === this.data.activeCategoryId && !t.completed && t.dueDate)
      .map((t) => ({ t, d: this.parseDateTime(t.dueDate) }))
      .filter((x) => x.d && x.d > now && x.d - now <= 60 * 60000)
      .sort((a, b) => a.d - b.d)[0];
    if (soon) {
      this.nudgeTaskId = soon.t.id;
      if (this.smartNudgeEl && this.nudgeTextEl) {
        const mins = Math.max(1, Math.round((soon.d - now) / 60000));
        this.nudgeTextEl.textContent = `Sắp đến hạn trong ${mins} phút: ${soon.t.text}`;
        this.smartNudgeEl.classList.remove('hidden');
      }
    } else {
      this.nudgeTaskId = null;
      if (this.smartNudgeEl) this.smartNudgeEl.classList.add('hidden');
    }

    if (this.nudgeStartBtn) {
      this.nudgeStartBtn.onclick = () => {
        if (!this.nudgeTaskId) return;
        const t = this.data.tasks.find((x) => x.id === this.nudgeTaskId);
        if (t) this.showFocusModal(t);
      };
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
      tasksToRender.forEach((task) => this.taskList.appendChild(this.createTaskElement(task)));
    }

    const hasCompletedTasks = this.data.tasks.some(
      (t) => t.categoryId === this.data.activeCategoryId && t.completed,
    );
    this.clearCompletedBtn.classList.toggle('hidden', !hasCompletedTasks);
  }

  handleTouchStart(e) {
    // Only initiate touch-reorder when starting from the drag handle
    const handle = e.target.closest('.task-drag-handle');
    if (!handle) return;
    const taskItem = handle.closest('.task-item');
    if (!taskItem) return;
    this.draggedTaskId = Number(taskItem.dataset.id);
    setTimeout(() => taskItem.classList.add('dragging'), 0);
  }

  handleTouchMove(e) {
    if (this.draggedTaskId === null) return;

    e.preventDefault();

    const dragging = document.querySelector('.dragging');
    if (!dragging) return;

    const touchLocation = e.targetTouches[0];

    const afterElement = this.getDragAfterElement(this.taskList, touchLocation.clientY);

    if (afterElement == null) {
      this.taskList.appendChild(dragging);
    } else {
      this.taskList.insertBefore(dragging, afterElement);
    }
  }

  handleTouchEnd(e) {
    if (this.draggedTaskId === null) return;

    const dragging = document.querySelector('.dragging');
    if (dragging) {
      dragging.classList.remove('dragging');
    }

    this.currentSortMode = 'default';
    this.sortSelect.value = 'default';

    const taskElements = [...this.taskList.querySelectorAll('.task-item')];
    const newOrderedTasks = [];

    const otherCategoryTasks = this.data.tasks.filter(
      (t) => t.categoryId !== this.data.activeCategoryId,
    );

    taskElements.forEach((el) => {
      const taskId = Number(el.dataset.id);
      const task = this.data.tasks.find((t) => t.id === taskId);
      if (task) {
        newOrderedTasks.push(task);
      }
    });

    this.data.tasks = [...newOrderedTasks, ...otherCategoryTasks];

    this.draggedTaskId = null;
    this.saveData();
  }

  getSuggestedPriority(task) {
    if (!task || task.completed) return null;
    const text = (task.text || '').toLowerCase();
    const tags = (task.tags || []).map((t) => (t || '').toLowerCase());
    const urgentKeywords = ['urgent', 'khẩn', 'gấp'];
    const hasUrgent = urgentKeywords.some((k) => text.includes(k) || tags.includes(k));
    if (hasUrgent) return 'high';
    // Use due date proximity
    if (task.dueDate) {
      const d = this.parseDateTime(task.dueDate);
      if (d) {
        const diffMs = d.getTime() - Date.now();
        if (diffMs <= 0) return 'high'; // overdue
        const hours = diffMs / 3600000;
        if (hours <= 24) return 'high';
        if (hours <= 72) return 'medium';
        return 'low';
      }
    }
    return 'medium';
  }

  createTaskElement(task) {
    const li = document.createElement('li');
    const isOverdue =
      task.dueDate &&
      !task.completed &&
      (this.parseDateTime(task.dueDate) ?? new Date(8640000000000000)) < new Date();

    li.className = `task-item group relative flex items-start justify-between p-4 border-b border-slate-100 ${
      task.completed ? 'completed' : ''
    }`;
    li.dataset.id = task.id;
    // Only enable drag via explicit handle for better mobile UX
    li.draggable = false;

    let dueDateHTML = '';
    if (task.dueDate) {
      dueDateHTML = `<div class="due-date-text mt-1 text-xs flex items-center ${
        isOverdue ? 'text-red-500 font-semibold' : 'text-gray-500'
      }">
                               <i class="fas fa-bell mr-1.5"></i> ${task.dueDate}
                           </div>`;
    }

    let tagsHTML = '';
    if (task.tags && task.tags.length) {
      tagsHTML = `<div class="mt-1 flex flex-wrap gap-1">${task.tags
        .map((t) => `<span class=\"tag-badge\">#${(t || '').trim()}</span>`)
        .join('')}</div>`;
    }

    let estHTML = '';
    if (
      this.settings.showEstimatedBadge &&
      typeof task.estimatedMinutes === 'number' &&
      task.estimatedMinutes > 0
    ) {
      estHTML = `<div class="mt-1 text-xs text-slate-500 flex items-center"><i class='fas fa-stopwatch mr-1.5'></i>Ước tính: ${task.estimatedMinutes} phút</div>`;
    }

    const priorityTitles = {
      low: 'Ưu tiên: Thấp (nhấn để đổi)',
      medium: 'Ưu tiên: Trung bình (nhấn để đổi)',
      high: 'Ưu tiên: Cao (nhấn để đổi)',
    };

    // Priority suggestion
    const suggested = this.getSuggestedPriority(task);

    li.innerHTML = `
            <div data-action="toggle-priority" class="absolute inset-y-0 left-0 w-5 cursor-pointer" title="${
              priorityTitles[task.priority] || 'Ưu tiên trung bình'
            }">
                <div class="absolute inset-y-0 left-0 w-1 priority-${task.priority}"></div>
            </div>
            <div class="flex items-start flex-1 min-w-0 mr-4 ml-5">
                <input id="task-${
                  task.id
                }" type="checkbox" data-action="toggle-complete" class="h-5 w-5 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0 mt-0.5" ${
      task.completed ? 'checked' : ''
    }>
                <div class="ml-4 flex-1 min-w-0">
                    <div class="font-medium block task-title">${task.text} ${
      task.notes ? "<i class='fas fa-note-sticky text-slate-400 ml-1' title='Có ghi chú'></i>" : ''
    }</div>
                    ${dueDateHTML}
          ${tagsHTML}
          ${estHTML}
          ${
            this.settings.prioritySuggestions &&
            !task.completed &&
            suggested &&
            suggested !== task.priority
              ? `<div class=\"mt-1 text-xs text-violet-700 priority-suggest\"><span class=\"suggest-label inline-flex items-center\"><i class='fas fa-bolt mr-1'></i>Gợi ý ưu tiên: <strong class=\"ml-1\">${
                  suggested === 'high' ? 'Cao' : suggested === 'medium' ? 'Trung bình' : 'Thấp'
                }</strong></span><button class=\"suggest-apply px-2 py-0.5 rounded bg-violet-100 hover:bg-violet-200 text-violet-700\" data-action=\"apply-priority-suggestion\" data-suggest=\"${suggested}\">Áp dụng</button></div>`
              : ''
          }
                    ${
                      task.streak && task.streak > 0
                        ? `<div class="mt-1 text-xs text-amber-600 flex items-center"><i class='fas fa-fire mr-1'></i>Chuỗi thói quen: ${task.streak}</div>`
                        : ''
                    }
                </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 ml-4">
        <div class="task-actions-wrap flex items-center gap-3 flex-shrink-0 ml-4">
                    <button data-action="snooze" class="text-slate-400 hover:text-amber-600" title="Hoãn nhắc (Snooze)"><i class="fas fa-clock text-sm me-2"></i></button>
          <button data-action="focus" class="text-slate-400 hover:text-emerald-600" title="Tập trung 25 phút"><i class="fas fa-hourglass-start text-sm me-2"></i></button>
          ${
            isOverdue
              ? `<button data-action="smart-defer" class="text-slate-400 hover:text-violet-600" title="Đề xuất dời thông minh"><i class="fas fa-forward text-sm me-2"></i></button>`
              : ''
          }
                    <button data-action="share" class="text-slate-400 hover:text-sky-600" title="Chia sẻ"><i class="fas fa-share-from-square text-sm me-2"></i></button>
                    <button data-action="edit" class="text-slate-400 hover:text-indigo-600" title="Chỉnh sửa"><i class="fas fa-pencil-alt text-sm me-2"></i></button>
                    <button data-action="delete" class="text-slate-400 hover:text-red-500" title="Xóa"><i class="fas fa-trash-alt text-sm me-2"></i></button>
                    <button data-action="drag-handle" class="text-slate-400 hover:text-slate-600 task-drag-handle" title="Sắp xếp"><i class="fas fa-grip-vertical text-base"></i></button>
                </div>
            </div>
        `;
    return li;
  }

  updateGlobalStats() {
    const allTasks = this.data.tasks;
    const now = new Date();
    const todayKey = this.dateOnly(now).getTime();

    const todayCount = allTasks.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      const d = this.parseDateTime(t.dueDate);
      if (!d) return false;
      return this.dateOnly(d).getTime() === todayKey && d >= now;
    }).length;

    const overdueCount = allTasks.filter((t) => {
      if (t.completed || !t.dueDate) return false;
      const d = this.parseDateTime(t.dueDate);
      if (!d) return false;
      return d < now;
    }).length;
    const pendingCount = allTasks.filter((t) => !t.completed).length;
    const completedCount = allTasks.filter((t) => t.completed).length;

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
    this.categoryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addCategory();
    });
    this.addTaskBtn.addEventListener('click', () => this.showTaskModal());
    this.aiAdvisorBtn.addEventListener('click', () => this.getAIAdvice());
    if (this.helpBtn) this.helpBtn.addEventListener('click', () => this.showHelpModal());
    if (this.reloadBtn)
      this.reloadBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem('todo_reload_hint');
        } catch (_) {}
        window.location.reload();
      });
    this.settingsBtn.addEventListener('click', () => this.showSettingsModal());
    this.sortSelect.addEventListener('change', (e) => {
      this.currentSortMode = e.target.value;
      this.renderTasks();
    });

    // Search input with debounce
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().toLowerCase();
        clearTimeout(this.searchDebounce);
        this.searchDebounce = setTimeout(() => {
          this.searchQuery = val;
          this.renderTasks();
        }, 200);
      });
    }

    // Quick Add input handler
    if (this.quickAddInput) {
      this.quickAddInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const raw = this.quickAddInput.value.trim();
          if (!raw) return;
          this.addQuickTaskFromRaw(raw);
          this.quickAddInput.value = '';
        }
      });
    }

    // Voice Quick Add
    if (this.quickAddVoiceBtn) {
      this.quickAddVoiceBtn.addEventListener('click', () => this.startVoiceQuickAdd());
    }

    // Quick Add Examples: toggle menu and insert example
    if (this.quickAddExamplesBtn && this.quickAddExamplesMenu) {
      this.quickAddExamplesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.quickAddExamplesMenu.classList.toggle('hidden');
      });
      // Insert selected example into input
      this.quickAddExamplesMenu.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-example]');
        if (!btn) return;
        const example = btn.getAttribute('data-example') || '';
        if (this.quickAddInput) {
          this.quickAddInput.value = example;
          this.quickAddInput.focus();
          try {
            const len = example.length;
            this.quickAddInput.setSelectionRange(len, len);
          } catch (_) {}
        }
        this.quickAddExamplesMenu.classList.add('hidden');
      });
      // Close when clicking outside
      document.addEventListener('click', (e) => {
        const insideMenu = e.target.closest('#quick-add-examples-menu');
        const onBtn = e.target.closest('#quick-add-examples-btn');
        if (!insideMenu && !onBtn) this.quickAddExamplesMenu.classList.add('hidden');
      });
    }

    this.categoryList.addEventListener('click', (e) => {
      const categoryItem = e.target.closest('.category-item');
      if (!categoryItem) return;
      const categoryId = Number(categoryItem.dataset.id);
      const action = e.target.closest('[data-action]')?.dataset.action;

      if (action === 'delete-category') {
        this.showConfirmModal(
          'Xóa hạng mục?',
          `Hành động này sẽ xóa tất cả công việc trong hạng mục này. Bạn có chắc chắn?`,
          () => {
            this.data.tasks.forEach((t) => {
              if (t.categoryId === categoryId) this.cancelNotification(t.id);
            });
            this.data.tasks = this.data.tasks.filter((t) => t.categoryId !== categoryId);
            this.data.categories = this.data.categories.filter((c) => c.id !== categoryId);
            if (this.data.activeCategoryId === categoryId)
              this.data.activeCategoryId = this.data.categories[0]?.id || null;
            this.saveData();
            this.renderAll();
          },
        );
      } else {
        this.data.activeCategoryId = categoryId;
        this.saveData();
        this.renderAll();
        if (this.sidebar.classList.contains('open')) {
          this.toggleSidebar();
        }
      }
    });

    this.taskList.addEventListener('click', (e) => {
      const taskItem = e.target.closest('.task-item');
      if (!taskItem) return;
      const taskId = Number(taskItem.dataset.id);
      const task = this.data.tasks.find((t) => t.id === taskId);
      if (!task) return;
      const action = e.target.closest('[data-action]')?.dataset.action;

      switch (action) {
        case 'apply-priority-suggestion':
          {
            const sug = e.target.closest('[data-suggest]')?.dataset.suggest;
            if (sug && ['low', 'medium', 'high'].includes(sug)) {
              task.priority = sug;
              this.saveData();
              this.renderTasks();
            }
          }
          return;
        case 'toggle-priority':
          const currentPriorityIndex = this.priorities.indexOf(task.priority);
          task.priority = this.priorities[(currentPriorityIndex + 1) % this.priorities.length];
          break;
        case 'toggle-complete':
          const pendingBefore = this.data.tasks.filter(
            (t) => t.categoryId === this.data.activeCategoryId && !t.completed,
          ).length;
          task.completed = e.target.checked;
          const pendingAfter = this.data.tasks.filter(
            (t) => t.categoryId === this.data.activeCategoryId && !t.completed,
          ).length;
          if (pendingBefore > 0 && pendingAfter === 0) {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
          }
          if (task.completed) {
            this.cancelNotification(task.id);
            // Handle recurrence: create next occurrence if applicable
            if (task.recurrence && task.recurrence !== 'none' && task.dueDate) {
              const next = { ...task };
              next.id = Date.now();
              next.completed = false;
              next.dueDate = this.computeNextDueDate(task.dueDate, task.recurrence);
              // Habit streak: if completed on/before due time -> increment streak, else reset
              const nowTs = Date.now();
              const due = this.parseDateTime(task.dueDate);
              if (due && nowTs <= due.getTime()) {
                next.streak = (task.streak || 0) + 1;
              } else {
                next.streak = 0;
              }
              // Keep notifications consistent
              this.data.tasks.push(next);
              this.scheduleNotification(next);
            }
          } else {
            this.scheduleNotification(task);
          }
          break;
        case 'edit':
          this.showTaskModal(task);
          return;
        case 'snooze':
          this.showSnoozeModal(task);
          return;
        case 'focus':
          this.showFocusModal(task);
          return;
        case 'smart-defer':
          this.showSmartDeferModal(task);
          return;
        case 'share':
          this.showShareTaskModal(task);
          return;
        case 'delete':
          this.showConfirmModal(
            'Xóa công việc?',
            `Bạn có chắc muốn xóa công việc "${task.text}"?`,
            () => {
              this.cancelNotification(taskId);
              this.data.tasks = this.data.tasks.filter((t) => t.id !== taskId);
              this.saveData();
              this.renderAll();
            },
          );
          return;
        default:
          // On touch devices, avoid toggling completion when tapping the row
          const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
          if (isCoarse) {
            // No-op: users can use visible action buttons or the checkbox
            return;
          } else {
            if (
              !e.target.closest('button') &&
              !e.target.closest('[data-action="toggle-priority"]')
            ) {
              const checkbox = taskItem.querySelector(`#task-${task.id}`);
              checkbox.checked = !checkbox.checked;
              const event = new Event('click', { bubbles: true });
              checkbox.dispatchEvent(event);
            }
            return;
          }
      }
      this.saveData();
      this.renderAll();
    });

    // Drag and Drop (desktop via handle)
    this.taskList.addEventListener('mousedown', (e) => {
      const handle = e.target.closest('.task-drag-handle');
      if (!handle) return;
      const taskItem = handle.closest('.task-item');
      if (!taskItem) return;
      taskItem.draggable = true;
      taskItem.dataset.dragByHandle = '1';
    });
    this.taskList.addEventListener('mouseup', (e) => {
      const taskItem = e.target.closest('.task-item');
      if (taskItem) {
        taskItem.draggable = false;
        delete taskItem.dataset.dragByHandle;
      }
    });
    this.taskList.addEventListener('dragstart', (e) => {
      const taskItem = e.target.closest('.task-item');
      if (!taskItem || !taskItem.dataset.dragByHandle) {
        e.preventDefault();
        return;
      }
      this.draggedTaskId = Number(taskItem.dataset.id);
      setTimeout(() => taskItem.classList.add('dragging'), 0);
    });
    this.taskList.addEventListener('dragend', (e) => {
      e.target.closest('.task-item')?.classList.remove('dragging');
      this.draggedTaskId = null;
      const taskItem = e.target.closest('.task-item');
      if (taskItem) {
        taskItem.draggable = false;
        delete taskItem.dataset.dragByHandle;
      }
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

      // BUG FIX: If nothing valid is being dragged, do nothing.
      if (this.draggedTaskId === null) {
        return;
      }

      this.currentSortMode = 'default';
      this.sortSelect.value = 'default';
      const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
      const draggedTaskIndex = this.data.tasks.findIndex((t) => t.id === this.draggedTaskId);

      // BUG FIX: If the dragged task somehow doesn't exist in our data, do nothing.
      if (draggedTaskIndex < 0) {
        this.draggedTaskId = null; // Reset dragged id
        return;
      }

      const [draggedTask] = this.data.tasks.splice(draggedTaskIndex, 1);
      if (afterElement == null) {
        this.data.tasks.push(draggedTask);
      } else {
        const afterElementId = Number(afterElement.dataset.id);
        const afterElementIndex = this.data.tasks.findIndex((t) => t.id === afterElementId);
        this.data.tasks.splice(afterElementIndex, 0, draggedTask);
      }
      this.saveData();
      this.renderTasks();
    });

    this.taskList.addEventListener('touchstart', (e) => this.handleTouchStart(e), {
      passive: false,
    });
    this.taskList.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.taskList.addEventListener('touchend', (e) => this.handleTouchEnd(e));

    this.filterContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.filter-btn');
      if (!target) return;
      this.currentFilter = target.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
      target.classList.add('active');
      this.renderTasks();
    });

    this.clearCompletedBtn.addEventListener('click', () => {
      this.showConfirmModal(
        'Dọn dẹp?',
        'Xóa tất cả công việc đã hoàn thành trong hạng mục này?',
        () => {
          this.data.tasks.forEach((t) => {
            if (t.categoryId === this.data.activeCategoryId && t.completed)
              this.cancelNotification(t.id);
          });
          this.data.tasks = this.data.tasks.filter(
            (t) => t.categoryId !== this.data.activeCategoryId || !t.completed,
          );
          this.saveData();
          this.renderAll();
        },
      );
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Global Escape: close help/any modal and examples menu
      if (e.key === 'Escape') {
        if (this.quickAddExamplesMenu) this.quickAddExamplesMenu.classList.add('hidden');
        // Let modal's own close handlers handle backdrop/btn; optionally hide
        if (this.modalContainer && !this.modalContainer.classList.contains('hidden')) {
          this.hideModal();
        }
        return;
      }
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === '/') {
        if (this.searchInput) {
          e.preventDefault();
          this.searchInput.focus();
        }
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.showTaskModal();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const order = ['all', 'pending', 'completed'];
        const idx = order.indexOf(this.currentFilter);
        this.currentFilter = order[(idx + 1) % order.length];
        document
          .querySelectorAll('.filter-btn')
          .forEach((btn) =>
            btn.classList.toggle('active', btn.dataset.filter === this.currentFilter),
          );
        this.renderTasks();
      } else if (e.key.toLowerCase() === 'g') {
        e.preventDefault();
        this.getAIAdvice();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.showSettingsModal();
      } else if (e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.showDailyBrief();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        this.showHelpModal();
      } else if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        const dark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('todoTheme', dark ? 'dark' : 'light');
      } else if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        // Ctrl + ArrowUp/Down: switch category prev/next
        e.preventDefault();
        const cats = this.data.categories || [];
        if (cats.length) {
          const curIdx = cats.findIndex((c) => c.id === this.data.activeCategoryId);
          if (curIdx !== -1) {
            const delta = e.key === 'ArrowUp' ? -1 : 1;
            const nextIdx = (curIdx + delta + cats.length) % cats.length;
            this.data.activeCategoryId = cats[nextIdx].id;
            this.saveData();
            this.renderAll();
            if (this.sidebar && this.sidebar.classList.contains('open')) this.toggleSidebar();
          }
        }
      } else if (e.ctrlKey && /^[1-9]$/.test(e.key)) {
        // Ctrl + 1..9: jump to Nth category
        e.preventDefault();
        const cats = this.data.categories || [];
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < cats.length) {
          this.data.activeCategoryId = cats[idx].id;
          this.saveData();
          this.renderAll();
          if (this.sidebar && this.sidebar.classList.contains('open')) this.toggleSidebar();
        }
      }
    });
  }

  markReloadNeeded(flag) {
    if (!this.reloadBtn) return;
    if (flag) this.reloadBtn.classList.add('reload-needed');
    else this.reloadBtn.classList.remove('reload-needed');
    const title = flag ? 'Có thay đổi cài đặt. Bấm để tải lại trang.' : 'Tải lại trang';
    this.reloadBtn.setAttribute('title', title);
  }

  showHelpModal() {
    const modalContent = `
      <div class="modal-backdrop fixed inset-0"></div>
      <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl m-4 z-10 p-0">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-900">Hướng dẫn</h3>
          <button id="modal-close-btn" class="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition leading-none text-lg" aria-label="Đóng"><i class="fas fa-times"></i></button>
        </div>
        <div class="px-4 pt-2">
          <div class="flex gap-2 flex-wrap border-b border-slate-200 pb-2">
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="quick">Thêm nhanh</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="tasks">Tác vụ</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="filters">Lọc/Sắp xếp/Tìm</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="ai">Cố vấn AI</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="notify">Thông báo</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="settings">Cài đặt</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="backup">Sao lưu</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="shortcuts">Phím tắt (PC)</button>
            <button class="help-tab-btn px-3 py-2 text-sm border border-slate-200 rounded-md" data-tab="tips">Mẹo</button>
          </div>
        </div>
        <div class="p-4 text-slate-700 text-sm">
          <div class="help-panel" data-panel="quick">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Thêm nhanh</strong>: hỗ trợ <code>#tag</code>, <code>!cao/!trung/!thấp</code> (hoặc <em>ưu tiên cao/trung/thấp</em>), giờ <code>15:00</code>, ngày <code>dd/mm</code> hoặc <code>dd/mm/yyyy</code>, <em>hôm nay/mai</em>, <em>nhắc 10p</em>, <em>sau 30p</em>, <em>lặp ngày/tuần/tháng</em>, <em>ước 30p</em> (ước tính), <em>c:"Tên hạng mục"</em> hoặc <em>c:Tên</em>, và <em>ghi chú: ...</em>.</li>
              <li>Sau khi nhập, nhấn <strong>Enter</strong> để thêm. Bạn có thể bấm nút <em>Xem ví dụ</em> ngay cạnh ô nhập để chèn mẫu câu.</li>
              <li><strong>Thẻ (tags)</strong> trong form thêm/sửa: Enter hoặc dấu phẩy để thêm, Backspace để xoá thẻ cuối khi trống; dán nhiều thẻ bằng dấu phẩy hoặc xuống dòng.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="tasks">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Hoàn thành</strong>: tích vào ô checkbox.</li>
              <li><strong>Ưu tiên</strong>: bấm vào vạch màu bên trái để xoay vòng Thấp/Trung/Cao; có <em>Gợi ý ưu tiên</em> nếu bật trong Cài đặt.</li>
              <li><strong>Kéo để sắp xếp</strong> <i class="fas fa-grip-vertical"></i>: giữ icon để kéo thả. Trên mobile chỉ kéo bằng icon.</li>
              <li><strong>Snooze</strong>, <strong>Tập trung 25'</strong>, <strong>Dời thông minh</strong>, <strong>Chia sẻ</strong> có trong hàng nút của mỗi task.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="filters">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Bộ lọc</strong>: Tất cả/Cần làm/Hoàn thành.</li>
              <li><strong>Sắp xếp</strong>: Mặc định, Theo ưu tiên, Theo hạn chót.</li>
              <li><strong>Tìm kiếm</strong>: Nhấn <code>/</code> để focus nhanh, tìm theo tên và thẻ.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="ai">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Chế độ</strong>: Sắp xếp ưu tiên, Gợi ý hạn chót, Kế hoạch hôm nay, Ước tính thời lượng.</li>
              <li><strong>Đầu ra</strong>: Ngắn gọn, có lý do; áp dụng từng mục hoặc tất cả.</li>
              <li class="text-amber-700"><strong>Lưu ý</strong>: Mỗi lần chỉ xử lý <strong>tối đa 10 công việc</strong>.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="notify">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Thông báo</strong>: Bật trong Cài đặt để nhận nhắc đúng hạn.</li>
              <li><strong>Giờ yên lặng</strong>: Tự động dời nhắc rơi vào ban đêm theo khung giờ bạn đặt.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="settings">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Giao diện</strong>: Sáng/Tối.</li>
              <li><strong>Gợi ý ưu tiên</strong>, <strong>Hiển thị ước tính</strong>, <strong>Nhắc trước kế hoạch hôm nay</strong>…</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="backup">
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Xuất/Nhập</strong>: Có thể <em>Xuất kèm cài đặt</em>. Hỗ trợ cả tệp 1 task (.json) để chia sẻ nhanh.</li>
              <li>Nhập xong hệ thống sẽ lên lịch lại thông báo để đồng bộ.</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="shortcuts">
            <ul class="list-disc pl-5 space-y-1">
              <li><code>/</code> → Tìm kiếm</li>
              <li><code>n</code> → Thêm công việc</li>
              <li><code>f</code> → Đổi bộ lọc</li>
              <li><code>g</code> → Cố vấn AI</li>
              <li><code>s</code> → Cài đặt</li>
              <li><code>b</code> → Bản tin hôm nay</li>
              <li><code>?</code> hoặc <code>Shift</code>+<code>/</code> → Hướng dẫn</li>
              <li><code>t</code> → Sáng/Tối</li>
              <li><code>Ctrl</code>+<code>↑/↓</code> → Chuyển hạng mục</li>
              <li><code>Ctrl</code>+<code>1..9</code> → Nhảy hạng mục</li>
            </ul>
          </div>

          <div class="help-panel hidden" data-panel="tips">
            <ul class="list-disc pl-5 space-y-1">
              <li>Nút <strong>Tải lại</strong> sẽ chấm đỏ khi có thay đổi cài đặt.</li>
              <li>Nút <strong>Cố vấn AI</strong> luôn ở góc dưới bên phải.</li>
              <li>Hoàn thành hết công việc đang làm sẽ có pháo giấy ăn mừng 🎉</li>
            </ul>
          </div>
        </div>
      </div>`;
    this.openModal(modalContent);
    // Tabs behavior
    const tabs = [...this.modalContainer.querySelectorAll('.help-tab-btn')];
    const panels = [...this.modalContainer.querySelectorAll('.help-panel')];
    const activate = (name) => {
      tabs.forEach((t) => {
        const active = t.dataset.tab === name;
        t.classList.toggle('active', active);
        // Active styles: indigo border + light bg + darker text
        if (active) {
          t.classList.add('bg-indigo-50', 'border-indigo-600', 'text-indigo-700', 'font-medium');
          t.classList.remove('bg-transparent', 'border-slate-200', 'text-slate-700');
        } else {
          t.classList.remove('bg-indigo-50', 'border-indigo-600', 'text-indigo-700', 'font-medium');
          t.classList.add('bg-transparent', 'border-slate-200', 'text-slate-700');
        }
      });
      panels.forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== name));
    };
    tabs.forEach((btn) => btn.addEventListener('click', () => activate(btn.dataset.tab)));
    activate('quick');
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    return draggableElements.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
      },
      { offset: Number.NEGATIVE_INFINITY },
    ).element;
  }

  addQuickTaskFromRaw(raw) {
    const parsed = this.parseQuickAdd(raw);
    const newTask = {
      id: Date.now(),
      text: parsed.text,
      completed: false,
      categoryId: this.data.activeCategoryId,
      dueDate: parsed.dueDate || null,
      priority: parsed.priority || 'medium',
      tags: parsed.tags || [],
      notes: parsed.notes || '',
      reminderMinutes: parsed.reminderMinutes || 0,
      recurrence: parsed.recurrence || 'none',
      streak: 0,
      estimatedMinutes: parsed.estimatedMinutes || 0,
    };
    if (!newTask.text) return false;
    // If categoryName provided, resolve or create and set categoryId
    if (parsed.categoryName && parsed.categoryName.trim()) {
      const name = parsed.categoryName.trim();
      let cat = this.data.categories.find(
        (c) => (c.name || '').toLowerCase() === name.toLowerCase(),
      );
      if (!cat) {
        cat = { id: Date.now() + 1, name };
        this.data.categories.push(cat);
        // Re-render categories list later
      }
      newTask.categoryId = cat.id;
    }
    // Nếu nhập nhắc X phút mà chưa có hạn chót => tạo hạn = now+X và đặt nhắc = 0
    if (!newTask.dueDate && newTask.reminderMinutes > 0) {
      const now = new Date(Date.now() + newTask.reminderMinutes * 60000);
      newTask.dueDate = this.formatDateTime(now);
      newTask.reminderMinutes = 0;
    }
    // Duplicate detection
    const dup = this.findSimilarTask(newTask.text, newTask.categoryId, null);
    if (dup) {
      this.showMergeModal(
        dup,
        newTask,
        () => {
          // Merge into existing
          this.mergeTaskData(dup, newTask);
          this.saveData();
          this.renderAll();
          this.scheduleNotification(dup);
        },
        () => {
          // Keep both
          this.data.tasks.push(newTask);
          this.saveData();
          this.renderAll();
          this.scheduleNotification(newTask);
        },
      );
      return true;
    }
    this.data.tasks.push(newTask);
    this.saveData();
    this.renderAll();
    this.scheduleNotification(newTask);
    return true;
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
  openModal(html) {
    this.modalContainer.innerHTML = html;
    this.modalContainer.classList.replace('hidden', 'flex');
    const backdrop = this.modalContainer.querySelector('.modal-backdrop');
    if (backdrop) backdrop.onclick = () => this.hideModal();
    const closeBtn = this.modalContainer.querySelector('#modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.hideModal();
  }

  // Duplicate detection helpers
  normalizeTitle(s) {
    return (s || '')
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  findSimilarTask(text, categoryId, excludeId = null) {
    const norm = this.normalizeTitle(text);
    if (!norm) return null;
    const candidates = this.data.tasks.filter(
      (t) => t.categoryId === categoryId && !t.completed && t.id !== excludeId,
    );
    for (const t of candidates) {
      const nt = this.normalizeTitle(t.text);
      if (!nt) continue;
      if (nt === norm) return t;
      const shorter = nt.length < norm.length ? nt : norm;
      const longer = nt.length >= norm.length ? nt : norm;
      if (shorter.length >= 8 && longer.includes(shorter)) return t;
    }
    return null;
  }

  mergeTaskData(target, incoming) {
    // Merge fields preferring earlier due date, higher priority, union tags, combined notes, minimal reminder, strongest recurrence
    const prioRank = { low: 0, medium: 1, high: 2 };
    const earlier = (a, b) => {
      if (!a) return b;
      if (!b) return a;
      const da = this.parseDateTime(a);
      const db = this.parseDateTime(b);
      if (!da) return b;
      if (!db) return a;
      return da <= db ? a : b;
    };
    target.text =
      (target.text || '').length >= (incoming.text || '').length ? target.text : incoming.text;
    target.dueDate = earlier(target.dueDate, incoming.dueDate);
    const p1 = prioRank[target.priority] ?? 1;
    const p2 = prioRank[incoming.priority] ?? 1;
    target.priority = p1 >= p2 ? target.priority : incoming.priority;
    const set = new Set(
      [...(target.tags || []), ...(incoming.tags || [])]
        .map((x) => (x || '').trim())
        .filter(Boolean),
    );
    target.tags = [...set];
    const notesA = target.notes || '';
    const notesB = incoming.notes || '';
    target.notes = notesA && notesB ? `${notesA}\n\n${notesB}` : notesA || notesB;
    if (typeof incoming.reminderMinutes === 'number') {
      if (typeof target.reminderMinutes !== 'number')
        target.reminderMinutes = incoming.reminderMinutes;
      else target.reminderMinutes = Math.min(target.reminderMinutes, incoming.reminderMinutes);
    }
    const recStrength = { none: 0, daily: 3, weekly: 2, monthly: 1 };
    const r1 = recStrength[target.recurrence] ?? 0;
    const r2 = recStrength[incoming.recurrence] ?? 0;
    target.recurrence = r1 >= r2 ? target.recurrence : incoming.recurrence;
    return target;
  }

  showMergeModal(existing, incoming, onMerge, onKeepBoth) {
    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10 p-6">
              <h3 class="text-lg font-bold mb-3">Phát hiện trùng</h3>
              <p class="text-sm text-slate-600">Đã có công việc tương tự:</p>
              <div class="mt-2 p-3 bg-slate-50 rounded text-sm">
                <div class="font-medium">Hiện có: ${existing.text}</div>
                ${
                  existing.dueDate
                    ? `<div class='text-slate-500 mt-1'><i class='fas fa-bell mr-1'></i>${existing.dueDate}</div>`
                    : ''
                }
              </div>
              <p class="text-sm text-slate-600 mt-3">Công việc mới:</p>
              <div class="mt-2 p-3 bg-slate-50 rounded text-sm">
                <div class="font-medium">${incoming.text}</div>
                ${
                  incoming.dueDate
                    ? `<div class='text-slate-500 mt-1'><i class='fas fa-bell mr-1'></i>${incoming.dueDate}</div>`
                    : ''
                }
              </div>
              <div class="mt-5 flex justify-end gap-2">
                <button id="modal-cancel-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200">Hủy</button>
                <button id="merge-keep-btn" class="px-4 py-2 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Giữ cả hai</button>
                <button id="merge-merge-btn" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Gộp</button>
              </div>
            </div>`;
    this.openModal(modalContent);
    const keepBtn = this.modalContainer.querySelector('#merge-keep-btn');
    const mergeBtn = this.modalContainer.querySelector('#merge-merge-btn');
    const cancelBtn = this.modalContainer.querySelector('#modal-cancel-btn');
    if (keepBtn)
      keepBtn.onclick = () => {
        this.hideModal();
        onKeepBoth && onKeepBoth();
      };
    if (mergeBtn)
      mergeBtn.onclick = () => {
        this.hideModal();
        onMerge && onMerge();
      };
    if (cancelBtn) cancelBtn.onclick = () => this.hideModal();
  }

  showSettingsModal() {
    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10">
        <div class="p-6 border-b flex justify-between items-center">
                    <h3 class="text-lg font-medium">Cài đặt</h3>
          <button id="modal-close-btn" class="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition leading-none text-lg" aria-label="Đóng"><i class="fas fa-times"></i></button>
                </div>
                <div class="p-6">
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>Giao diện</h4>
                            <p>Chế độ sáng hoặc tối.</p>
                        </div>
                        <div class="setting-item-action">
                            <button id="theme-toggle-btn" style="width:48px;height:48px;padding:0;display:flex;align-items:center;justify-content:center;font-size:1rem;"></button>
                        </div>
                    </div>
                    <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>Thông báo công việc</h4>
                            <p>Nhận nhắc nhở khi công việc đến hạn.</p>
                        </div>
                        <div class="setting-item-action" style="display:flex;gap:8px;">
                            <button id="push-subscribe-btn" class="btn-default">Bật</button>
                            <button id="push-test-btn" class="btn-default">Thử</button>
                        </div>
                    </div>
                    <div class="setting-item">
                      <div class="setting-item-info">
                        <h4>Giờ yên lặng</h4>
                        <p>Tự động dời thông báo rơi vào ban đêm.</p>
                      </div>
                      <div class="setting-item-action quiet-hours-controls">
                        <label class="settings-toggle">
                          <input type="checkbox" id="qh-enabled" class="toggle-checkbox">
                          <span class="toggle-label">Bật</span>
                        </label>
                        <label class="settings-input-group">
                          <span class="label-text">Từ</span>
                          <input type="time" id="qh-start" class="form-input time-input" style="width:110px;"/>
                        </label>
                        <label class="settings-input-group">
                          <span class="label-text">Đến</span>
                          <input type="time" id="qh-end" class="form-input time-input" style="width:110px;"/>
                        </label>
                      </div>
                    </div>
                    <div class="setting-item">
                      <div class="setting-item-info">
                        <h4>Gợi ý ưu tiên</h4>
                        <p>Đề xuất mức ưu tiên dựa trên hạn và nội dung.</p>
                      </div>
                      <div class="setting-item-action">
                        <label class="settings-toggle">
                          <input type="checkbox" id="priority-suggest-enabled" class="toggle-checkbox">
                          <span class="toggle-label">Bật</span>
                        </label>
                      </div>
                    </div>
                    <div class="setting-item">
                      <div class="setting-item-info">
                        <h4>Hiển thị ước tính thời lượng</h4>
                        <p>Bật/tắt nhãn "Ước tính: X phút" dưới mỗi công việc.</p>
                      </div>
                      <div class="setting-item-action">
                        <label class="settings-toggle">
                          <input type="checkbox" id="estimated-badge-enabled" class="toggle-checkbox">
                          <span class="toggle-label">Bật</span>
                        </label>
                      </div>
                    </div>
                    <div class="setting-item">
                      <div class="setting-item-info">
                        <h4>Cố vấn AI</h4>
                        <p>Nhắc trước mặc định khi áp dụng "Kế hoạch hôm nay".</p>
                      </div>
                      <div class="setting-item-action" style="display:flex;gap:8px;align-items:center;">
                        <label class="settings-input-group">
                          <span class="label-text">Nhắc trước</span>
                          <div class="select-wrapper">
                            <select id="today-plan-reminder-select" class="form-select" style="width:120px;">
                              <option value="0">Đúng giờ</option>
                              <option value="5">5 phút</option>
                              <option value="10">10 phút</option>
                              <option value="30">30 phút</option>
                              <option value="60">60 phút</option>
                            </select>
                          </div>
                        </label>
                      </div>
                    </div>
                    <div class="setting-item">
                      <div class="setting-item-info">
                        <h4>Bản tin mỗi ngày</h4>
                        <p>Hiển thị tóm tắt công việc khi mở ứng dụng.</p>
                      </div>
                      <div class="setting-item-action">
                        <label class="settings-toggle">
                          <input type="checkbox" id="brief-enabled" class="toggle-checkbox">
                          <span class="toggle-label">Bật</span>
                        </label>
                      </div>
                    </div>
          <div class="setting-item">
                        <div class="setting-item-info">
                            <h4>Sao lưu & khôi phục</h4>
                            <p>Xuất/nhập dữ liệu công việc.</p>
                        </div>
            <div class="setting-item-action" style="display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
              <div style="display:flex;gap:8px;align-items:center;">
                <button id="export-data-btn" class="btn-default">Xuất</button>
                <button id="import-data-btn" class="btn-default">Nhập</button>
                <input id="import-file-input" type="file" accept="application/json" style="display:none;" />
              </div>
              <label for="export-include-settings" style="display:inline-flex;align-items:center;gap:8px;font-size:12px;color:#64748b;">
                <input type="checkbox" id="export-include-settings" style="width:14px;height:14px;">
                <span>Xuất kèm cài đặt</span>
              </label>
            </div>
                    </div>
                </div>
            </div>
    `;
    this.openModal(modalContent);

    // Setup theme toggle button state
    const themeBtn = document.getElementById('theme-toggle-btn');
    const darkOn = document.body.classList.contains('dark-mode');
    themeBtn.innerHTML = darkOn ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    themeBtn.className = darkOn ? 'btn-granted' : 'btn-default';

    // Close handlers are wired by openModal; only custom actions below
    themeBtn.onclick = () => {
      const dark = document.body.classList.toggle('dark-mode');
      localStorage.setItem('todoTheme', dark ? 'dark' : 'light');
      themeBtn.innerHTML = dark ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
      themeBtn.className = dark ? 'btn-granted' : 'btn-default';
    };

    // Quiet Hours & Daily Brief
    const qhEnabled = document.getElementById('qh-enabled');
    const qhStart = document.getElementById('qh-start');
    const qhEnd = document.getElementById('qh-end');
    const briefEnabled = document.getElementById('brief-enabled');
    const prioritySuggestEnabled = document.getElementById('priority-suggest-enabled');
    const estBadgeEnabled = document.getElementById('estimated-badge-enabled');
    const todayPlanRemSel = document.getElementById('today-plan-reminder-select');
    if (qhEnabled && qhStart && qhEnd) {
      qhEnabled.checked = !!this.settings.quietHours?.enabled;
      qhStart.value = this.settings.quietHours?.start || '22:00';
      qhEnd.value = this.settings.quietHours?.end || '07:00';
      qhEnabled.onchange = () =>
        this.updateSettings({ quietHours: { enabled: qhEnabled.checked } });
      qhStart.onchange = () => this.updateSettings({ quietHours: { start: qhStart.value } });
      qhEnd.onchange = () => this.updateSettings({ quietHours: { end: qhEnd.value } });
    }
    if (briefEnabled) {
      briefEnabled.checked = !!this.settings.dailyBrief;
      briefEnabled.onchange = () => this.updateSettings({ dailyBrief: briefEnabled.checked });
    }
    if (prioritySuggestEnabled) {
      prioritySuggestEnabled.checked = !!this.settings.prioritySuggestions;
      prioritySuggestEnabled.onchange = () => {
        this.updateSettings({ prioritySuggestions: prioritySuggestEnabled.checked });
        // Reflect immediately in task list
        this.renderTasks();
      };
    }
    if (estBadgeEnabled) {
      estBadgeEnabled.checked = !!this.settings.showEstimatedBadge;
      estBadgeEnabled.onchange = () => {
        this.updateSettings({ showEstimatedBadge: estBadgeEnabled.checked });
        // Reflect immediately in task list
        this.renderTasks();
      };
    }
    if (todayPlanRemSel) {
      todayPlanRemSel.value = String(this.settings.todayPlanDefaultReminder ?? 0);
      todayPlanRemSel.onchange = () =>
        this.updateSettings({ todayPlanDefaultReminder: Number(todayPlanRemSel.value) || 0 });
    }
    // Removed user-facing AI task cap control (fixed by system)

    // Export / Import handlers
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-file-input');
    const exportIncludeSettingsCk = document.getElementById('export-include-settings');

    // Restore persisted choice for including settings in export
    try {
      const pref = localStorage.getItem('todo_export_include_settings');
      if (exportIncludeSettingsCk) {
        exportIncludeSettingsCk.checked = pref === null ? true : pref === '1';
        exportIncludeSettingsCk.onchange = () => {
          try {
            localStorage.setItem(
              'todo_export_include_settings',
              exportIncludeSettingsCk.checked ? '1' : '0',
            );
          } catch (_) {}
        };
      }
    } catch (_) {}

    exportBtn.onclick = () => {
      // Export data with optional settings
      const includeSettings = !!exportIncludeSettingsCk?.checked;
      const payload = includeSettings
        ? {
            version: '2.0.0',
            exportedAt: this.formatVNISO(new Date()),
            data: this.data,
            settings: this.settings,
          }
        : {
            version: '2.0.0',
            exportedAt: this.formatVNISO(new Date()),
            data: this.data,
          };
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date();
      const ts = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
        .getDate()
        .toString()
        .padStart(2, '0')}`;
      a.download = `todo-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    };

    importBtn.onclick = () => importInput.click();
    importInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const obj = JSON.parse(text);

        // Support single-task payload
        if (obj && obj.type === 'task' && obj.task) {
          const incoming = obj.task;
          // Resolve category by name if provided, else use current active
          let targetCategoryId = this.data.activeCategoryId;
          const catName = obj.categoryName && String(obj.categoryName).trim();
          if (catName) {
            let cat = this.data.categories.find((c) => c.name === catName);
            if (!cat) {
              cat = { id: Date.now(), name: catName };
              this.data.categories.push(cat);
            }
            targetCategoryId = cat.id;
          }

          const newTask = {
            id: Date.now(),
            text: incoming.text || '',
            completed: !!incoming.completed,
            categoryId: targetCategoryId,
            dueDate: incoming.dueDate || null,
            priority: incoming.priority || 'medium',
            tags: Array.isArray(incoming.tags) ? incoming.tags : [],
            notes: typeof incoming.notes === 'string' ? incoming.notes : '',
            reminderMinutes:
              typeof incoming.reminderMinutes === 'number' ? incoming.reminderMinutes : 0,
            recurrence: incoming.recurrence || 'none',
            streak: typeof incoming.streak === 'number' ? incoming.streak : 0,
            estimatedMinutes:
              typeof incoming.estimatedMinutes === 'number' ? incoming.estimatedMinutes : 0,
          };
          // Optional duplicate detection/merge
          const dup = this.findSimilarTask(newTask.text, newTask.categoryId, null);
          if (dup) this.mergeTaskData(dup, newTask);
          else this.data.tasks.push(newTask);
          this.saveData();
          this.renderAll();
          await this.scheduleAllPushNotifications();
          this.hideModal();
          return;
        }

        // Support both legacy schema (categories/tasks at root) and v2 payload {version,data,settings}
        let importedData = null;
        let importedSettings = null;
        if (
          obj &&
          obj.data &&
          Array.isArray(obj.data.categories) &&
          Array.isArray(obj.data.tasks)
        ) {
          importedData = obj.data;
          if (obj.settings) importedSettings = obj.settings;
        } else if (obj && Array.isArray(obj.categories) && Array.isArray(obj.tasks)) {
          importedData = obj;
        } else {
          throw new Error('Invalid schema');
        }

        this.data = {
          categories: importedData.categories,
          tasks: importedData.tasks,
          activeCategoryId: importedData.activeCategoryId || importedData.categories[0]?.id || 1,
        };
        // Normalize and persist
        this.data.tasks = (this.data.tasks || []).map((t) => ({
          id: t.id || Date.now(),
          text: t.text || '',
          completed: !!t.completed,
          categoryId: t.categoryId || this.data.activeCategoryId,
          dueDate: t.dueDate || null,
          priority: t.priority || 'medium',
          tags: Array.isArray(t.tags) ? t.tags : [],
          notes: typeof t.notes === 'string' ? t.notes : '',
          reminderMinutes: typeof t.reminderMinutes === 'number' ? t.reminderMinutes : 0,
          recurrence: t.recurrence || 'none',
          streak: typeof t.streak === 'number' ? t.streak : 0,
          estimatedMinutes: typeof t.estimatedMinutes === 'number' ? t.estimatedMinutes : 0,
        }));
        // Import settings if present, with safe merge into defaults
        if (importedSettings) {
          // Use the same full defaults as constructor to avoid losing newer flags on import
          const defaultSettings = {
            quietHours: { enabled: true, start: '22:00', end: '07:00' },
            dailyBrief: true,
            prioritySuggestions: true,
            showEstimatedBadge: true,
            todayPlanDefaultReminder: 10,
          };
          this.settings = {
            ...defaultSettings,
            ...importedSettings,
            quietHours: {
              ...defaultSettings.quietHours,
              ...(importedSettings.quietHours || {}),
            },
          };
          try {
            localStorage.setItem('todoSettings_v1', JSON.stringify(this.settings));
          } catch (_) {}
        }
        this.saveData();
        this.renderAll();
        // Reschedule push notifications
        await this.scheduleAllPushNotifications();
        this.hideModal();
      } catch (err) {
        console.error('Import error:', err);
        this.showConfirmModal(
          'Lỗi nhập dữ liệu',
          'Tệp JSON không hợp lệ. Vui lòng thử lại.',
          () => {},
        );
      } finally {
        importInput.value = '';
      }
    };

    // Push buttons
    const pushSubBtn = document.getElementById('push-subscribe-btn');
    const pushTestBtn = document.getElementById('push-test-btn');
    // Reflect current subscription state in UI
    const alreadySub = !!this.getPushSubscriptionJSON();
    if (alreadySub) {
      pushSubBtn.textContent = 'Đã bật';
      pushSubBtn.className = 'btn-granted';
      pushSubBtn.disabled = true;
    }
    pushSubBtn.onclick = async () => {
      try {
        const ok = await this.subscribePush();
        if (ok) {
          pushSubBtn.textContent = 'Đã bật';
          pushSubBtn.className = 'btn-granted';
          pushSubBtn.disabled = true;
          // Sync current tasks to server scheduler immediately
          await this.scheduleAllPushNotifications();
          this.showConfirmModal('Thành công', 'Đăng ký push thành công.', () => {});
        }
      } catch (err) {
        console.error(err);
        this.showConfirmModal(
          'Lỗi',
          'Không thể đăng ký push. Hãy kiểm tra HTTPS, Service Worker và cấu hình VAPID.',
          () => {},
        );
      }
    };
    pushTestBtn.onclick = async () => {
      try {
        const ok = await this.testPush();
        if (ok)
          this.showConfirmModal('Đã gửi', 'Yêu cầu gửi thử đã được gửi tới server.', () => {});
      } catch (err) {
        console.error(err);
        this.showConfirmModal(
          'Lỗi',
          'Không thể gửi thử. Hãy chắc chắn server push đang chạy.',
          () => {},
        );
      }
    };
  }

  // --- Push helpers ---
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window))
      throw new Error('No SW/Push support');
    if (!window.isSecureContext) throw new Error('Not secure context');
    const registration = await navigator.serviceWorker.ready;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    const serverUrl = import.meta.env.VITE_PUSH_SERVER_URL;
    if (!vapidKey || !serverUrl) throw new Error('Missing VAPID key or server URL');
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(vapidKey),
    });
    // Persist consistently as JSON object
    this.pushSubscription = sub;
    try {
      localStorage.setItem('pushSubscription', JSON.stringify(sub.toJSON()));
    } catch (_) {}
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    if (!res.ok) throw new Error('Subscribe server error');
    return true;
  }

  getPushSubscriptionJSON() {
    try {
      if (this.pushSubscription && typeof this.pushSubscription.toJSON === 'function') {
        return this.pushSubscription.toJSON();
      }
    } catch (_) {}
    try {
      const str = localStorage.getItem('pushSubscription');
      return str ? JSON.parse(str) : null;
    } catch (_) {
      return null;
    }
  }

  async testPush() {
    const serverUrl = import.meta.env.VITE_PUSH_SERVER_URL;
    const subJson = this.getPushSubscriptionJSON();
    if (!serverUrl || !subJson) throw new Error('Missing server URL or subscription');
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subJson }),
    });
    if (!res.ok) throw new Error('Test server error');
    return true;
  }

  showTaskModal(task = null) {
    const isEditing = task !== null;
    const title = isEditing ? 'Chỉnh sửa công việc' : 'Thêm công việc mới';
    const taskText = isEditing ? task.text : '';
    const dueDate = isEditing ? task.dueDate : '';
    const priority = isEditing ? task.priority : 'medium';
    const tags = isEditing ? (task.tags || []).join(', ') : '';
    const notes = isEditing ? task.notes || '' : '';
    const reminderMinutes = isEditing ? task.reminderMinutes || 0 : 0;
    const recurrence = isEditing ? task.recurrence || 'none' : 'none';
    const estimatedMinutes = isEditing ? task.estimatedMinutes || 0 : 0;

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
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label for="reminder-select" class="block text-sm font-medium text-gray-700 mb-1">Nhắc trước</label>
                                <div class="select-wrapper">
                                    <select id="reminder-select" class="form-select">
                                        <option value="0" ${
                                          reminderMinutes === 0 ? 'selected' : ''
                                        }>Đúng giờ</option>
                                        <option value="5" ${
                                          reminderMinutes === 5 ? 'selected' : ''
                                        }>5 phút</option>
                                        <option value="10" ${
                                          reminderMinutes === 10 ? 'selected' : ''
                                        }>10 phút</option>
                                        <option value="30" ${
                                          reminderMinutes === 30 ? 'selected' : ''
                                        }>30 phút</option>
                                        <option value="60" ${
                                          reminderMinutes === 60 ? 'selected' : ''
                                        }>60 phút</option>
                                    </select>
                                </div>
                                <p class="mt-1 text-xs text-slate-500">Đúng giờ = nhắc đúng thời điểm đến hạn.</p>
                            </div>
                            <div>
                                <label for="priority-select" class="block text-sm font-medium text-gray-700 mb-1">Độ ưu tiên</label>
                                <div class="select-wrapper">
                                    <select id="priority-select" class="form-select">
                                        <option value="high" ${
                                          priority === 'high' ? 'selected' : ''
                                        }>Cao</option>
                                        <option value="medium" ${
                                          priority === 'medium' ? 'selected' : ''
                                        }>Trung bình</option>
                                        <option value="low" ${
                                          priority === 'low' ? 'selected' : ''
                                        }>Thấp</option>
                                    </select>
                                </div>
                            </div>
              <div>
                <label for="estimated-minutes-input" class="block text-sm font-medium text-gray-700 mb-1">Ước tính (phút)</label>
                <input type="number" id="estimated-minutes-input" value="${estimatedMinutes}" min="0" step="5" class="form-input" placeholder="ví dụ: 30">
                <p class="mt-1 text-xs text-slate-500">Tùy chọn. Dùng để ước lượng thời gian hoàn thành.</p>
              </div>
                            <div>
                                <label for="recurrence-select" class="block text-sm font-medium text-gray-700 mb-1">Lặp lại</label>
                                <div class="select-wrapper">
                                    <select id="recurrence-select" class="form-select">
                                        <option value="none" ${
                                          recurrence === 'none' ? 'selected' : ''
                                        }>Không</option>
                                        <option value="daily" ${
                                          recurrence === 'daily' ? 'selected' : ''
                                        }>Hàng ngày</option>
                                        <option value="weekly" ${
                                          recurrence === 'weekly' ? 'selected' : ''
                                        }>Hàng tuần</option>
                                        <option value="monthly" ${
                                          recurrence === 'monthly' ? 'selected' : ''
                                        }>Hàng tháng</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-span-2">
                                <label for="tags-input" class="block text-sm font-medium text-gray-700 mb-1">Thẻ</label>
                                <div id="tags-chip-wrap" class="form-input tag-chips-input">
                                  <div id="tags-chip-list" class="flex flex-wrap gap-2"></div>
                                  <input type="text" id="tags-input" class="tag-input" placeholder="gõ tag và Enter">
                                </div>
                                <p class="mt-1 text-xs text-slate-500">Nhấn Enter hoặc dấu , để thêm thẻ. Bấm × để xoá.</p>
                            </div>
                        </div>
                        <div>
                            <label for="notes-input" class="block text-sm font-medium text-gray-700 mb-1">Ghi chú (Markdown)</label>
                            <textarea id="notes-input" rows="4" class="form-input" style="height:auto;min-height:96px;resize:vertical;">${notes.replace(
                              /</g,
                              '&lt;',
                            )}</textarea>
                        </div>
                    </div>
                    <div class="mt-8 flex justify-end space-x-3">
                        <button type="button" id="modal-cancel-btn" class="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Hủy</button>
                        <button type="submit" class="inline-flex justify-center py-2 px-4 border shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">Lưu</button>
                    </div>
                </form>
            </div>
    `;
    this.openModal(modalContent);

    const dueDateInput = document.getElementById('due-date-input');
    this.flatpickrInstance = flatpickr(dueDateInput, {
      enableTime: true,
      dateFormat: 'd/m/Y H:i',
      time_24hr: true,
      defaultDate: dueDate,
    });

    // Close handlers already attached via openModal
    // Ensure the Cancel button in this modal actually closes
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => this.hideModal();

    // Tags chip editor state & handlers
    const tagsChipList = this.modalContainer.querySelector('#tags-chip-list');
    const tagsInput = this.modalContainer.querySelector('#tags-input');
    let localTags = [];
    if (isEditing) localTags = Array.isArray(task.tags) ? [...task.tags] : [];
    const addTags = (arr) => {
      arr
        .flatMap((s) => String(s || '').split(/[\n,]/))
        .map((s) => (s || '').trim())
        .filter(Boolean)
        .forEach((t) => {
          const exists = localTags.some((x) => (x || '').toLowerCase() === t.toLowerCase());
          if (!exists) localTags.push(t);
        });
      renderChips();
    };
    const removeTagByIndex = (idx) => {
      if (idx >= 0 && idx < localTags.length) {
        localTags.splice(idx, 1);
        renderChips();
      }
    };
    const renderChips = () => {
      if (!tagsChipList) return;
      tagsChipList.innerHTML = localTags
        .map(
          (t, i) => `
            <span class="tag-badge tag-chip flex items-center" data-index="${i}" style="gap:6px;">
              <span>#${(t || '').trim()}</span>
              <button type="button" class="tag-remove" aria-label="Xoá thẻ" title="Xoá">×</button>
            </span>`,
        )
        .join('');
      tagsChipList.querySelectorAll('.tag-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.closest('[data-index]')?.getAttribute('data-index'));
          removeTagByIndex(idx);
          if (tagsInput) tagsInput.focus();
        });
      });
    };
    renderChips();
    if (tagsInput) {
      tagsInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ',') {
          ev.preventDefault();
          const val = tagsInput.value;
          if (val && val.trim()) addTags([val]);
          tagsInput.value = '';
        } else if (ev.key === 'Backspace' && !tagsInput.value) {
          // remove last tag when input is empty
          removeTagByIndex(localTags.length - 1);
        }
      });
      tagsInput.addEventListener('paste', (ev) => {
        try {
          const text = ev.clipboardData?.getData('text') || '';
          if (text) {
            ev.preventDefault();
            addTags([text]);
            if (tagsInput) tagsInput.value = '';
          }
        } catch (_) {}
      });
    }

    document.getElementById('task-form').onsubmit = (e) => {
      e.preventDefault();
      const newTaskData = {
        text: document.getElementById('task-text-input').value.trim(),
        dueDate: dueDateInput.value || null,
        priority: document.getElementById('priority-select').value,
        reminderMinutes: Number(document.getElementById('reminder-select').value) || 0,
        recurrence: document.getElementById('recurrence-select').value,
        tags: localTags.slice(),
        notes: document.getElementById('notes-input').value || '',
        estimatedMinutes: Math.max(
          0,
          Math.round(Number(document.getElementById('estimated-minutes-input').value) || 0),
        ),
      };

      if (newTaskData.text === '') return;

      // Logic: nếu không có hạn chót mà người dùng chọn 'Nhắc trước X phút'
      // thì hiểu là muốn nhắc sau X phút kể từ bây giờ => đặt hạn chót = now + X phút và Nhắc trước = 0
      if (!newTaskData.dueDate && newTaskData.reminderMinutes > 0) {
        const now = new Date(Date.now() + newTaskData.reminderMinutes * 60000);
        newTaskData.dueDate = this.formatDateTime(now);
        newTaskData.reminderMinutes = 0;
      }

      if (isEditing) {
        Object.assign(task, newTaskData);
        this.scheduleNotification(task);
      } else {
        const newTask = {
          id: Date.now(),
          completed: false,
          categoryId: this.data.activeCategoryId,
          ...newTaskData,
          streak: 0,
        };
        // Duplicate detection on full add modal
        const dup = this.findSimilarTask(newTask.text, newTask.categoryId, null);
        if (dup) {
          this.showMergeModal(
            dup,
            newTask,
            () => {
              this.mergeTaskData(dup, newTask);
              this.saveData();
              this.renderAll();
              this.scheduleNotification(dup);
              this.hideModal();
            },
            () => {
              this.data.tasks.push(newTask);
              this.saveData();
              this.renderAll();
              this.scheduleNotification(newTask);
              this.hideModal();
            },
          );
          return;
        }
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
    this.openModal(modalContent);
    const cancelBtn = document.getElementById('modal-cancel-btn');
    if (cancelBtn) cancelBtn.onclick = () => this.hideModal();
    document.getElementById('modal-confirm-btn').onclick = () => {
      onConfirm();
      this.hideModal();
    };
  }

  showSnoozeModal(task) {
    const options = [
      { label: '30 phút', minutes: 30 },
      { label: '1 giờ', minutes: 60 },
      { label: '1 ngày', minutes: 60 * 24 },
      { label: '1 tuần', minutes: 60 * 24 * 7 },
    ];
    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6">
              <h3 class="text-lg font-bold mb-4">Hoãn nhắc công việc</h3>
              <div class="grid grid-cols-2 gap-3">
                ${options
                  .map(
                    (o) =>
                      `<button data-minutes="${o.minutes}" class="snooze-btn px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">${o.label}</button>`,
                  )
                  .join('')}
              </div>
              <div class="flex items-center mt-4">
                <input id="snooze-exact-checkbox" type="checkbox" class="mr-2" checked>
                <label for="snooze-exact-checkbox" class="text-sm text-slate-600">Nhắc đúng giờ mới (bỏ thiết lập "Nhắc trước")</label>
              </div>
              <div class="text-right mt-4">
                <button id="modal-close-btn" class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">Đóng</button>
              </div>
            </div>`;
    this.openModal(modalContent);
    this.modalContainer.querySelectorAll('[data-minutes]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mins = Number(btn.getAttribute('data-minutes')) || 0;
        const base = this.parseDateTime(task.dueDate) || new Date();
        const newDate = new Date(base.getTime() + mins * 60000);
        // Update the task by id to avoid any stale references
        const idx = this.data.tasks.findIndex((t) => t.id === task.id);
        const exact = !!this.modalContainer.querySelector('#snooze-exact-checkbox')?.checked;
        if (idx !== -1) {
          this.data.tasks[idx].dueDate = this.formatDateTime(newDate);
          // Nếu chọn nhắc đúng giờ -> đặt Nhắc trước = 0, ngược lại giữ nguyên
          if (exact) this.data.tasks[idx].reminderMinutes = 0;
        } else {
          // Fallback: mutate passed object
          task.dueDate = this.formatDateTime(newDate);
          if (exact) task.reminderMinutes = 0;
        }
        this.saveData();
        this.renderAll();
        this.scheduleNotification(task);
        this.hideModal();
      });
    });
  }

  showSmartDeferModal(task) {
    const now = new Date();
    const makeDate = (y, m, d, HH, II) => {
      const dt = new Date(y, m, d, HH, II, 0, 0);
      return dt;
    };
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const options = [];
    // This afternoon 16:00 (if already past, pick tomorrow 16:00)
    {
      let dt = makeDate(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0);
      if (dt <= now) dt = new Date(dt.getTime() + 24 * 3600000);
      options.push({ label: `Chiều ${dt.getDate()}/${dt.getMonth() + 1} 16:00`, date: dt });
    }
    // Tomorrow morning 09:00
    {
      const tm = new Date(today.getTime() + 24 * 3600000);
      const dt = makeDate(tm.getFullYear(), tm.getMonth(), tm.getDate(), 9, 0);
      options.push({ label: `Sáng mai 09:00`, date: dt });
    }
    // Weekend 10:00 (upcoming Saturday)
    {
      const day = today.getDay(); // 0=Sun..6=Sat
      const toSat = (6 - day + 7) % 7 || 7; // next Saturday (at least +1 day)
      const sat = new Date(today.getTime() + toSat * 24 * 3600000);
      const dt = makeDate(sat.getFullYear(), sat.getMonth(), sat.getDate(), 10, 0);
      options.push({ label: `Cuối tuần 10:00`, date: dt });
    }
    // Next Monday 09:00
    {
      const day = today.getDay();
      const toMon = (1 - day + 7) % 7 || 7; // next Monday (>= +1 day)
      const mon = new Date(today.getTime() + toMon * 24 * 3600000);
      const dt = makeDate(mon.getFullYear(), mon.getMonth(), mon.getDate(), 9, 0);
      options.push({ label: `Thứ Hai tới 09:00`, date: dt });
    }

    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 smart-defer-modal">
              <h3 class="text-lg font-bold mb-4">Đề xuất dời thông minh</h3>
              <div class="grid grid-cols-1 gap-3">
                ${options
                  .map(
                    (o, idx) =>
                      `<button data-idx="${idx}" class="smart-defer-btn px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition">${o.label}</button>`,
                  )
                  .join('')}
              </div>
              <div class="flex items-center mt-4">
                <input id="smartdefer-exact-checkbox" type="checkbox" class="mr-2 dark:bg-slate-700 dark:border-slate-600" checked>
                <label for="smartdefer-exact-checkbox" class="text-sm text-slate-600">Nhắc đúng giờ mới (bỏ thiết lập "Nhắc trước")</label>
              </div>
              <div class="text-right mt-4">
                <button id="modal-close-btn" class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 smart-defer-close">Đóng</button>
              </div>
            </div>`;
    this.openModal(modalContent);
    this.modalContainer.querySelectorAll('.smart-defer-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx')) || 0;
        const chosen = options[idx];
        if (!chosen) return;
        const exact = !!this.modalContainer.querySelector('#smartdefer-exact-checkbox')?.checked;
        const tIdx = this.data.tasks.findIndex((t) => t.id === task.id);
        const formatted = this.formatDateTime(chosen.date);
        if (tIdx !== -1) {
          this.data.tasks[tIdx].dueDate = formatted;
          if (exact) this.data.tasks[tIdx].reminderMinutes = 0;
        } else {
          task.dueDate = formatted;
          if (exact) task.reminderMinutes = 0;
        }
        this.saveData();
        this.renderAll();
        this.scheduleNotification(task);
        this.hideModal();
      });
    });
  }

  showShareTaskModal(task) {
    const cat = this.data.categories.find((c) => c.id === task.categoryId);
    const catName = cat ? cat.name : 'Chung';
    const tagsText = (task.tags || []).map((t) => `#${t}`).join(' ');
    const prioMap = { high: 'Cao', medium: 'Trung bình', low: 'Thấp' };
    const shareText = [
      `Công việc: ${task.text}`,
      task.dueDate ? `Hạn: ${task.dueDate}` : null,
      `Ưu tiên: ${prioMap[task.priority] || 'Trung bình'}`,
      tagsText ? `Thẻ: ${tagsText}` : null,
      `Hạng mục: ${catName}`,
    ]
      .filter(Boolean)
      .join('\n');

    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6">
              <h3 class="text-lg font-bold mb-4">Chia sẻ công việc</h3>
              <div class="space-y-3">
                <button id="share-quick-btn" class="w-full px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition flex items-center justify-center gap-2"><i class="fas fa-share-from-square"></i> Chia sẻ nhanh</button>
                <button id="share-copy-btn" class="w-full px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition flex items-center justify-center gap-2"><i class="fas fa-copy"></i> Sao chép nội dung</button>
                <button id="share-json-btn" class="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center justify-center gap-2"><i class="fas fa-file-export"></i> Tải về tệp .json</button>
              </div>
              <div class="text-right mt-4"><button id="modal-close-btn" class="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">Đóng</button></div>
            </div>`;
    this.openModal(modalContent);

    const quickBtn = this.modalContainer.querySelector('#share-quick-btn');
    const copyBtn = this.modalContainer.querySelector('#share-copy-btn');
    const jsonBtn = this.modalContainer.querySelector('#share-json-btn');

    if (quickBtn) {
      quickBtn.onclick = async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title: 'Công việc', text: shareText });
            this.hideModal();
          } catch (_) {
            // user cancelled or error -> do nothing
          }
        } else {
          this.showConfirmModal('Không hỗ trợ', 'Thiết bị không hỗ trợ chia sẻ nhanh.', () => {});
        }
      };
    }

    if (copyBtn) {
      copyBtn.onclick = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareText);
          } else {
            const ta = document.createElement('textarea');
            ta.value = shareText;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          this.showConfirmModal(
            'Đã sao chép',
            'Nội dung đã được sao chép vào clipboard.',
            () => {},
          );
        } catch (_) {
          this.showConfirmModal('Lỗi', 'Không thể sao chép nội dung.', () => {});
        }
      };
    }

    if (jsonBtn) {
      jsonBtn.onclick = () => {
        const payload = {
          version: '2.0.0',
          type: 'task',
          exportedAt: this.formatVNISO(new Date()),
          categoryName: catName,
          task: {
            id: task.id,
            text: task.text || '',
            completed: !!task.completed,
            categoryId: task.categoryId,
            dueDate: task.dueDate || null,
            priority: task.priority || 'medium',
            tags: Array.isArray(task.tags) ? task.tags : [],
            notes: typeof task.notes === 'string' ? task.notes : '',
            reminderMinutes: typeof task.reminderMinutes === 'number' ? task.reminderMinutes : 0,
            recurrence: task.recurrence || 'none',
            streak: typeof task.streak === 'number' ? task.streak : 0,
            estimatedMinutes: typeof task.estimatedMinutes === 'number' ? task.estimatedMinutes : 0,
          },
        };
        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todo-task-${task.id}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
      };
    }
  }

  showFocusModal(task) {
    // Initialize timer state
    if (this.focusTimerInterval) clearInterval(this.focusTimerInterval);
    this.focusRemainingSec = 25 * 60; // 25 minutes
    this.focusRunning = false;
    this.focusTaskId = task.id;

    const fmt = (s) => {
      const m = Math.floor(s / 60);
      const ss = s % 60;
      return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    };

    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 text-center">
              <h3 class="text-lg font-bold">Phiên tập trung 25 phút</h3>
              <p class="text-slate-500 mt-1 text-sm">${task.text}</p>
              <div class="mt-5 text-5xl font-mono" id="focus-timer-display">${fmt(
                this.focusRemainingSec,
              )}</div>
              <div class="mt-6 flex justify-center gap-3">
                <button id="focus-toggle-btn" class="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">Bắt đầu</button>
                <button id="focus-done-btn" class="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Hoàn thành</button>
                <button id="modal-close-btn" class="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200">Đóng</button>
              </div>
            </div>`;
    this.openModal(modalContent);

    const display = this.modalContainer.querySelector('#focus-timer-display');
    const toggleBtn = this.modalContainer.querySelector('#focus-toggle-btn');
    const doneBtn = this.modalContainer.querySelector('#focus-done-btn');

    const updateDisplay = () => {
      if (display) display.textContent = fmt(this.focusRemainingSec);
    };

    const stopTimer = () => {
      this.focusRunning = false;
      toggleBtn.textContent = 'Tiếp tục';
      if (this.focusTimerInterval) {
        clearInterval(this.focusTimerInterval);
        this.focusTimerInterval = null;
      }
    };

    const completeSession = () => {
      stopTimer();
      // Ask to mark completed
      this.showConfirmModal('Kết thúc phiên', 'Đánh dấu công việc đã hoàn thành?', () => {
        const idx = this.data.tasks.findIndex((t) => t.id === this.focusTaskId);
        if (idx !== -1) {
          this.data.tasks[idx].completed = true;
          this.saveData();
          this.renderAll();
          try {
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
          } catch (_) {}
        }
      });
    };

    toggleBtn.onclick = () => {
      if (this.focusRunning) {
        stopTimer();
        return;
      }
      // Start timer
      this.focusRunning = true;
      toggleBtn.textContent = 'Tạm dừng';
      this.focusTimerInterval = setInterval(() => {
        this.focusRemainingSec -= 1;
        if (this.focusRemainingSec <= 0) {
          this.focusRemainingSec = 0;
          updateDisplay();
          completeSession();
        } else {
          updateDisplay();
        }
      }, 1000);
    };

    doneBtn.onclick = () => completeSession();
  }

  // --- Daily Brief ---
  maybeShowDailyBrief() {
    try {
      const last = localStorage.getItem('todo_daily_brief_last');
      const today = new Date();
      const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;
      if (last === key) return;
      // Show brief and record
      this.showDailyBrief();
      localStorage.setItem('todo_daily_brief_last', key);
    } catch (_) {}
  }

  showDailyBrief() {
    const now = new Date();
    const todayKey = this.dateOnly(now).getTime();
    const all = this.data.tasks.filter((t) => !t.completed);

    const withDates = all
      .filter((t) => t.dueDate)
      .map((t) => ({ t, d: this.parseDateTime(t.dueDate) }))
      .filter((x) => !!x.d);

    const overdue = withDates
      .filter((x) => x.d < now)
      .sort((a, b) => a.d - b.d)
      .map((x) => x.t);

    // Today items (keep pairs for time-of-day grouping, also keep a flat sorted list)
    const dueTodayPairs = withDates
      .filter((x) => this.dateOnly(x.d).getTime() === todayKey && x.d >= now)
      .sort((a, b) => a.d - b.d);
    const dueToday = dueTodayPairs.map((x) => x.t);

    // Group today by time blocks: Sáng (<12:00), Chiều (12:00–17:59), Tối (>=18:00)
    const morning = dueTodayPairs.filter((x) => x.d.getHours() < 12).map((x) => x.t);
    const afternoon = dueTodayPairs
      .filter((x) => x.d.getHours() >= 12 && x.d.getHours() < 18)
      .map((x) => x.t);
    const evening = dueTodayPairs.filter((x) => x.d.getHours() >= 18).map((x) => x.t);

    const upcoming = withDates
      .filter((x) => this.dateOnly(x.d).getTime() > todayKey)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((x) => x.t);

    // Map category id -> name for quick lookup
    const catMap = Object.fromEntries(this.data.categories.map((c) => [c.id, c.name]));

    const listHTML = (arr, opts = {}) =>
      arr
        .map((t) => {
          const catName = catMap[t.categoryId] || '';
          const dueLabel = t.dueDate
            ? `<span class="ml-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">${t.dueDate}</span>`
            : '';
          const catBadge = catName
            ? `<span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] leading-4">${catName}</span>`
            : '';
          return `<li class="py-1.5 flex items-center justify-between">
              <span class="truncate text-slate-900 dark:text-slate-100">${t.text}${catBadge}</span>
              ${dueLabel}
            </li>`;
        })
        .join('') || '<li class="text-slate-600 dark:text-slate-500 py-1.5">Không có</li>';

    const firstActionId = dueToday[0]?.id || overdue[0]?.id || upcoming[0]?.id;

    const modalContent = `
            <div class="modal-backdrop fixed inset-0"></div>
            <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl m-4 z-10 p-6 daily-brief-modal">
              <h3 class="text-lg font-bold mb-4 flex items-center text-slate-900"><i class="fas fa-sun text-amber-500 mr-2"></i> Bản tin hôm nay</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <div>
                  <div class="text-sm font-semibold text-slate-900 mb-2">Quá hạn <span class="ml-1 inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">${
                    overdue.length
                  }</span></div>
                  <ul class="text-sm space-y-1">${listHTML(overdue)}</ul>
                </div>
                <div>
                  <div class="text-sm font-semibold text-slate-900 mb-2">Trong hôm nay <span class="ml-1 inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">${
                    dueToday.length
                  }</span></div>
                  ${
                    morning.length
                      ? `<div class="text-xs font-semibold text-slate-800 dark:text-slate-300 mt-1">Sáng <span class=\"ml-1 inline-flex items-center justify-center text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-700\">${
                          morning.length
                        }</span></div><ul class="text-sm space-y-1">${listHTML(morning)}</ul>`
                      : ''
                  }
                  ${
                    afternoon.length
                      ? `<div class="text-xs font-semibold text-slate-800 dark:text-slate-300 mt-2">Chiều <span class=\"ml-1 inline-flex items-center justify-center text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-700\">${
                          afternoon.length
                        }</span></div><ul class="text-sm space-y-1">${listHTML(afternoon)}</ul>`
                      : ''
                  }
                  ${
                    evening.length
                      ? `<div class="text-xs font-semibold text-slate-800 dark:text-slate-300 mt-2">Tối <span class=\"ml-1 inline-flex items-center justify-center text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-700\">${
                          evening.length
                        }</span></div><ul class="text-sm space-y-1">${listHTML(evening)}</ul>`
                      : ''
                  }
                </div>
                <div>
                  <div class="text-sm font-semibold text-slate-900 mb-2">Sắp tới <span class="ml-1 inline-flex items-center justify-center text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">${
                    upcoming.length
                  }</span></div>
                  <ul class="text-sm space-y-1">${listHTML(upcoming)}</ul>
                </div>
              </div>
              ${
                !overdue.length && !dueToday.length && !upcoming.length
                  ? '<div class="mt-4 text-center text-sm text-slate-500">Không có việc nào cần chú ý hôm nay.</div>'
                  : ''
              }
              <div class="mt-6 flex justify-end gap-3">
                ${
                  firstActionId
                    ? `<button id="brief-focus-btn" class="px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition shadow-sm brief-btn">Tập trung 25'</button>`
                    : ''
                }
                <button id="modal-close-btn" class="px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium transition shadow-sm brief-btn brief-close">Đóng</button>
              </div>
            </div>`;
    this.openModal(modalContent);
    const focusBtn = this.modalContainer.querySelector('#brief-focus-btn');
    if (focusBtn && firstActionId) {
      focusBtn.onclick = () => {
        const t = this.data.tasks.find((x) => x.id === firstActionId);
        if (t) {
          this.hideModal();
          this.showFocusModal(t);
        }
      };
    }
  }

  hideModal() {
    this.modalContainer.classList.replace('flex', 'hidden');
    this.modalContainer.innerHTML = '';
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
    if (this.focusTimerInterval) {
      clearInterval(this.focusTimerInterval);
      this.focusTimerInterval = null;
      this.focusRunning = false;
    }
  }

  // --- Push Notifications ---
  async initPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        this.pushSubscription = sub;
        try {
          localStorage.setItem('pushSubscription', JSON.stringify(sub.toJSON()));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Push init warning:', err);
    }
  }

  async scheduleAllPushNotifications() {
    // Send all pending task notifications to server so it can schedule them
    const serverUrl = import.meta.env.VITE_PUSH_SERVER_URL;
    if (!serverUrl) return;
    const subJson = this.getPushSubscriptionJSON();
    if (!subJson) return;

    const pendingTasks = this.data.tasks.filter((t) => !t.completed && t.dueDate);
    if (!pendingTasks.length) return;

    try {
      const payload = {
        subscription: subJson,
        tasks: pendingTasks.map((t) => {
          const notifyAt = this.computeNotifyAt(t.dueDate, t.reminderMinutes || 0);
          return {
            id: t.id,
            text: t.text,
            dueDate: t.dueDate,
            reminderMinutes: t.reminderMinutes || 0,
            notifyAtISO: notifyAt ? notifyAt.toISOString() : null,
          };
        }),
      };
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) console.warn('Schedule endpoint unavailable:', res.status);
    } catch (err) {
      console.warn('Schedule push warning:', err);
    }
  }

  parseHHMM(str) {
    if (!str || !/^\d{2}:\d{2}$/.test(str)) return null;
    const [h, m] = str.split(':').map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  isInQuietHours(date) {
    const qh = this.settings?.quietHours;
    if (!qh || !qh.enabled) return false;
    const startMin = this.parseHHMM(qh.start || '22:00');
    const endMin = this.parseHHMM(qh.end || '07:00');
    if (startMin == null || endMin == null) return false;
    const mins = date.getHours() * 60 + date.getMinutes();
    if (startMin < endMin) {
      // same day window, e.g., 21:00-23:00
      return mins >= startMin && mins < endMin;
    } else {
      // overnight window, e.g., 22:00-07:00
      return mins >= startMin || mins < endMin;
    }
  }

  computeNotifyAt(dueDateStr, reminderMinutes) {
    try {
      const due = this.parseDateTime(dueDateStr);
      if (!due) return null;
      const notify = new Date(due.getTime() - (reminderMinutes || 0) * 60000);
      if (!this.isInQuietHours(notify)) return notify;
      // Move to end of quiet window (qh.end) next occurrence >= notify
      const qh = this.settings?.quietHours || { end: '07:00' };
      const endMin = this.parseHHMM(qh.end || '07:00') ?? 7 * 60;
      // set to today at end time; if still before notify, add 1 day
      const endDate = new Date(notify);
      endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
      if (endDate <= notify) endDate.setDate(endDate.getDate() + 1);
      return endDate;
    } catch (_) {
      return null;
    }
  }

  // Format date-time in Vietnam timezone as ISO-like string: YYYY-MM-DDTHH:mm:ss+07:00
  formatVNISO(date) {
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
          .formatToParts(date)
          .reduce((acc, p) => {
            acc[p.type] = p.value;
            return acc;
          }, {});
        return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+07:00`;
      }
    } catch (_) {}
    // Fallback: compute VN time from local offset
    const vnOffsetMin = 7 * 60; // +07:00
    const localOffsetMin = -date.getTimezoneOffset();
    const diffMin = vnOffsetMin - localOffsetMin;
    const d = new Date(date.getTime() + diffMin * 60000);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${DD}T${hh}:${mm}:${ss}+07:00`;
  }

  async cancelNotification(taskId) {
    // Stub: old timeout-based notification cleanup (already removed)
    // In push-based system, server would handle cancellations via API
  }

  async scheduleNotification(task) {
    // Stub: schedule is now handled by scheduleAllPushNotifications
    // Individual adds/edits will also trigger a full re-sync
    await this.scheduleAllPushNotifications();
  }

  // --- Date helpers & recurrence ---
  parseDateTime(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, dd, mm, yyyy, HH, II] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T${HH}:${II}:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  dateOnly(d) {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  formatDateTime(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  }

  // --- Quick Add NLP ---
  parseQuickAdd(raw) {
    let text = raw;
    const out = {
      text: '',
      tags: [],
      priority: 'medium',
      dueDate: null,
      reminderMinutes: 0,
      recurrence: 'none',
      estimatedMinutes: 0,
      notes: '',
      categoryName: null,
    };

    // Tags: #tag
    const tagRegex = /#([\p{L}0-9_\-]+)/giu;
    out.tags = [...raw.matchAll(tagRegex)].map((m) => m[1].toLowerCase());
    text = text.replace(tagRegex, '').trim();

    // Priority: !cao|!trung|!thấp|!high|!medium|!low OR phrase "ưu tiên cao|trung|thấp"
    const pri =
      raw.match(/!(cao|trung|thấp|high|medium|low)/i) ||
      raw.match(/\bưu\s*tiên\s*(cao|trung|thấp|high|medium|low)\b/i);
    if (pri) {
      const map = {
        cao: 'high',
        high: 'high',
        trung: 'medium',
        medium: 'medium',
        thấp: 'low',
        low: 'low',
      };
      const key = (pri[1] || '').toLowerCase();
      out.priority = map[key] || 'medium';
      text = text.replace(pri[0], '').trim();
    }

    // Recurrence: lặp ngày|tuần|tháng | repeat daily|weekly|monthly
    const rec = raw.match(/\b(lặp\s+(ngày|tuần|tháng)|repeat\s+(daily|weekly|monthly))\b/i);
    if (rec) {
      const str = (rec[2] || rec[3] || '').toLowerCase();
      const map = {
        ngày: 'daily',
        daily: 'daily',
        tuần: 'weekly',
        weekly: 'weekly',
        tháng: 'monthly',
        monthly: 'monthly',
      };
      out.recurrence = map[str] || 'none';
      text = text.replace(rec[0], '').trim();
    }

    // Estimated minutes: ~30p | ước 30p | est 30m
    const est = raw.match(/\b(~|ước|uoc|est)\s*(\d{1,3})\s*(phút|p|m|min)\b/i);
    if (est) {
      out.estimatedMinutes = Math.max(0, Math.round(Number(est[2]) || 0));
      text = text.replace(est[0], '').trim();
    }

    // Notes: ghi chú: ... | note: ... (capture rest of line)
    const noteM = text.match(/\b(ghi\s*chú|note|notes)\s*:\s*(.+)$/i);
    if (noteM) {
      out.notes = (noteM[2] || '').trim();
      text = text.replace(noteM[0], '').trim();
    }

    // Category: c:"Tên có dấu cách" | c:TenKhongDauCach (until #,! or end)
    let catName = null;
    const catQuoted = text.match(/\bc:\"([^\"]+)\"/i);
    if (catQuoted) {
      catName = catQuoted[1].trim();
      text = text.replace(catQuoted[0], '').trim();
    } else {
      const catPlain = text.match(/\bc:([^#!,\n]+?)(?=\s*[#!,]|$)/i);
      if (catPlain) {
        catName = (catPlain[1] || '').trim();
        text = text.replace(catPlain[0], '').trim();
      }
    }
    if (catName) out.categoryName = catName;

    // Reminder: nhắc 10p|10 phút|remind 10m|min
    const rem = raw.match(/\b(nhắc|remind)\s+(\d+)\s*(p|phút|m|min)\b/i);
    if (rem) {
      out.reminderMinutes = Number(rem[2]) || 0;
      text = text.replace(rem[0], '').trim();
    }

    // Relative: sau 30p|trong 2 giờ|in 30m|in 2h
    const rel = raw.match(
      /\b(sau|trong|in)\s+(\d+)\s*(phút|p|m|min|giờ|h|hour|hours|ngày|d|day|days)\b/i,
    );
    // Absolute date keywords: hôm nay | mai
    const todayKw = /\bhôm\s*nay\b/i.test(raw);
    const tomorrowKw = /\b(mai|ngày\s*mai)\b/i.test(raw);
    // Absolute date dd/mm/yyyy OR dd/mm and time HH:mm
    const dateFull = raw.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    const dateShort = raw.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    const timeM = raw.match(/\b(\d{1,2}):(\d{2})\b/);

    let baseDate = null;
    if (rel) {
      const qty = Number(rel[2]);
      const unit = rel[3].toLowerCase();
      const now = new Date();
      if (/(phút|p|m|min)/.test(unit)) now.setMinutes(now.getMinutes() + qty);
      else if (/(giờ|h|hour|hours)/.test(unit)) now.setHours(now.getHours() + qty);
      else if (/(ngày|d|day|days)/.test(unit)) now.setDate(now.getDate() + qty);
      baseDate = now;
      text = text.replace(rel[0], '').trim();
    } else if (todayKw || tomorrowKw || dateFull || dateShort) {
      const now = new Date();
      if (todayKw)
        baseDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours(),
          now.getMinutes(),
        );
      if (tomorrowKw)
        baseDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          now.getHours(),
          now.getMinutes(),
        );
      if (dateFull) {
        const dd = Number(dateFull[1]),
          mm = Number(dateFull[2]),
          yyyy = Number(dateFull[3]);
        baseDate = new Date(yyyy, mm - 1, dd, now.getHours(), now.getMinutes());
        text = text.replace(dateFull[0], '').trim();
      } else if (dateShort) {
        const dd = Number(dateShort[1]),
          mm = Number(dateShort[2]);
        baseDate = new Date(now.getFullYear(), mm - 1, dd, now.getHours(), now.getMinutes());
        text = text.replace(dateShort[0], '').trim();
      }
      if (todayKw) text = text.replace(/\bhôm\s*nay\b/i, '').trim();
      if (tomorrowKw) text = text.replace(/\b(mai|ngày\s*mai)\b/i, '').trim();
    }

    if (timeM) {
      const HH = Number(timeM[1]),
        II = Number(timeM[2]);
      const base = baseDate || new Date();
      base.setHours(HH, II, 0, 0);
      baseDate = base;
      text = text.replace(timeM[0], '').trim();
    }

    if (baseDate) {
      out.dueDate = this.formatDateTime(baseDate);
    }

    // Clean multiple spaces
    out.text = text.replace(/\s{2,}/g, ' ').trim();
    return out;
  }

  async startVoiceQuickAdd() {
    // Hybrid approach: try Web Speech API first; if unavailable or fails, fallback to recording + server-side STT
    const btn = this.quickAddVoiceBtn;
    const stopRecordingUI = () => {
      if (btn) {
        btn.classList.remove('animate-pulse', 'text-red-500');
        btn.title = 'Thêm bằng giọng nói';
      }
      if (this.voiceStopTimer) {
        clearTimeout(this.voiceStopTimer);
        this.voiceStopTimer = null;
      }
    };

    // Toggle stop if currently recording via MediaRecorder
    if (this.mediaRecorder && this.voiceRecording) {
      try {
        if (this.mediaRecorder.state === 'recording') this.mediaRecorder.stop();
      } catch (_) {}
      stopRecordingUI();
      this.voiceRecording = false;
      return;
    }

    if (!window.isSecureContext) {
      this.showConfirmModal(
        'Yêu cầu HTTPS',
        'Nhập giọng nói cần chạy trên HTTPS hoặc localhost.',
        () => {},
      );
      return;
    }

    // Preflight mic permission (common blockers on mobile)
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        try {
          // Don't keep it open for Web Speech path
          s.getTracks().forEach((t) => t.stop());
        } catch (_) {}
      }
    } catch (_) {
      this.showConfirmModal(
        'Không truy cập được micro',
        'Hãy cấp quyền micro cho trang này (biểu tượng ổ khóa > Site settings > Microphone > Allow).',
        () => {},
      );
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.lang = 'vi-VN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        if (btn) {
          btn.classList.add('animate-pulse', 'text-red-500');
          btn.title = 'Đang nghe... bấm để dừng';
        }

        rec.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          if (this.quickAddInput) this.quickAddInput.value = transcript;
          this.addQuickTaskFromRaw(transcript);
        };
        rec.onerror = (e) => {
          stopRecordingUI();
          // Fallback to recorder on error (e.g., unsupported locale)
          this.recordAndTranscribeFallback();
        };
        rec.onend = () => {
          stopRecordingUI();
        };
        rec.start();
        return;
      } catch (err) {
        console.warn('Web Speech failed, trying recorder fallback:', err);
        // continue to fallback
      }
    }

    // Fallback: record with MediaRecorder and send to server for STT
    this.recordAndTranscribeFallback();
  }

  async recordAndTranscribeFallback() {
    const btn = this.quickAddVoiceBtn;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.showConfirmModal(
        'Không hỗ trợ',
        'Thiết bị không hỗ trợ ghi âm chuẩn web. Vui lòng dùng Chrome/Edge mới hoặc cập nhật hệ điều hành.',
        () => {},
      );
      return;
    }

    const serverUrl = import.meta.env.VITE_PUSH_SERVER_URL; // dùng chung base functions
    if (!serverUrl) {
      this.showConfirmModal(
        'Thiếu cấu hình',
        'Chưa cấu hình VITE_PUSH_SERVER_URL để gọi chức năng chuyển giọng nói thành văn bản.',
        () => {},
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pick best supported mime type across browsers
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];
      this.mediaRecorder = mr;
      this.mediaStream = stream;
      this.voiceRecording = true;
      if (btn) {
        btn.classList.add('animate-pulse', 'text-red-500');
        btn.title = 'Đang ghi... bấm để dừng';
      }

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      mr.onstop = async () => {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch (_) {}
        this.voiceRecording = false;
        if (btn) {
          btn.classList.remove('animate-pulse', 'text-red-500');
          btn.title = 'Thêm bằng giọng nói';
        }
        if (this.voiceStopTimer) {
          clearTimeout(this.voiceStopTimer);
          this.voiceStopTimer = null;
        }
        if (!chunks.length) return;
        const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, `audio.${(mimeType || 'webm').split('/')[1] || 'webm'}`);
        try {
          const res = await fetch(`${serverUrl.replace(/\/$/, '')}/transcribe`, {
            method: 'POST',
            body: fd,
          });
          if (!res.ok) throw new Error(`Transcribe error ${res.status}`);
          const json = await res.json();
          const text = (json && json.text) || '';
          if (text) {
            if (this.quickAddInput) this.quickAddInput.value = text;
            this.addQuickTaskFromRaw(text);
          } else {
            this.showConfirmModal(
              'Không nhận dạng được',
              'Không thu được nội dung hợp lệ.',
              () => {},
            );
          }
        } catch (err) {
          console.warn('Transcribe request failed:', err);
          this.showConfirmModal('Lỗi', 'Không thể chuyển giọng nói thành văn bản.', () => {});
        }
      };

      mr.start(250); // small timeslice to emit chunks
      // Auto-stop after 15s so file không quá dài
      this.voiceStopTimer = setTimeout(() => {
        try {
          if (mr.state === 'recording') mr.stop();
        } catch (_) {}
      }, 15000);
    } catch (err) {
      console.warn('MediaRecorder fallback failed:', err);
      this.showConfirmModal('Lỗi', 'Không thể bắt đầu ghi âm trên thiết bị này.', () => {});
    }
  }
  computeNextDueDate(dueDateStr, recurrence) {
    // Input format: dd/mm/yyyy HH:ii
    const d = this.parseDateTime(dueDateStr);
    if (!d) return dueDateStr;
    switch (recurrence) {
      case 'daily':
        d.setDate(d.getDate() + 1);
        break;
      case 'weekly':
        d.setDate(d.getDate() + 7);
        break;
      case 'monthly':
        d.setMonth(d.getMonth() + 1);
        break;
      default:
        return dueDateStr;
    }
    return this.formatDateTime(d);
  }

  // --- AI Advisor ---
  // Cooldown helpers to prevent spamming AI API
  getAICooldownRemainingMs() {
    try {
      const until = Number(localStorage.getItem('ai_cooldown_until') || 0);
      const now = Date.now();
      return Math.max(0, until - now);
    } catch (_) {
      return 0;
    }
  }

  setAICooldown(seconds = 60) {
    const until = Date.now() + Math.max(0, seconds) * 1000;
    try {
      localStorage.setItem('ai_cooldown_until', String(until));
    } catch (_) {}
    this.startAICooldownTicker();
  }

  startAICooldownTicker() {
    // Update button UI immediately
    this.updateAICooldownUI();
    if (this.aiCooldownInterval) {
      clearInterval(this.aiCooldownInterval);
      this.aiCooldownInterval = null;
    }
    const remain = this.getAICooldownRemainingMs();
    if (remain <= 0) return;
    this.aiCooldownInterval = setInterval(() => {
      const r = this.getAICooldownRemainingMs();
      this.updateAICooldownUI();
      if (r <= 0) {
        clearInterval(this.aiCooldownInterval);
        this.aiCooldownInterval = null;
        this.updateAICooldownUI();
      }
    }, 1000);
  }

  updateAICooldownUI() {
    if (!this.aiAdvisorBtn) return;
    const ms = this.getAICooldownRemainingMs();
    const secs = Math.ceil(ms / 1000);
    if (ms > 0) {
      this.aiAdvisorBtn.classList.add('opacity-60', 'cursor-not-allowed');
      this.aiAdvisorBtn.setAttribute('aria-disabled', 'true');
      this.aiAdvisorBtn.setAttribute('title', `Chờ ${secs}s để dùng AI lại`);
    } else {
      this.aiAdvisorBtn.classList.remove('opacity-60', 'cursor-not-allowed');
      this.aiAdvisorBtn.removeAttribute('aria-disabled');
      this.aiAdvisorBtn.setAttribute('title', 'Cố vấn AI');
    }
  }

  showAICooldownModal() {
    const ms = this.getAICooldownRemainingMs();
    const secs = Math.ceil(ms / 1000);
    const html = `
      <div class="modal-backdrop fixed inset-0"></div>
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 text-center">
        <h3 class="text-lg font-bold mb-2">Tạm dừng chức năng AI</h3>
        <p class="text-slate-600">Vui lòng chờ <span id="ai-cooldown-secs" class="font-semibold">${secs}</span>s trước khi dùng lại.</p>
        <p class="text-xs text-slate-500 mt-2">Mục đích: tránh spam chức năng AI.</p>
        <div class="text-right mt-4">
          <button id="modal-close-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200">Đóng</button>
        </div>
      </div>`;
    this.openModal(html);
    const label = this.modalContainer.querySelector('#ai-cooldown-secs');
    if (this.aiCooldownModalInterval) clearInterval(this.aiCooldownModalInterval);
    this.aiCooldownModalInterval = setInterval(() => {
      const r = this.getAICooldownRemainingMs();
      const s = Math.max(0, Math.ceil(r / 1000));
      if (label) label.textContent = String(s);
      if (r <= 0) {
        clearInterval(this.aiCooldownModalInterval);
        this.aiCooldownModalInterval = null;
        this.hideModal();
      }
    }, 1000);
  }

  parseMarkdown(markdown) {
    if (!markdown || typeof marked === 'undefined' || typeof DOMPurify === 'undefined')
      return markdown.replace(/\n/g, '<br>');
    marked.setOptions({ breaks: true, gfm: true });
    return DOMPurify.sanitize(marked.parse(markdown));
  }

  // Try to robustly parse JSON from an LLM response that may include code fences or extra text
  parseAIResponse(raw, mode) {
    const tryParse = (s) => {
      try {
        return JSON.parse(s);
      } catch (_) {
        return null;
      }
    };

    if (!raw || typeof raw !== 'string') return null;
    let text = String(raw).trim();

    // 1) Direct parse
    let json = tryParse(text);
    if (json) return this.normalizeAIShape(json, mode);

    // 2) Strip code fences
    const fenceMatch = text.match(/^```(?:json)?\n([\s\S]*?)\n```\s*$/i);
    if (fenceMatch) {
      json = tryParse(fenceMatch[1]);
      if (json) return this.normalizeAIShape(json, mode);
    }

    // 3) Extract first fenced block
    const anyFence = text.match(/```json\n([\s\S]*?)\n```/i) || text.match(/```\n([\s\S]*?)\n```/i);
    if (anyFence) {
      json = tryParse(anyFence[1]);
      if (json) return this.normalizeAIShape(json, mode);
    }

    // 4) Extract a balanced JSON object from the first '{'
    const extractJSONObject = (s) => {
      const start = s.indexOf('{');
      if (start === -1) return null;
      let i = start;
      let depth = 0;
      let inStr = false;
      let esc = false;
      for (; i < s.length; i++) {
        const ch = s[i];
        if (inStr) {
          if (esc) {
            esc = false;
          } else if (ch === '\\') {
            esc = true;
          } else if (ch === '"') {
            inStr = false;
          }
          continue;
        }
        if (ch === '"') {
          inStr = true;
        } else if (ch === '{') {
          depth++;
        } else if (ch === '}') {
          depth--;
          if (depth === 0) {
            return s.slice(start, i + 1);
          }
        }
      }
      return null;
    };
    const objSlice = extractJSONObject(text);
    if (objSlice) {
      json = tryParse(objSlice);
      if (json) return this.normalizeAIShape(json, mode);
    }

    // 5) Sometimes model returns top-level arrays; wrap into expected shape if possible
    const arr = (() => {
      try {
        return JSON.parse(text);
      } catch (_) {
        const fenceArr = anyFence?.[1];
        if (!fenceArr) return null;
        try {
          return JSON.parse(fenceArr);
        } catch (_) {
          return null;
        }
      }
    })();
    if (Array.isArray(arr)) {
      if (mode === 'due_date_suggestions')
        return { type: 'due_date_suggestions', suggestions: arr };
      if (mode === 'today_plan') return { type: 'today_plan', items: arr };
      if (mode === 'duration_estimates') return { type: 'duration_estimates', estimates: arr };
      if (mode === 'priority_order') return { type: 'priority_order', orderedTaskIds: arr };
    }

    return null;
  }

  // Normalize minor schema drift from the model
  normalizeAIShape(obj, mode) {
    if (!obj || typeof obj !== 'object') return obj;
    // Many models return keys in different casing or as strings; try to coerce minimally
    try {
      if (mode === 'priority_order') {
        if (!Array.isArray(obj.orderedTaskIds) && Array.isArray(obj.ordered_ids))
          obj.orderedTaskIds = obj.ordered_ids;
      } else if (mode === 'due_date_suggestions') {
        if (!Array.isArray(obj.suggestions) && Array.isArray(obj.items))
          obj.suggestions = obj.items;
      } else if (mode === 'today_plan') {
        if (!Array.isArray(obj.items) && Array.isArray(obj.suggestions))
          obj.items = obj.suggestions;
      } else if (mode === 'duration_estimates') {
        if (!Array.isArray(obj.estimates) && Array.isArray(obj.items)) obj.estimates = obj.items;
      }
    } catch (_) {}
    return obj;
  }

  // Heuristic selection to limit tasks for AI prompt size
  selectTopTasksForAI(tasks, limit = 40) {
    const now = new Date();
    const prioRank = { high: 2, medium: 1, low: 0 };
    const withScores = tasks.map((t) => {
      const d = t.dueDate ? this.parseDateTime(t.dueDate) : null;
      const overdue = d ? d < now : false;
      const soon = d ? d >= now && d.getTime() - now.getTime() <= 24 * 3600000 : false;
      const hasDue = !!d;
      const pr = prioRank[t.priority] ?? 1;
      const txtLen = (t.text || '').length;
      // Score: overdue >> soon >> hasDue, then priority, then shorter text
      const score =
        (overdue ? 1000 : 0) +
        (soon ? 500 : 0) +
        (hasDue ? 100 : 0) +
        pr * 10 -
        Math.min(txtLen, 100) / 100;
      return { t, score, d };
    });
    withScores.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.d && b.d) return a.d - b.d;
      if (a.d && !b.d) return -1;
      if (!a.d && b.d) return 1;
      return (a.t.text || '').length - (b.t.text || '').length;
    });
    return withScores.slice(0, Math.max(1, limit)).map((x) => x.t);
  }

  async getAIAdvice() {
    // Respect cooldown before opening config
    const remain = this.getAICooldownRemainingMs();
    if (remain > 0) {
      this.showAICooldownModal();
      return;
    }
    // Open a small config modal to choose advisor mode, then run
    this.showAIAdvisorConfigModal();
  }

  showAIAdvisorConfigModal() {
    const hasAnyPending = this.data.tasks.some(
      (t) => t.categoryId === this.data.activeCategoryId && !t.completed,
    );
    if (!hasAnyPending) {
      this.showConfirmModal('Cố vấn AI', 'Bạn không có công việc nào trong mục này!', () => {});
      return;
    }
    const modalContent = `
      <div class="modal-backdrop fixed inset-0"></div>
      <div class="bg-white rounded-lg shadow-xl w-full max-w-md m-4 z-10 p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-bold">Cố vấn AI</h3>
          <button id="modal-close-btn" class="w-9 h-9 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition leading-none text-lg" aria-label="Đóng"><i class="fas fa-times"></i></button>
        </div>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Chế độ</label>
            <div class="select-wrapper">
              <select id="ai-mode-select" class="form-select">
                <option value="priority_order">Sắp xếp ưu tiên</option>
                <option value="due_date_suggestions">Gợi ý hạn chót</option>
                <option value="today_plan">Kế hoạch hôm nay</option>
                <option value="duration_estimates">Ước tính thời lượng</option>
              </select>
            </div>
          </div>
          <div id="ai-due-extra" class="hidden">
            <label class="inline-flex items-center gap-2 text-sm text-slate-600">
              <input id="ai-only-missing-due" type="checkbox" checked>
              Chỉ gợi ý cho việc <strong>chưa có hạn</strong>
            </label>
          </div>
          <p class="text-xs text-slate-500">Lưu ý: AI xử lý tối đa 10 công việc mỗi lần (ưu tiên việc gấp/trễ).</p>
          <p id="ai-cooldown-inline" class="hidden text-xs text-amber-700">Vui lòng chờ <span id="ai-cooldown-inline-secs">0</span>s để dùng lại.</p>
          <div class="text-right">
            <button id="ai-run-btn" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Tạo gợi ý</button>
          </div>
        </div>
      </div>`;
    this.openModal(modalContent);
    const modeSel = this.modalContainer.querySelector('#ai-mode-select');
    const dueExtra = this.modalContainer.querySelector('#ai-due-extra');
    modeSel.addEventListener('change', () => {
      dueExtra.classList.toggle('hidden', modeSel.value !== 'due_date_suggestions');
    });
    const runBtn = this.modalContainer.querySelector('#ai-run-btn');
    const cdWrap = this.modalContainer.querySelector('#ai-cooldown-inline');
    const cdSecs = this.modalContainer.querySelector('#ai-cooldown-inline-secs');

    const refreshInlineCooldown = () => {
      const ms = this.getAICooldownRemainingMs();
      if (ms > 0) {
        const s = Math.ceil(ms / 1000);
        cdWrap.classList.remove('hidden');
        if (cdSecs) cdSecs.textContent = String(s);
        runBtn.disabled = true;
        runBtn.classList.add('opacity-60', 'cursor-not-allowed');
        runBtn.title = `Chờ ${s}s`;
      } else {
        cdWrap.classList.add('hidden');
        runBtn.disabled = false;
        runBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        runBtn.title = '';
      }
    };
    refreshInlineCooldown();
    const modalTicker = setInterval(() => {
      if (!document.body.contains(this.modalContainer)) {
        clearInterval(modalTicker);
        return;
      }
      refreshInlineCooldown();
      if (this.getAICooldownRemainingMs() <= 0) clearInterval(modalTicker);
    }, 1000);

    runBtn.onclick = async () => {
      const mode = modeSel.value;
      const onlyMissing = !!this.modalContainer.querySelector('#ai-only-missing-due')?.checked;
      this.hideModal();
      await this.runAIAdvisor(mode, { onlyMissing });
    };
  }

  async runAIAdvisor(mode, opts = {}) {
    // Set cooldown early to prevent back-to-back calls
    this.setAICooldown(60);
    this.updateAICooldownUI();

    const tasks = this.data.tasks.filter(
      (t) => t.categoryId === this.data.activeCategoryId && !t.completed,
    );
    const filtered =
      mode === 'due_date_suggestions' && opts.onlyMissing ? tasks.filter((t) => !t.dueDate) : tasks;
    if (filtered.length === 0) {
      this.showConfirmModal('Cố vấn AI', 'Không có dữ liệu phù hợp để gợi ý.', () => {});
      return;
    }

    // Loading modal
    const loadingHTML = `
      <div class="modal-backdrop fixed inset-0"></div>
      <div class="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 z-10 p-6 text-center">
        <div class="flex justify-center items-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p class="ml-3 text-gray-600">AI đang suy nghĩ...</p>
        </div>
      </div>`;
    this.openModal(loadingHTML);

    const now = new Date();
    const ctxBase = {
      timeZone: 'Asia/Ho_Chi_Minh',
      nowISO: this.formatVNISO(now),
      quietHours: this.settings.quietHours || { enabled: true, start: '22:00', end: '07:00' },
      mode,
    };
    // Single-shot: cap number of tasks by system default (fixed)
    const primaryList = this.selectTopTasksForAI(filtered, Math.min(10, filtered.length));
    const trimmedOnce = primaryList.length < filtered.length;
    const catMap = Object.fromEntries(this.data.categories.map((c) => [c.id, c.name]));
    const toPayloadTasks = (arr) =>
      arr.map((t) => ({
        id: t.id,
        text: String(t.text || '').slice(0, 80),
        priority: t.priority,
        dueDate: t.dueDate || null,
        tags: Array.isArray(t.tags) ? t.tags.slice(0, 5) : [],
        estimatedMinutes:
          typeof t.estimatedMinutes === 'number' ? Math.max(0, Math.round(t.estimatedMinutes)) : 0,
        category: catMap[t.categoryId] || '',
      }));

    // Build minimal instruction per mode
    // Build advanced instruction per mode (richer constraints and reasoning fields)
    let instruction = '';
    if (mode === 'priority_order') {
      instruction = [
        'Mục tiêu: Sắp xếp thứ tự ưu tiên thực tế.',
        '- Ưu tiên: quá hạn > sắp đến hạn > có hạn > không hạn.',
        '- Cân nhắc độ ưu tiên (high>medium>low), ước tính thời lượng (ngắn trước khi xen kẽ dài), thẻ/tag và hạng mục để gom ngữ cảnh.',
        '- Tránh dồn toàn việc dài liên tiếp; xen kẽ để giữ nhịp.',
        'Xuất JSON minified theo schema:',
        '{"type":"priority_order","orderedTaskIds":number[],"notes":string}',
      ].join('\n');
    } else if (mode === 'due_date_suggestions') {
      instruction = [
        'Mục tiêu: Gợi ý hạn chót hợp lý (dd/mm/yyyy HH:mm).',
        '- Tránh rơi vào khung giờ yên lặng (quietHours). Nếu trùng, dời đến sau quiet.end gần nhất.',
        '- Tôn trọng mức ưu tiên: high sớm hơn, low có thể xa hơn.',
        '- Giới hạn trong 30 ngày tới trừ khi có lý do rõ ràng.',
        'Xuất JSON minified theo schema:',
        '{"type":"due_date_suggestions","suggestions":[{"id":number,"dueDate":string,"reason":string}],"notes":string}',
      ].join('\n');
    } else if (mode === 'today_plan') {
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = String(now.getFullYear());
      instruction = [
        `Mục tiêu: Lập kế hoạch cho hôm nay (${dd}/${mm}/${yyyy}).`,
        '- Chỉ sắp thời gian trong hôm nay; tôn trọng quietHours.',
        '- Phân bổ hợp lý theo thời gian trong ngày (sáng/chiều/tối), tránh chồng chéo.',
        '- Việc ngắn chen kẽ việc dài; ưu tiên high trước medium/low nếu không xung đột.',
        'Xuất JSON minified theo schema:',
        '{"type":"today_plan","items":[{"id":number,"dueDate":string,"reason":string}],"notes":string}',
      ].join('\n');
    } else if (mode === 'duration_estimates') {
      instruction = [
        'Mục tiêu: Ước tính thời lượng (phút) bội số 5, trong khoảng 5–180.',
        '- Cân nhắc độ khó ngầm từ nội dung, tag, mức ưu tiên, có/không có hạn.',
        '- Tránh ước tính quá thấp cho việc phức tạp.',
        'Xuất JSON minified theo schema:',
        '{"type":"duration_estimates","estimates":[{"id":number,"minutes":number,"reason":string}],"notes":string}',
      ].join('\n');
    }

    const buildPrompt = (ctx, mode, tasksArray) =>
      [
        `Role: Chuyên gia lập kế hoạch cá nhân (vi-VN).`,
        `Context: tz=${ctx.timeZone}; now=${ctx.nowISO}; quiet=${ctx.quietHours.start}-${ctx.quietHours.end}; mode=${mode}.`,
        'Tasks JSON (mỗi task): {id, text, category, priority, dueDate|null, tags[], estimatedMinutes}.',
        `TASKS_JSON=${JSON.stringify(tasksArray)}`,
        'Nguyên tắc chung:',
        '- Không dời việc đã quá hạn sang ban đêm; tôn trọng quietHours.',
        '- Nếu thiếu dữ liệu, suy luận hợp lý nhưng không bịa thông tin ngoài phạm vi.',
        '- Trả về JSON minify KHÔNG có văn bản thừa.',
        trimmedOnce ? `Lưu ý: chỉ xét ${tasksArray.length} task (đã rút gọn).` : '',
        'Schema & yêu cầu đầu ra:',
        instruction,
      ]
        .filter(Boolean)
        .join('\n');

    const callAI = async (tasksArr) => {
      const apiKey = import.meta.env.VITE_AI_API_KEY;
      if (!apiKey) {
        this.showConfirmModal(
          'Cấu hình AI thiếu',
          'Vui lòng thêm biến VITE_AI_API_KEY vào file .env để sử dụng Cố vấn AI.',
          () => {},
        );
        return { error: 'missing_key' };
      }
      let model = import.meta.env.VITE_AI_MODEL || 'models/gemini-2.5-flash';
      if (!model.startsWith('models/')) model = `models/${model}`;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: buildPrompt(ctxBase, mode, toPayloadTasks(tasksArr)) }] }],
        generationConfig: {
          temperature: 0.2,
          topK: 20,
          topP: 0.6,
          maxOutputTokens: 512,
          responseMimeType: 'application/json',
        },
      };
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const result = await response.json();
      const candidate = result?.candidates?.[0];
      const raw = candidate?.content?.parts?.[0]?.text || '';
      const finishReason = candidate?.finishReason || '';
      let json = this.parseAIResponse(raw, mode);
      return { json, raw, finishReason };
    };

    try {
      const { json, raw, finishReason } = await callAI(primaryList);
      const taskContext = toPayloadTasks(primaryList);
      if (!json || typeof json !== 'object') {
        // Fallback: show raw content
        const fallback = this.parseMarkdown(raw || JSON.stringify({ finishReason }, null, 2));
        const html = `
          <div class="modal-backdrop fixed inset-0"></div>
          <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-md m-4 z-10 flex flex-col max-h-[85vh]">
            <div class="p-5 border-b flex-shrink-0"><h3 class="text-lg font-medium flex items-center"><i class="fas fa-robot text-indigo-600 mr-3"></i> Cố vấn AI</h3></div>
            <div class="p-6 text-left text-gray-700 overflow-y-auto prose">${fallback}</div>
            <div class="p-4 bg-slate-50 flex justify-end flex-shrink-0 border-t"><button id="modal-close-btn" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Đóng</button></div>
          </div>`;
        this.openModal(html);
        return;
      }

      if (mode === 'priority_order' && Array.isArray(json.orderedTaskIds)) {
        const ordered = json.orderedTaskIds.filter((id) => typeof id === 'number');
        const items =
          ordered
            .map((id) => {
              const t = taskContext.find((x) => x.id === id);
              return `<li class="py-1.5">${t ? t.text : id}</li>`;
            })
            .join('') || '<li class="text-slate-500">Không có gợi ý</li>';
        const notes = json.notes
          ? `<div class="mt-3 text-sm text-slate-500">${json.notes}</div>`
          : '';
        const html = `
          <div class="modal-backdrop fixed inset-0"></div>
          <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-md m-4 z-10 p-6">
            <h3 class="text-lg font-bold mb-3">Thứ tự gợi ý</h3>
            <p class="text-xs text-slate-500 mb-2">Lưu ý: tối đa 10 công việc được xử lý mỗi lần.</p>
            <ul class="text-sm mb-4">${items}</ul>
            ${notes}
            <div class="text-right mt-4">
              <button id="modal-close-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 mr-2">Đóng</button>
              <button id="ai-apply-order" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Áp dụng thứ tự</button>
            </div>
          </div>`;
        this.openModal(html);
        const applyBtn = this.modalContainer.querySelector('#ai-apply-order');
        applyBtn.onclick = () => {
          this.applyAIReorder(ordered);
          this.hideModal();
        };
        return;
      }

      if (mode === 'due_date_suggestions' && Array.isArray(json.suggestions)) {
        const suggestions = json.suggestions.filter((s) => typeof s.id === 'number' && s.dueDate);
        const rows =
          suggestions
            .map((s) => {
              const t = taskContext.find((x) => x.id === s.id);
              return `<li class="py-2 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div class="font-medium text-slate-900 dark:text-slate-100">${
                    t?.text || s.id
                  }</div>
                  <div class="text-xs text-slate-500 mt-1"><i class='fas fa-bell mr-1'></i>${
                    s.dueDate
                  }${s.reason ? ` · ${s.reason}` : ''}</div>
                </div>
                <button class="ai-apply-due px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" data-id="${
                  s.id
                }" data-due="${s.dueDate}">Áp dụng</button>
              </li>`;
            })
            .join('') || '<li class="text-slate-500">Không có gợi ý</li>';
        const notes = json.notes
          ? `<div class="mt-3 text-sm text-slate-500">${json.notes}</div>`
          : '';
        const html = `
          <div class="modal-backdrop fixed inset-0"></div>
          <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-lg m-4 z-10 p-6">
            <h3 class="text-lg font-bold mb-3">Gợi ý hạn chót</h3>
            <p class="text-xs text-slate-500 mb-2">Lưu ý: tối đa 10 công việc được xử lý mỗi lần.</p>
            <ul class="text-sm">${rows}</ul>
            ${notes}
            <div class="text-right mt-4">
              <button id="modal-close-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 mr-2">Đóng</button>
              <button id="ai-apply-all-due" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Áp dụng tất cả</button>
            </div>
          </div>`;
        this.openModal(html);
        this.modalContainer.querySelectorAll('.ai-apply-due').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-id'));
            const due = String(btn.getAttribute('data-due'));
            this.applyAIDueSuggestion([{ id, dueDate: due }]);
          });
        });
        const applyAll = this.modalContainer.querySelector('#ai-apply-all-due');
        applyAll.onclick = () => {
          const payload = suggestions.map((s) => ({ id: s.id, dueDate: s.dueDate }));
          this.applyAIDueSuggestion(payload);
          this.hideModal();
        };
        return;
      }

      if (mode === 'today_plan' && Array.isArray(json.items)) {
        const items = json.items.filter((s) => typeof s.id === 'number' && s.dueDate);
        const rows =
          items
            .map((s) => {
              const t = taskContext.find((x) => x.id === s.id);
              return `<li class="py-2 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div class="font-medium text-slate-900 dark:text-slate-100">${
                    t?.text || s.id
                  }</div>
                  <div class="text-xs text-slate-500 mt-1"><i class='fas fa-bell mr-1'></i>${
                    s.dueDate
                  }${s.reason ? ` · ${s.reason}` : ''}</div>
                </div>
                <button class="ai-apply-today px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" data-id="${
                  s.id
                }" data-due="${s.dueDate}">Áp dụng</button>
              </li>`;
            })
            .join('') || '<li class="text-slate-500">Không có gợi ý</li>';
        const notes = json.notes
          ? `<div class="mt-3 text-sm text-slate-500">${json.notes}</div>`
          : '';
        const html = `
          <div class="modal-backdrop fixed inset-0"></div>
          <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-lg m-4 z-10 p-6">
            <h3 class="text-lg font-bold mb-3">Kế hoạch hôm nay</h3>
            <p class="text-xs text-slate-500 mb-2">Lưu ý: tối đa 10 công việc được xử lý mỗi lần.</p>
            <ul class="text-sm">${rows}</ul>
            ${notes}
            <div class="text-right mt-4">
              <button id="modal-close-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 mr-2">Đóng</button>
              <button id="ai-apply-all-today" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Áp dụng tất cả</button>
            </div>
          </div>`;
        this.openModal(html);
        this.modalContainer.querySelectorAll('.ai-apply-today').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-id'));
            const due = String(btn.getAttribute('data-due'));
            this.applyAIDueSuggestion(
              [{ id, dueDate: due }],
              this.settings.todayPlanDefaultReminder ?? 0,
            );
          });
        });
        const applyAll = this.modalContainer.querySelector('#ai-apply-all-today');
        applyAll.onclick = () => {
          const payload = items.map((s) => ({ id: s.id, dueDate: s.dueDate }));
          this.applyAIDueSuggestion(payload, this.settings.todayPlanDefaultReminder ?? 0);
          this.hideModal();
        };
        return;
      }

      if (mode === 'duration_estimates' && Array.isArray(json.estimates)) {
        const rows =
          json.estimates
            .filter((e) => typeof e.id === 'number' && typeof e.minutes === 'number')
            .map((e) => {
              const t = taskContext.find((x) => x.id === e.id);
              const mins = Math.max(0, Math.round(e.minutes));
              return `<li class="py-2 flex items-center justify-between border-b border-slate-100">
                <div>
                  <div class="font-medium text-slate-900 dark:text-slate-100">${
                    t?.text || e.id
                  }</div>
                  <div class="text-xs text-slate-500 mt-1"><i class='fas fa-stopwatch mr-1'></i>${mins} phút${
                e.reason ? ` · ${e.reason}` : ''
              }</div>
                </div>
                <button class="ai-apply-est px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700" data-id="${
                  e.id
                }" data-mins="${mins}">Áp dụng</button>
              </li>`;
            })
            .join('') || '<li class="text-slate-500">Không có gợi ý</li>';
        const notes = json.notes
          ? `<div class="mt-3 text-sm text-slate-500">${json.notes}</div>`
          : '';
        const html = `
          <div class="modal-backdrop fixed inset-0"></div>
          <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-lg m-4 z-10 p-6">
            <h3 class="text-lg font-bold mb-3">Ước tính thời lượng</h3>
            <p class="text-xs text-slate-500 mb-2">Lưu ý: tối đa 10 công việc được xử lý mỗi lần.</p>
            <ul class="text-sm">${rows}</ul>
            ${notes}
            <div class="text-right mt-4">
              <button id="modal-close-btn" class="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 mr-2">Đóng</button>
              <button id="ai-apply-all-est" class="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700">Áp dụng tất cả</button>
            </div>
          </div>`;
        this.openModal(html);
        this.modalContainer.querySelectorAll('.ai-apply-est').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-id'));
            const minutes = Number(btn.getAttribute('data-mins'));
            this.applyAIDurationEstimates([{ id, minutes }]);
          });
        });
        const applyAll = this.modalContainer.querySelector('#ai-apply-all-est');
        applyAll.onclick = () => {
          const payload = (json.estimates || [])
            .filter((e) => typeof e.id === 'number' && typeof e.minutes === 'number')
            .map((e) => ({ id: e.id, minutes: Math.max(0, Math.round(e.minutes)) }));
          this.applyAIDurationEstimates(payload);
          this.hideModal();
        };
        return;
      }

      // Fallback: show the parsed JSON pretty
      const fallback = this.parseMarkdown(JSON.stringify(json, null, 2));
      const html = `
        <div class="modal-backdrop fixed inset-0"></div>
        <div class="bg-white ai-result-modal rounded-lg shadow-xl w-full max-w-md m-4 z-10 flex flex-col max-h-[85vh]">
          <div class="p-5 border-b flex-shrink-0"><h3 class="text-lg font-medium flex items-center"><i class="fas fa-robot text-indigo-600 mr-3"></i> Cố vấn AI</h3></div>
          <div class="p-6 text-left text-gray-700 overflow-y-auto prose">${fallback}</div>
          <div class="p-4 bg-slate-50 flex justify-end flex-shrink-0 border-t"><button id="modal-close-btn" class="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">Đóng</button></div>
        </div>`;
      this.openModal(html);
    } catch (err) {
      const msg = (err && err.message) || 'Lỗi không xác định';
      this.showConfirmModal('Lỗi AI', `Không thể tạo gợi ý: ${msg}`, () => {});
    }
  }

  applyAIReorder(orderedIds) {
    // Reorder tasks within current category based on orderedIds sequence
    const others = this.data.tasks.filter((t) => t.categoryId !== this.data.activeCategoryId);
    const current = this.data.tasks.filter((t) => t.categoryId === this.data.activeCategoryId);
    const byId = new Map(current.map((t) => [t.id, t]));
    const ordered = [];
    orderedIds.forEach((id) => {
      const t = byId.get(id);
      if (t) ordered.push(t);
    });
    // append any not mentioned to preserve
    current.forEach((t) => {
      if (!orderedIds.includes(t.id)) ordered.push(t);
    });
    this.data.tasks = [...ordered, ...others];
    this.saveData();
    this.renderTasks();
  }

  applyAIDueSuggestion(list, overrideReminderMinutes = null) {
    let changed = 0;
    list.forEach(({ id, dueDate }) => {
      const idx = this.data.tasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        this.data.tasks[idx].dueDate = dueDate;
        // Apply override reminder if provided; otherwise preserve current if numeric, else set 0
        if (overrideReminderMinutes !== null && !isNaN(overrideReminderMinutes)) {
          this.data.tasks[idx].reminderMinutes = Number(overrideReminderMinutes) || 0;
        } else if (typeof this.data.tasks[idx].reminderMinutes !== 'number') {
          this.data.tasks[idx].reminderMinutes = 0;
        }
        changed++;
      }
    });
    if (changed > 0) {
      this.saveData();
      this.renderAll();
      this.scheduleAllPushNotifications();
    }
  }

  applyAIDurationEstimates(list) {
    let changed = 0;
    list.forEach(({ id, minutes }) => {
      const idx = this.data.tasks.findIndex((t) => t.id === id);
      if (idx !== -1) {
        const mins = Math.max(0, Math.round(Number(minutes) || 0));
        this.data.tasks[idx].estimatedMinutes = mins;
        changed++;
      }
    });
    if (changed > 0) {
      this.saveData();
      this.renderAll();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new TodoApp();
  app.init();
});
