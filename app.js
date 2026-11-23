/**
 * PAISA — Student Smart Expense Tracker
 * Main Application Controller & Dynamic UI Engine
 */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize Local Database (IndexedDB with LocalStorage fallback)
    await window.paisaDB.init();
  } catch (err) {
    console.warn('Database initialization warning:', err);
  }

  class PaisaApp {
    constructor() {
      this.currentMonth = '2026-11';
      this.currentFilter = 'all';
      this.searchQuery = '';
      this.transactions = [];
      this.budgets = {};
      this.smsQueue = [];
      this.settings = {};
      this.editingTxId = null;

      this.init();
    }

    async init() {
      try {
        await this.loadData();
        this.applySavedTheme();
        this.setupEventListeners();
        this.renderAll();
      } catch (err) {
        console.error('Initialization error in PaisaApp:', err);
      }
    }

    async loadData() {
      try {
        this.settings = (await window.paisaDB.getSettings()) || {};
        if (this.settings.currentMonth) {
          this.currentMonth = this.settings.currentMonth;
        }
        this.transactions = (await window.paisaDB.getAllTransactions()) || [];
        this.budgets = (await window.paisaDB.getBudgets()) || {};
        this.smsQueue = (await window.paisaDB.getSMSQueue()) || [];

        // Sync month selector dropdown
        const monthSelect = document.getElementById('month-select');
        if (monthSelect) {
          monthSelect.value = this.currentMonth;
        }
      } catch (err) {
        console.error('Failed to load database records:', err);
      }
    }

    applySavedTheme() {
      try {
        const savedTheme = localStorage.getItem('paisa_theme') || this.settings.theme || 'light';
        const isDark = savedTheme === 'dark';
        
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
          themeToggle.checked = isDark;
        }
        document.body.classList.toggle('dark-theme', isDark);
        if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch (e) {
        console.warn('Error applying theme:', e);
      }
    }

    async toggleTheme() {
      const current = document.body.classList.contains('dark-theme') || (this.settings.theme === 'dark');
      const newTheme = current ? 'light' : 'dark';
      this.settings.theme = newTheme;

      try {
        localStorage.setItem('paisa_theme', newTheme);
        await window.paisaDB.setSetting('theme', newTheme);
      } catch (e) {}

      const themeToggle = document.getElementById('theme-toggle');
      if (themeToggle) {
        themeToggle.checked = (newTheme === 'dark');
      }

      document.body.classList.toggle('dark-theme', newTheme === 'dark');
      if (newTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }

      this.showToast(`Theme switched to ${newTheme} mode`);
    }

    /* =========================================================================
       Event Listeners & UI Binding
       ========================================================================= */

    setupEventListeners() {
      // 1. Theme Toggle Buttons
      const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
      themeToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTheme();
        });
      });

      // 2. Month Selector
      const monthSelect = document.getElementById('month-select');
      if (monthSelect) {
        monthSelect.addEventListener('change', async (e) => {
          this.currentMonth = e.target.value;
          await window.paisaDB.setSetting('currentMonth', this.currentMonth);
          this.renderAll();
          this.showToast(`Switched view to ${this.formatMonthName(this.currentMonth)}`);
        });
      }

      // 3. Reset Data / Restore Data Buttons
      const resetBtns = document.querySelectorAll('.reset-btn');
      resetBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const monthTxs = this.getMonthTransactions();
          if (monthTxs.length > 0) {
            if (confirm('Are you sure you want to reset your ledger to ₹0? This clears your transaction history.')) {
              await window.paisaDB.resetToZero();
              await this.loadData();
              this.renderAll();
              this.showToast('Ledger reset to ₹0. All transactions cleared.', 'danger');
            }
          } else {
            await window.paisaDB.restoreSampleData();
            await this.loadData();
            this.renderAll();
            this.showToast('Sample student data restored successfully!');
          }
        });
      });

      // 4. Manual Transaction Form
      const manualForm = document.getElementById('manual-tx-form') || document.querySelector('.manual-form');
      if (manualForm) {
        manualForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.handleManualSubmit(manualForm);
        });

        // Set default date to today
        const dateInput = manualForm.querySelector('[name="tx_date"]');
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
      }

      const addBtn = document.getElementById('btn-add-tx');
      if (addBtn && manualForm) {
        addBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.handleManualSubmit(manualForm);
        });
      }

      // 5. Transaction Filter Tabs
      const filterTabs = document.querySelectorAll('.filter-tab');
      filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          e.preventDefault();
          const forId = tab.getAttribute('for');
          if (forId === 'filter-all') this.currentFilter = 'all';
          else if (forId === 'filter-expense') this.currentFilter = 'expense';
          else if (forId === 'filter-income') this.currentFilter = 'income';
          else if (forId === 'filter-sms') this.currentFilter = 'sms';

          filterTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.renderTransactionsTable();
        });
      });

      // 6. Transaction Search Input
      const searchInput = document.getElementById('tx-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.renderTransactionsTable();
        });
      }

      // 7. Mobile Sidebar Drawer Toggle & Backdrop
      const sidebarToggle = document.getElementById('sidebar-toggle');
      const closeMenu = document.querySelector('.close-menu');
      if (closeMenu && sidebarToggle) {
        closeMenu.addEventListener('click', () => {
          sidebarToggle.checked = false;
        });
      }

      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          if (sidebarToggle) sidebarToggle.checked = false;
          navLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
        });
      });

      // 8. SMS Custom Parser Input & Simulator
      const parseCustomBtn = document.getElementById('btn-parse-sms');
      const customSmsText = document.getElementById('custom-sms-text');
      if (parseCustomBtn && customSmsText) {
        parseCustomBtn.addEventListener('click', () => {
          this.handleCustomSMS(customSmsText.value);
          customSmsText.value = '';
        });
      }

      // Simulator Preset Chips
      const simChips = document.querySelectorAll('.sim-chip-btn');
      simChips.forEach(chip => {
        chip.addEventListener('click', () => {
          const text = chip.getAttribute('data-sms');
          const sender = chip.getAttribute('data-sender') || 'BANK-SMS';
          this.simulateIncomingSMS(text, sender);
        });
      });

      // 9. Settings Switches
      this.bindSettingSwitch('toggle-auto-categorize', 'autoCategorize');
      this.bindSettingSwitch('toggle-high-value', 'flagHighValue');
      this.bindSettingSwitch('toggle-budget-alert', 'budgetAlertThreshold', (val) => val ? 80 : 100);

      // Export / Import Data
      const exportBtn = document.getElementById('btn-export-data');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportDatabase());
      }

      const importFileInput = document.getElementById('import-file-input');
      if (importFileInput) {
        importFileInput.addEventListener('change', (e) => this.importDatabase(e));
      }
    }

    bindSettingSwitch(id, settingKey, transform = (v) => v) {
      const el = document.getElementById(id);
      if (el) {
        el.checked = Boolean(this.settings[settingKey]);
        el.addEventListener('change', async (e) => {
          const val = transform(e.target.checked);
          this.settings[settingKey] = val;
          await window.paisaDB.setSetting(settingKey, val);
          this.showToast('Setting updated');
        });
      }
    }

    /* =========================================================================
       Data Filtering Helpers
       ========================================================================= */

    getMonthTransactions(month = this.currentMonth) {
      return (this.transactions || []).filter(tx => {
        if (tx.month) return tx.month === month;
        if (tx.date) return tx.date.startsWith(month);
        return false;
      });
    }

    formatCurrency(num) {
      return '₹' + Math.round(Number(num) || 0).toLocaleString('en-IN');
    }

    formatMonthName(monthStr) {
      if (!monthStr || !monthStr.includes('-')) return 'Current Month';
      const [year, month] = monthStr.split('-');
      const d = new Date(parseInt(year), parseInt(month) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    /* =========================================================================
       Rendering Core Engine
       ========================================================================= */

    renderAll() {
      try {
        this.renderDashboard();
        this.renderSMSSection();
        this.renderCategories();
        this.renderTransactionsTable();
        this.renderBudgetSection();
        this.renderInsights();
        this.renderSettingsValues();
        this.updateResetButtonState();
      } catch (err) {
        console.error('Error during renderAll():', err);
      }
    }

    updateResetButtonState() {
      const hasData = (this.transactions && this.transactions.length > 0);
      const clearLabels = document.querySelectorAll('.reset-label-clear');
      const restoreLabels = document.querySelectorAll('.reset-label-restore');
      clearLabels.forEach(el => el.style.display = hasData ? 'inline' : 'none');
      restoreLabels.forEach(el => el.style.display = hasData ? 'none' : 'inline');
    }

    /**
     * A. Dashboard KPIs, Weekly Outflow & Savings Goal
     */
    renderDashboard() {
      const monthTxs = this.getMonthTransactions();
      const income = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const balance = income - expenses;
      const monthlyCap = Number(this.settings.monthlyCap) || 9000;
      const remainingBudget = Math.max(0, monthlyCap - expenses);
      const retention = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

      // Update KPI 1: Total Balance
      this.updateElementText('.kpi-card:nth-child(1) .kpi-value', this.formatCurrency(balance));
      this.updateElementText(
        '.kpi-card:nth-child(1) .kpi-meta',
        income > 0 ? `${retention}% of monthly income retained` : '0% of monthly income retained'
      );

      // Update KPI 2: Total Income
      this.updateElementText('.kpi-card:nth-child(2) .kpi-value', this.formatCurrency(income));
      const incomeCount = monthTxs.filter(t => t.type === 'income').length;
      this.updateElementText(
        '.kpi-card:nth-child(2) .kpi-meta',
        incomeCount > 0 ? `${incomeCount} income entries recorded` : '0 income entries recorded'
      );

      // Update KPI 3: Total Expenses
      this.updateElementText('.kpi-card:nth-child(3) .kpi-value', this.formatCurrency(expenses));
      const expCount = monthTxs.filter(t => t.type === 'expense').length;
      this.updateElementText(
        '.kpi-card:nth-child(3) .kpi-meta',
        `${expCount} transactions in ${this.formatMonthName(this.currentMonth)}`
      );

      // Update KPI 4: Remaining Budget
      this.updateElementText('.kpi-card:nth-child(4) .kpi-value', this.formatCurrency(remainingBudget));
      this.updateElementText(
        '.kpi-card:nth-child(4) .kpi-meta',
        `Out of ${this.formatCurrency(monthlyCap)} spending cap`
      );

      // Weekly Spending Overview
      this.renderWeeklyBreakdown(monthTxs, expenses);

      // Savings Overview
      this.renderSavingsOverview(balance);

      // Recent Activity Compact Feed
      this.renderRecentActivity(monthTxs);

      // Top Spending Categories Compact List
      this.renderTopCategoriesList(monthTxs, expenses);
    }

    renderWeeklyBreakdown(monthTxs, totalExpenses) {
      const weeks = [
        { label: 'Week 1 (01–07)', sum: 0 },
        { label: 'Week 2 (08–14)', sum: 0 },
        { label: 'Week 3 (15–21)', sum: 0 },
        { label: 'Week 4 (22–End)', sum: 0 }
      ];

      monthTxs.filter(t => t.type === 'expense').forEach(t => {
        const day = parseInt((t.date || '').split('-')[2]) || 1;
        const amt = Number(t.amount) || 0;
        if (day <= 7) weeks[0].sum += amt;
        else if (day <= 14) weeks[1].sum += amt;
        else if (day <= 21) weeks[2].sum += amt;
        else weeks[3].sum += amt;
      });

      const maxWeekSum = Math.max(...weeks.map(w => w.sum), 1);
      const weeklyContainer = document.querySelector('.weekly-bars');
      if (weeklyContainer) {
        weeklyContainer.innerHTML = weeks.map(w => {
          const pct = totalExpenses > 0 ? Math.min(100, Math.round((w.sum / maxWeekSum) * 100)) : 0;
          return `
            <div class="week-row">
              <span class="week-label">${w.label}</span>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${pct}%;"></div>
              </div>
              <span class="week-amount">${this.formatCurrency(w.sum)}</span>
            </div>
          `;
        }).join('');
      }

      // Update Spending Badge in Weekly Card Header
      const weeklyCard = document.getElementById('weekly-spending-card') || document.querySelector('.weekly-bars')?.closest('.card');
      if (weeklyCard) {
        const badge = weeklyCard.querySelector('.badge');
        if (badge) badge.textContent = `${this.formatCurrency(totalExpenses)} Spent`;
      }
    }

    renderSavingsOverview(surplus) {
      const target = Number(this.settings.monthlySavingsTarget) || 3000;
      const semesterTotal = 16800 + Math.max(0, surplus);
      const progressPct = target > 0 ? Math.min(200, Math.round((surplus / target) * 100)) : 0;

      const savingsCard = document.getElementById('savings-overview-card') || document.querySelector('.savings-summary')?.closest('.card');
      if (savingsCard) {
        const badge = savingsCard.querySelector('.badge');
        if (badge) {
          if (surplus >= target) {
            badge.className = 'badge badge-income';
            badge.textContent = 'On Track';
          } else if (surplus > 0) {
            badge.className = 'badge badge-olive';
            badge.textContent = 'In Progress';
          } else {
            badge.className = 'badge badge-expense';
            badge.textContent = 'Under Target';
          }
        }

        const meterLabels = savingsCard.querySelector('.meter-labels span:last-child');
        if (meterLabels) {
          meterLabels.textContent = `${progressPct}% of ${this.formatCurrency(target)} goal`;
        }

        const meterFill = savingsCard.querySelector('.progress-fill');
        if (meterFill) {
          meterFill.style.width = `${Math.min(100, progressPct)}%`;
        }

        const helperNote = savingsCard.querySelector('.helper-note');
        if (helperNote) {
          if (surplus >= target) {
            helperNote.textContent = `Great job! You are ${this.formatCurrency(surplus - target)} ahead of your monthly savings target.`;
          } else if (surplus > 0) {
            helperNote.textContent = `You have saved ${this.formatCurrency(surplus)}, needing ${this.formatCurrency(target - surplus)} more to hit goal.`;
          } else {
            helperNote.textContent = 'Expenses currently equal or exceed income. Add income or reduce discretionary spend.';
          }
        }
      }

      // Savings Figures
      this.updateElementText('.savings-figures div:nth-child(1) .stat-medium-value', this.formatCurrency(surplus));
      this.updateElementText('.savings-figures div:nth-child(2) .stat-medium-value', this.formatCurrency(target));
      this.updateElementText('.savings-figures div:nth-child(3) .stat-medium-value', this.formatCurrency(semesterTotal));
    }

    renderRecentActivity(monthTxs) {
      const listEl = document.querySelector('.compact-list.sample-block') || document.querySelector('.compact-list');
      if (!listEl) return;

      const recent = [...monthTxs].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 5);
      if (recent.length === 0) {
        listEl.innerHTML = '<li class="compact-item"><p class="empty-state">No recent activity recorded.</p></li>';
        return;
      }

      listEl.innerHTML = recent.map(tx => {
        const isIncome = tx.type === 'income';
        const amtClass = isIncome ? 'amount-income' : 'amount-expense';
        const prefix = isIncome ? '+' : '-';
        const tagClass = tx.source === 'manual' ? 'source-tag source-manual' : 'source-tag';
        const tagText = tx.source === 'manual' ? 'Manual' : 'Auto SMS';

        return `
          <li class="compact-item">
            <div>
              <p class="item-title">${this.escapeHTML(tx.name)} <span class="${tagClass}">${tagText}</span></p>
              <p class="item-sub">${this.formatDate(tx.date)} &middot; ${this.escapeHTML(tx.category)}</p>
            </div>
            <span class="${amtClass}">${prefix}${this.formatCurrency(tx.amount)}</span>
          </li>
        `;
      }).join('');
    }

    renderTopCategoriesList(monthTxs, totalExpenses) {
      const catList = document.getElementById('top-categories-list') || document.querySelector('#top-categories-card .compact-list');
      if (!catList) return;

      const catTotals = {};
      monthTxs.filter(t => t.type === 'expense').forEach(t => {
        catTotals[t.category] = (catTotals[t.category] || 0) + (Number(t.amount) || 0);
      });

      const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

      if (sorted.length === 0) {
        catList.innerHTML = '<li class="compact-category"><p class="empty-state">No expense categories yet.</p></li>';
        return;
      }

      catList.innerHTML = sorted.map(([cat, amount]) => {
        const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
        return `
          <li class="compact-category">
            <div class="cat-top">
              <span>${this.escapeHTML(cat)}</span>
              <span>${this.formatCurrency(amount)} (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          </li>
        `;
      }).join('');
    }

    /**
     * B. Automatic Transaction Detection (SMS Engine)
     */
    renderSMSSection() {
      const monthTxs = this.getMonthTransactions();
      const autoCount = monthTxs.filter(t => t.source === 'sms').length;
      const manualCount = monthTxs.filter(t => t.source === 'manual').length;
      const lastTx = [...monthTxs].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0];

      // Update Integration Banner Metrics
      this.updateElementText(
        '.status-metric:nth-child(2) .status-value',
        lastTx ? `${this.formatDate(lastTx.date)} &middot; ${this.escapeHTML(lastTx.name)} (${this.formatCurrency(lastTx.amount)})` : 'None (₹0)'
      );
      this.updateElementText(
        '.status-metric:nth-child(3) .status-value',
        `${autoCount} Auto-Detected / ${manualCount} Manual`
      );

      // Render SMS Queue Cards
      const container = document.querySelector('.sms-list');
      if (!container) return;

      if (!this.smsQueue || this.smsQueue.length === 0) {
        container.innerHTML = '<div class="card empty-block"><p class="empty-state">No bank SMS messages in queue. Click any simulator preset button above or paste your SMS to test live extraction!</p></div>';
        return;
      }

      container.innerHTML = this.smsQueue.map(sms => {
        const isVerified = sms.status === 'verified';
        const isIncome = sms.type === 'income';
        const cardClass = isVerified ? 'sms-card sms-verified' : 'sms-card sms-pending';

        return `
          <article class="card ${cardClass}" data-sms-id="${sms.id}">
            <div class="sms-top">
              <div>
                <span class="sms-sender">${this.escapeHTML(sms.sender || 'BANK-SMS')} &middot; Bank Notification</span>
                <blockquote class="sms-raw">"${this.escapeHTML(sms.rawText || '')}"</blockquote>
              </div>
              <div class="verify-control">
                <button type="button" class="btn btn-sm ${isVerified ? 'btn-secondary' : 'btn-primary'} btn-toggle-verify" data-sms-id="${sms.id}">
                  ${isVerified ? '✓ Verified & Logged' : 'Confirm Entry'}
                </button>
                <button type="button" class="btn-icon btn-icon-danger btn-delete-sms" data-sms-id="${sms.id}" title="Dismiss SMS">&times;</button>
              </div>
            </div>

            <dl class="extracted-grid">
              <div class="extracted-field">
                <dt>Amount</dt>
                <dd class="mono-num">${this.formatCurrency(sms.amount)}</dd>
              </div>
              <div class="extracted-field">
                <dt>Type</dt>
                <dd><span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">${isIncome ? 'Income' : 'Expense'}</span></dd>
              </div>
              <div class="extracted-field">
                <dt>${isIncome ? 'Source' : 'Merchant'}</dt>
                <dd>${this.escapeHTML(sms.merchant || 'Unknown')}</dd>
              </div>
              <div class="extracted-field">
                <dt>Category</dt>
                <dd>${this.escapeHTML(sms.category || 'Other')}</dd>
              </div>
              <div class="extracted-field">
                <dt>Date</dt>
                <dd class="mono-num">${sms.date || 'Today'}</dd>
              </div>
            </dl>
          </article>
        `;
      }).join('');

      // Bind verify & delete buttons on SMS cards
      container.querySelectorAll('.btn-toggle-verify').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = btn.getAttribute('data-sms-id');
          this.toggleSMSVerification(id);
        });
      });

      container.querySelectorAll('.btn-delete-sms').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = btn.getAttribute('data-sms-id');
          this.dismissSMS(id);
        });
      });
    }

    async toggleSMSVerification(smsId) {
      const sms = this.smsQueue.find(s => s.id === smsId);
      if (!sms) return;

      if (sms.status === 'verified') {
        sms.status = 'pending';
        // find and remove linked transaction
        const existingTx = this.transactions.find(t => t.rawSms === sms.rawText);
        if (existingTx) {
          await window.paisaDB.deleteTransaction(existingTx.id);
        }
        await window.paisaDB.updateSMS(sms);
        await this.loadData();
        this.renderAll();
        this.showToast('SMS status reverted to pending confirmation');
      } else {
        sms.status = 'verified';
        await window.paisaDB.updateSMS(sms);

        // Add confirmed transaction to ledger
        const newTx = {
          date: sms.date || new Date().toISOString().split('T')[0],
          name: sms.merchant || 'SMS Transaction',
          category: sms.category || 'Other',
          type: sms.type || 'expense',
          amount: Number(sms.amount) || 0,
          method: sms.method || 'UPI',
          source: 'sms',
          rawSms: sms.rawText,
          sender: sms.sender,
          verified: true
        };
        await window.paisaDB.addTransaction(newTx);
        await this.loadData();
        this.renderAll();
        this.showToast(`Verified and logged ${this.formatCurrency(newTx.amount)} to ledger!`);
      }
    }

    async dismissSMS(smsId) {
      await window.paisaDB.deleteSMS(smsId);
      await this.loadData();
      this.renderSMSSection();
      this.showToast('SMS dismissed');
    }

    async simulateIncomingSMS(text, sender = 'VK-HDFCBK') {
      try {
        if (!window.SMSParser) {
          this.showToast('SMS parser not available', 'danger');
          return;
        }
        const parsed = window.SMSParser.parse(text, sender);
        parsed.status = 'pending';
        await window.paisaDB.addSMS(parsed);
        await this.loadData();
        this.renderSMSSection();
        this.showToast(`New SMS detected: ${parsed.merchant} (${this.formatCurrency(parsed.amount)})`);

        const el = document.getElementById('automatic-tracking');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('Error simulating SMS:', err);
        this.showToast('Failed to parse SMS message', 'danger');
      }
    }

    async handleCustomSMS(text) {
      if (!text || !text.trim()) {
        this.showToast('Please paste a bank SMS first', 'danger');
        return;
      }
      await this.simulateIncomingSMS(text.trim(), 'CUSTOM-SMS');
    }

    /**
     * C. Expense Categories Breakdown (All 10 student categories)
     */
    renderCategories() {
      const monthTxs = this.getMonthTransactions();
      const expenses = monthTxs.filter(t => t.type === 'expense');
      const totalExpenses = expenses.reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const standardCategories = [
        'Accommodation',
        'Food & Dining',
        'Groceries',
        'Education',
        'Transportation',
        'Bills & Recharge',
        'Shopping',
        'Entertainment',
        'Healthcare',
        'Other'
      ];

      const catCounts = {};
      const catTotals = {};

      standardCategories.forEach(c => {
        catTotals[c] = 0;
        catCounts[c] = 0;
      });

      expenses.forEach(t => {
        const c = t.category || 'Other';
        catTotals[c] = (catTotals[c] || 0) + (Number(t.amount) || 0);
        catCounts[c] = (catCounts[c] || 0) + 1;
      });

      this.updateElementText(
        '#categories .section-subtitle',
        `Automated classification across 10 student spending categories (Total: ${this.formatCurrency(totalExpenses)})`
      );

      const grid = document.querySelector('.category-grid');
      if (!grid) return;

      const categoryCards = Object.entries(catTotals).map(([cat, amount]) => {
        const pct = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
        const count = catCounts[cat] || 0;
        const countLabel = count === 1 ? '1 transaction' : `${count} transactions`;

        return `
          <article class="card category-card">
            <div class="cat-card-top">
              <h3 class="cat-name">${this.escapeHTML(cat)}</h3>
              <span class="cat-percent">${pct}%</span>
            </div>
            <p class="cat-amount">${this.formatCurrency(amount)}</p>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
            <p class="cat-count">${countLabel}</p>
          </article>
        `;
      }).join('');

      grid.innerHTML = categoryCards;
    }

    /**
     * D. Transaction History Ledger Table
     */
    renderTransactionsTable() {
      const monthTxs = this.getMonthTransactions();
      let filtered = [...monthTxs];

      // Filter by Tab
      if (this.currentFilter === 'expense') {
        filtered = filtered.filter(t => t.type === 'expense');
      } else if (this.currentFilter === 'income') {
        filtered = filtered.filter(t => t.type === 'income');
      } else if (this.currentFilter === 'sms') {
        filtered = filtered.filter(t => t.source === 'sms');
      }

      // Filter by Search Query
      if (this.searchQuery) {
        filtered = filtered.filter(t => {
          return (t.name || '').toLowerCase().includes(this.searchQuery) ||
                 (t.category || '').toLowerCase().includes(this.searchQuery) ||
                 (t.method || '').toLowerCase().includes(this.searchQuery);
        });
      }

      filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      // Update Tab Counter Labels
      const allCount = monthTxs.length;
      const expCount = monthTxs.filter(t => t.type === 'expense').length;
      const incCount = monthTxs.filter(t => t.type === 'income').length;
      const smsCount = monthTxs.filter(t => t.source === 'sms').length;

      this.updateElementText('.filter-tab[for="filter-all"]', `All (${allCount})`);
      this.updateElementText('.filter-tab[for="filter-expense"]', `Expenses (${expCount})`);
      this.updateElementText('.filter-tab[for="filter-income"]', `Income (${incCount})`);
      this.updateElementText('.filter-tab[for="filter-sms"]', `Auto SMS (${smsCount})`);

      // Update Table Ledger Summary Bar
      const totalCredits = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const totalDebits = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

      const periodEl = document.querySelector('.table-ledger-bar .ledger-summary-item strong');
      if (periodEl) periodEl.textContent = this.formatMonthName(this.currentMonth);

      this.updateElementText('.ledger-totals .ledger-summary-item:nth-child(1) strong', `+${this.formatCurrency(totalCredits)}`);
      this.updateElementText('.ledger-totals .ledger-summary-item:nth-child(2) strong', `-${this.formatCurrency(totalDebits)}`);

      // Render Table Body
      const tbody = document.querySelector('.tx-table tbody');
      if (!tbody) return;

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr class="empty-table-row">
            <td colspan="7" class="empty-table-cell">
              No transactions match your current filter or period.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = filtered.map(tx => {
        const isIncome = tx.type === 'income';
        const rowClass = isIncome ? 'row-income' : '';
        const amtClass = isIncome ? 'amount-income' : 'amount-expense';
        const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
        const prefix = isIncome ? '+' : '-';
        const tagClass = tx.source === 'manual' ? 'source-tag source-manual' : 'source-tag';
        const tagText = tx.source === 'manual' ? 'Manual' : 'Auto SMS';

        return `
          <tr class="${rowClass}" data-id="${tx.id}" data-type="${tx.type}" data-source="${tx.source || 'manual'}">
            <td class="mono-num tx-date">${this.formatDate(tx.date)}</td>
            <td>
              <div class="tx-merchant-cell">
                <span class="tx-merchant">${this.escapeHTML(tx.name)}</span>
                <span class="${tagClass}">${tagText}</span>
              </div>
            </td>
            <td><span class="cat-pill">${this.escapeHTML(tx.category)}</span></td>
            <td class="tx-method">${this.escapeHTML(tx.method || 'UPI')}</td>
            <td><span class="badge ${badgeClass}">${isIncome ? 'Income' : 'Expense'}</span></td>
            <td class="col-right ${amtClass}">${prefix}${this.formatCurrency(tx.amount)}</td>
            <td class="tx-actions-cell">
              <button type="button" class="btn-icon btn-edit-tx" data-id="${tx.id}" title="Edit Transaction">✎</button>
              <button type="button" class="btn-icon btn-icon-danger btn-delete-tx" data-id="${tx.id}" title="Delete Transaction">🗑</button>
            </td>
          </tr>
        `;
      }).join('');

      // Bind row actions
      tbody.querySelectorAll('.btn-edit-tx').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const id = btn.getAttribute('data-id');
          this.openEditModal(id);
        });
      });

      tbody.querySelectorAll('.btn-delete-tx').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const id = btn.getAttribute('data-id');
          if (confirm('Delete this transaction?')) {
            await window.paisaDB.deleteTransaction(id);
            await this.loadData();
            this.renderAll();
            this.showToast('Transaction deleted');
          }
        });
      });
    }

    /**
     * E. Manual Transaction Submission
     */
    async handleManualSubmit(form) {
      if (!form) return;
      
      const nameInput = form.querySelector('[name="tx_name"]');
      const amountInput = form.querySelector('[name="tx_amount"]');
      const typeInput = form.querySelector('[name="tx_type"]');
      const categoryInput = form.querySelector('[name="tx_category"]');
      const dateInput = form.querySelector('[name="tx_date"]');
      const methodInput = form.querySelector('[name="tx_method"]');

      const name = nameInput ? nameInput.value.trim() : '';
      const amount = amountInput ? parseFloat(amountInput.value) : 0;
      const type = typeInput ? typeInput.value : 'expense';
      const category = categoryInput ? categoryInput.value : 'Other';
      const date = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];
      const method = methodInput ? methodInput.value : 'Cash';

      if (!name || isNaN(amount) || amount <= 0) {
        this.showToast('Please provide a valid transaction name and amount', 'danger');
        return;
      }

      const tx = {
        name,
        amount,
        type,
        category,
        date,
        method,
        source: 'manual',
        verified: true
      };

      try {
        await window.paisaDB.addTransaction(tx);
        await this.loadData();
        
        // Reset form fields
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
        
        this.renderAll();
        this.showToast(`Saved transaction: ${name} (${this.formatCurrency(amount)})`);

        // Smooth scroll to ledger
        const txSection = document.getElementById('transactions');
        if (txSection) txSection.scrollIntoView({ behavior: 'smooth' });
      } catch (err) {
        console.error('Failed to save manual transaction:', err);
        this.showToast('Error saving transaction to database', 'danger');
      }
    }

    /**
     * F. Monthly Budget Overview & Category Budgets
     */
    renderBudgetSection() {
      const monthTxs = this.getMonthTransactions();
      const totalSpent = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const monthlyCap = Number(this.settings.monthlyCap) || 9000;
      const remaining = Math.max(0, monthlyCap - totalSpent);
      const overallUtilPct = monthlyCap > 0 ? ((totalSpent / monthlyCap) * 100).toFixed(1) : 0;

      // Overview Card Numbers
      this.updateElementText('.budget-stats-row div:nth-child(1) .stat-medium-value', this.formatCurrency(monthlyCap));
      this.updateElementText('.budget-stats-row div:nth-child(2) .stat-medium-value', this.formatCurrency(totalSpent));
      this.updateElementText('.budget-stats-row div:nth-child(3) .stat-medium-value', this.formatCurrency(remaining));

      // Overall Progress Meter
      const budgetCard = document.querySelector('.budget-overview-card');
      if (budgetCard) {
        const meterLabelLeft = budgetCard.querySelector('.meter-labels span:first-child');
        if (meterLabelLeft) meterLabelLeft.textContent = `Overall Utilization (${overallUtilPct}%)`;

        const meterLabelRight = budgetCard.querySelector('.meter-labels span:last-child');
        if (meterLabelRight) meterLabelRight.textContent = `${this.formatCurrency(remaining)} remaining`;

        const meterFill = budgetCard.querySelector('.progress-track .progress-fill');
        if (meterFill) {
          meterFill.style.width = `${Math.min(100, overallUtilPct)}%`;
          if (overallUtilPct > 100) {
            meterFill.style.backgroundColor = 'var(--expense-accent)';
          } else if (overallUtilPct > (this.settings.budgetAlertThreshold || 80)) {
            meterFill.style.backgroundColor = '#D4A373';
          } else {
            meterFill.style.backgroundColor = 'var(--olive-primary)';
          }
        }
      }

      // Category-wise Budget Allocation List
      const budgetList = document.querySelector('.budget-list');
      if (!budgetList) return;

      const catExpenses = {};
      monthTxs.filter(t => t.type === 'expense').forEach(t => {
        catExpenses[t.category] = (catExpenses[t.category] || 0) + (Number(t.amount) || 0);
      });

      budgetList.innerHTML = Object.entries(this.budgets || {}).map(([cat, cap]) => {
        const spent = catExpenses[cat] || 0;
        const pct = cap > 0 ? ((spent / cap) * 100).toFixed(1) : 0;
        const isOver = spent > cap;
        const rowClass = isOver ? 'budget-row budget-over-limit' : 'budget-row';

        return `
          <div class="${rowClass}">
            <div class="budget-row-info">
              <span class="budget-cat">${this.escapeHTML(cat)}</span>
              <span class="budget-nums">${this.formatCurrency(spent)} / ${this.formatCurrency(cap)} (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${isOver ? 'progress-expense' : ''}" style="width: ${Math.min(100, pct)}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    /**
     * G. Spending Insights & Analytical Comparison
     */
    renderInsights() {
      const monthTxs = this.getMonthTransactions();
      const currentExpenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const currentIncome = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const surplus = currentIncome - currentExpenses;

      // Month-over-Month Comparison (vs Oct 2026 or past data)
      const octTxs = this.transactions.filter(t => (t.month === '2026-10' || (t.date && t.date.startsWith('2026-10'))));
      const prevExpenses = octTxs.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0) || 8130;
      const delta = currentExpenses - prevExpenses;
      const pctChange = prevExpenses > 0 ? (((currentExpenses - prevExpenses) / prevExpenses) * 100).toFixed(1) : 0;

      const momCard = document.getElementById('mom-comparison-card') || document.querySelector('.comparison-bars')?.closest('.card');
      if (momCard) {
        const momBadge = momCard.querySelector('.badge');
        if (momBadge) {
          if (delta <= 0) {
            momBadge.className = 'badge badge-income';
            momBadge.textContent = `${Math.abs(pctChange)}% Lower Spend`;
          } else {
            momBadge.className = 'badge badge-expense';
            momBadge.textContent = `+${pctChange}% Higher Spend`;
          }
        }
      }

      this.updateElementText('.comp-row:nth-child(1) .comp-meta .mono-num strong', this.formatCurrency(prevExpenses));
      this.updateElementText('.comp-row:nth-child(2) .comp-meta .mono-num strong', this.formatCurrency(currentExpenses));

      const maxExp = Math.max(prevExpenses, currentExpenses, 1);
      const prevBar = document.querySelector('.comp-row:nth-child(1) .progress-fill');
      const currBar = document.querySelector('.comp-row:nth-child(2) .progress-fill');
      if (prevBar) prevBar.style.width = `${Math.min(100, Math.round((prevExpenses / maxExp) * 100))}%`;
      if (currBar) currBar.style.width = `${Math.min(100, Math.round((currentExpenses / maxExp) * 100))}%`;

      this.updateElementText(
        '#mom-comparison-card .insight-footnote span:nth-child(1) strong',
        delta <= 0 ? `-${this.formatCurrency(Math.abs(delta))}` : `+${this.formatCurrency(delta)}`
      );
      this.updateElementText(
        '#mom-comparison-card .insight-footnote span:nth-child(2) strong',
        delta <= 0 ? `+${this.formatCurrency(Math.abs(delta))}` : `-${this.formatCurrency(delta)}`
      );

      // Daily Expenditure Pace
      const daysElapsed = 17; // November active day
      const daysRemaining = 13;
      const avgDaily = daysElapsed > 0 ? Math.round(currentExpenses / daysElapsed) : 0;
      const targetDaily = Math.round((Number(this.settings.monthlyCap) || 9000) / 30);
      const remainingCap = Math.max(0, (Number(this.settings.monthlyCap) || 9000) - currentExpenses);
      const safeDailyLimit = daysRemaining > 0 ? Math.round(remainingCap / daysRemaining) : 0;

      const upiTxs = monthTxs.filter(t => t.type === 'expense' && (t.method === 'UPI' || t.source === 'sms'));
      const upiSum = upiTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const upiPct = currentExpenses > 0 ? ((upiSum / currentExpenses) * 100).toFixed(1) : 0;

      const paceCard = document.getElementById('daily-pace-card') || document.querySelector('.pace-metrics')?.closest('.card');
      if (paceCard) {
        const paceBadge = paceCard.querySelector('.badge');
        if (paceBadge) {
          paceBadge.textContent = `${this.formatCurrency(safeDailyLimit)}/day Safe Limit`;
        }

        const housingSum = monthTxs.filter(t => t.type === 'expense' && t.category === 'Accommodation').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const discretionarySum = Math.max(0, currentExpenses - housingSum);
        const housingPct = currentExpenses > 0 ? ((housingSum / currentExpenses) * 100).toFixed(1) : 0;
        const discPct = currentExpenses > 0 ? ((discretionarySum / currentExpenses) * 100).toFixed(1) : 0;

        const foot1 = paceCard.querySelector('.insight-footnote span:nth-child(1) strong');
        if (foot1) foot1.textContent = `${housingPct}% (${this.formatCurrency(housingSum)})`;

        const foot2 = paceCard.querySelector('.insight-footnote span:nth-child(2) strong');
        if (foot2) foot2.textContent = `${discPct}% (${this.formatCurrency(discretionarySum)})`;
      }

      this.updateElementText('.pace-box:nth-child(1) .stat-medium-value', `${this.formatCurrency(avgDaily)} / day`);
      this.updateElementText('.pace-box:nth-child(2) .stat-medium-value', `${this.formatCurrency(targetDaily)} / day`);
      this.updateElementText('.pace-box:nth-child(3) .stat-medium-value', `${upiPct}%`);
      this.updateElementText('.pace-box:nth-child(3) .kpi-meta', `${this.formatCurrency(upiSum)} via UPI`);

      // 4 Metric Highlights
      const expensesList = monthTxs.filter(t => t.type === 'expense');

      // 1. Highest spending category
      const catTotals = {};
      expensesList.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + (Number(t.amount) || 0); });
      const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0] || ['None', 0];
      const topCatPct = currentExpenses > 0 ? ((topCat[1] / currentExpenses) * 100).toFixed(1) : 0;
      this.updateElementText('.insights-grid-four .insight-card:nth-child(1) .insight-value', `${topCat[0]} &middot; ${this.formatCurrency(topCat[1])}`);
      this.updateElementText('.insights-grid-four .insight-card:nth-child(1) .kpi-meta', `${topCatPct}% of total monthly expenses`);

      // 2. Most expensive transaction
      const mostExp = [...expensesList].sort((a, b) => b.amount - a.amount)[0];
      if (mostExp) {
        this.updateElementText('.insights-grid-four .insight-card:nth-child(2) .insight-value', `${this.formatCurrency(mostExp.amount)} &middot; ${this.escapeHTML(mostExp.name)}`);
        this.updateElementText('.insights-grid-four .insight-card:nth-child(2) .kpi-meta', `Paid via ${mostExp.method || 'UPI'} on ${this.formatDate(mostExp.date)}`);
      } else {
        this.updateElementText('.insights-grid-four .insight-card:nth-child(2) .insight-value', 'None &middot; ₹0');
        this.updateElementText('.insights-grid-four .insight-card:nth-child(2) .kpi-meta', 'No expenses recorded');
      }

      // 3. Amount saved
      const savingsRate = currentIncome > 0 ? ((surplus / currentIncome) * 100).toFixed(1) : 0;
      this.updateElementText('.insights-grid-four .insight-card:nth-child(3) .insight-value', this.formatCurrency(surplus));
      this.updateElementText('.insights-grid-four .insight-card:nth-child(3) .kpi-meta', `${savingsRate}% savings rate (${this.formatCurrency(Math.max(0, surplus - (Number(this.settings.monthlySavingsTarget) || 3000)))} over goal)`);

      // 4. Smallest recurring outflow
      const smallestExp = [...expensesList].sort((a, b) => a.amount - b.amount)[0];
      if (smallestExp) {
        this.updateElementText('.insights-grid-four .insight-card:nth-child(4) .insight-value', `${this.formatCurrency(smallestExp.amount)} &middot; ${this.escapeHTML(smallestExp.name)}`);
        this.updateElementText('.insights-grid-four .insight-card:nth-child(4) .kpi-meta', `${smallestExp.category} via ${smallestExp.method || 'UPI'}`);
      } else {
        this.updateElementText('.insights-grid-four .insight-card:nth-child(4) .insight-value', 'None &middot; ₹0');
        this.updateElementText('.insights-grid-four .insight-card:nth-child(4) .kpi-meta', 'No expenses recorded');
      }
    }

    renderSettingsValues() {
      const cap = Number(this.settings.monthlyCap) || 9000;
      const capBadge = document.getElementById('monthly-cap-badge') || document.querySelector('.setting-row:nth-child(2) .badge');
      if (capBadge) capBadge.textContent = `${this.formatCurrency(cap)} / mo`;

      const acctMask = this.settings.accountMask || 'XX1234';
      this.updateElementText('.account-label', `A/c ${acctMask} Linked`);
    }

    /* =========================================================================
       Edit Modal Dialog
       ========================================================================= */

    openEditModal(txId) {
      const tx = this.transactions.find(t => t.id === txId);
      if (!tx) return;

      this.editingTxId = txId;
      let modal = document.getElementById('edit-tx-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'edit-tx-modal';
        modal.className = 'modal-backdrop';
        modal.innerHTML = `
          <div class="modal-box">
            <div class="modal-header">
              <h3 class="modal-title">Edit Transaction</h3>
              <button type="button" class="modal-close">&times;</button>
            </div>
            <form id="edit-tx-form" onsubmit="return false;">
              <div class="modal-body">
                <div class="form-group mb-md">
                  <label for="edit-tx-name">Transaction Name</label>
                  <input type="text" id="edit-tx-name" required>
                </div>
                <div class="form-group mb-md">
                  <label for="edit-tx-amount">Amount (₹)</label>
                  <input type="number" id="edit-tx-amount" step="0.01" min="1" required>
                </div>
                <div class="form-group mb-md">
                  <label for="edit-tx-type">Type</label>
                  <select id="edit-tx-type">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div class="form-group mb-md">
                  <label for="edit-tx-category">Category</label>
                  <select id="edit-tx-category">
                    <option value="Food & Dining">Food &amp; Dining</option>
                    <option value="Transportation">Transportation</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Education">Education</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Accommodation">Accommodation</option>
                    <option value="Groceries">Groceries</option>
                    <option value="Bills & Recharge">Bills &amp; Recharge</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Other">Other</option>
                    <option value="Income">Income / Allowance</option>
                  </select>
                </div>
                <div class="form-group mb-md">
                  <label for="edit-tx-date">Date</label>
                  <input type="date" id="edit-tx-date" required>
                </div>
                <div class="form-group">
                  <label for="edit-tx-method">Payment Method</label>
                  <select id="edit-tx-method">
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="NEFT">NEFT</option>
                    <option value="IMPS">IMPS</option>
                  </select>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary btn-cancel-modal">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
        modal.querySelector('.btn-cancel-modal').addEventListener('click', () => modal.classList.remove('active'));
        modal.querySelector('#edit-tx-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.saveEditedTransaction();
        });
      }

      // Populate form
      document.getElementById('edit-tx-name').value = tx.name || '';
      document.getElementById('edit-tx-amount').value = tx.amount || '';
      document.getElementById('edit-tx-type').value = tx.type || 'expense';
      document.getElementById('edit-tx-category').value = tx.category || 'Other';
      document.getElementById('edit-tx-date').value = tx.date || '';
      document.getElementById('edit-tx-method').value = tx.method || 'UPI';

      modal.classList.add('active');
    }

    async saveEditedTransaction() {
      if (!this.editingTxId) return;
      const tx = this.transactions.find(t => t.id === this.editingTxId);
      if (!tx) return;

      tx.name = document.getElementById('edit-tx-name').value.trim();
      tx.amount = parseFloat(document.getElementById('edit-tx-amount').value);
      tx.type = document.getElementById('edit-tx-type').value;
      tx.category = document.getElementById('edit-tx-category').value;
      tx.date = document.getElementById('edit-tx-date').value;
      tx.method = document.getElementById('edit-tx-method').value;

      await window.paisaDB.updateTransaction(tx);
      await this.loadData();
      this.renderAll();

      const modal = document.getElementById('edit-tx-modal');
      if (modal) modal.classList.remove('active');
      this.showToast('Transaction updated successfully');
    }

    /* =========================================================================
       Database Backup & Export / Import
       ========================================================================= */

    async exportDatabase() {
      const jsonStr = await window.paisaDB.exportJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `paisa_ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Database exported as JSON backup');
    }

    async importDatabase(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          await window.paisaDB.importJSON(e.target.result);
          await this.loadData();
          this.renderAll();
          this.showToast('Database imported successfully!');
        } catch (err) {
          this.showToast('Failed to parse backup JSON file', 'danger');
        }
      };
      reader.readAsText(file);
    }

    /* =========================================================================
       Helper Utilities
       ========================================================================= */

    updateElementText(selector, text) {
      try {
        const el = document.querySelector(selector);
        if (el) el.innerHTML = text;
      } catch (e) {
        console.warn('Selector error for:', selector, e);
      }
    }

    formatDate(dateStr) {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return dateStr;
    }

    escapeHTML(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    showToast(message, type = 'info') {
      let container = document.querySelector('.toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `toast ${type === 'danger' ? 'toast-danger' : ''}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  }

  // Launch and bind globally
  window.paisaApp = new PaisaApp();
});
