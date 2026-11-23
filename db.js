/**
 * PAISA — Local Database Engine (IndexedDB with LocalStorage Fallback)
 * Provides persistent local database storage for transactions, categories, budgets, and settings.
 */

const DB_NAME = 'PaisaStudentDB';
const DB_VERSION = 1;

// Default categories and monthly budget limits
const DEFAULT_BUDGETS = {
  'Accommodation': 2000,
  'Food & Dining': 2000,
  'Groceries': 1200,
  'Education': 1000,
  'Transportation': 700,
  'Bills & Recharge': 600,
  'Shopping': 600,
  'Entertainment': 400,
  'Healthcare': 300,
  'Other': 200
};

// Default App Settings
const DEFAULT_SETTINGS = {
  monthlyCap: 9000,
  monthlySavingsTarget: 3000,
  accountMask: 'XX1234',
  senderIds: ['HDFCBK', 'SBIINB', 'ICICIB', 'AXISBK'],
  autoCategorize: true,
  flagHighValue: true,
  budgetAlertThreshold: 80,
  theme: 'light',
  currentMonth: '2026-11'
};

// Rich initial seed data for student ledger
const INITIAL_TRANSACTIONS = [
  {
    id: 'tx-1',
    date: '2026-11-17',
    name: 'Zomato',
    category: 'Food & Dining',
    type: 'expense',
    amount: 250,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 250.00 on 17-11-2026 towards UPI payment to ZOMATO.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-2',
    date: '2026-11-16',
    name: 'BMTC Bus',
    category: 'Transportation',
    type: 'expense',
    amount: 80,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 80.00 on 16-11-2026 towards UPI payment to BMTC BUS.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-3',
    date: '2026-11-15',
    name: 'College Canteen',
    category: 'Food & Dining',
    type: 'expense',
    amount: 120,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 120.00 on 15-11-2026 towards UPI payment to CANTEEN.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-4',
    date: '2026-11-12',
    name: 'Mobile Recharge',
    category: 'Bills & Recharge',
    type: 'expense',
    amount: 499,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 499.00 on 12-11-2026 towards UPI payment to JIO RECHARGE.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-5',
    date: '2026-11-10',
    name: 'Amazon Essentials',
    category: 'Shopping',
    type: 'expense',
    amount: 350,
    method: 'Debit Card',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 350.00 on 10-11-2026 towards card payment to AMAZON RETAIL.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-6',
    date: '2026-11-08',
    name: 'Campus Book Depot',
    category: 'Education',
    type: 'expense',
    amount: 850,
    method: 'Cash',
    source: 'manual',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-7',
    date: '2026-11-07',
    name: 'Local Kirana Groceries',
    category: 'Groceries',
    type: 'expense',
    amount: 980,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 980.00 on 07-11-2026 towards UPI payment to APNA MART.',
    sender: 'AD-SBIINB',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-8',
    date: '2026-11-05',
    name: 'Monthly Allowance',
    category: 'Income',
    type: 'income',
    amount: 5000,
    method: 'Bank Transfer',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is credited with Rs. 5000.00 on 05-11-2026 via IMPS transfer from PARENTS AC.',
    sender: 'AD-SBIINB',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-9',
    date: '2026-11-02',
    name: 'Hostel Fees',
    category: 'Accommodation',
    type: 'expense',
    amount: 2000,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 2000.00 on 02-11-2026 towards UPI payment to HOSTEL TRUST.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-10',
    date: '2026-11-01',
    name: 'Part-Time Stipend',
    category: 'Income',
    type: 'income',
    amount: 7000,
    method: 'NEFT',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is credited with Rs. 7000.00 on 01-11-2026 via NEFT from TECH LABS CORP.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-11',
    date: '2026-11-14',
    name: 'Campus Mess Dinner',
    category: 'Food & Dining',
    type: 'expense',
    amount: 350,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 350.00 on 14-11-2026 towards UPI to MESS CATERERS.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-12',
    date: '2026-11-13',
    name: 'Metro Smart Card Recharge',
    category: 'Transportation',
    type: 'expense',
    amount: 200,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 200.00 on 13-11-2026 towards UPI to BMRCL METRO.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-13',
    date: '2026-11-11',
    name: 'Weekend Movie Ticket',
    category: 'Entertainment',
    type: 'expense',
    amount: 280,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 280.00 on 11-11-2026 towards UPI to PVR CINEMAS.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-14',
    date: '2026-11-09',
    name: 'Campus Pharmacy Meds',
    category: 'Healthcare',
    type: 'expense',
    amount: 191,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 191.00 on 09-11-2026 towards UPI to MEDPLUS PHARMACY.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-15',
    date: '2026-11-06',
    name: 'Hostel Laundry',
    category: 'Other',
    type: 'expense',
    amount: 140,
    method: 'Cash',
    source: 'manual',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-16',
    date: '2026-11-04',
    name: 'College Chai & Snacks',
    category: 'Food & Dining',
    type: 'expense',
    amount: 50,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 50.00 on 04-11-2026 towards UPI to TAPRI CHAI.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-17',
    date: '2026-11-03',
    name: 'Auto Rickshaw to Station',
    category: 'Transportation',
    type: 'expense',
    amount: 110,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 110.00 on 03-11-2026 towards UPI to AUTO RIDE.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  {
    id: 'tx-18',
    date: '2026-11-01',
    name: 'Fast Food Dinner',
    category: 'Food & Dining',
    type: 'expense',
    amount: 250,
    method: 'UPI',
    source: 'sms',
    rawSms: 'Your A/c XX1234 is debited with Rs. 250.00 on 01-11-2026 towards UPI to BURGER POINT.',
    sender: 'VK-HDFCBK',
    verified: true,
    month: '2026-11'
  },
  // October previous month sample for MoM insights
  {
    id: 'tx-oct-1',
    date: '2026-10-01',
    name: 'Previous Month Stipend',
    category: 'Income',
    type: 'income',
    amount: 12000,
    method: 'NEFT',
    source: 'sms',
    verified: true,
    month: '2026-10'
  },
  {
    id: 'tx-oct-2',
    date: '2026-10-05',
    name: 'October Hostel Fees',
    category: 'Accommodation',
    type: 'expense',
    amount: 2000,
    method: 'UPI',
    source: 'sms',
    verified: true,
    month: '2026-10'
  },
  {
    id: 'tx-oct-3',
    date: '2026-10-15',
    name: 'October Expenses Combined',
    category: 'Food & Dining',
    type: 'expense',
    amount: 6130,
    method: 'UPI',
    source: 'sms',
    verified: true,
    month: '2026-10'
  }
];

// Initial SMS queue items (detected alerts awaiting verification)
const INITIAL_SMS_QUEUE = [
  {
    id: 'sms-1',
    sender: 'VK-HDFCBK',
    rawText: 'Your A/c XX1234 is debited with Rs. 250.00 on 17-11-2026 towards UPI payment to ZOMATO.',
    amount: 250,
    type: 'expense',
    merchant: 'Zomato',
    category: 'Food & Dining',
    date: '2026-11-17',
    account: 'XX1234',
    status: 'verified', // verified | pending | dismissed
    method: 'UPI'
  },
  {
    id: 'sms-2',
    sender: 'AD-SBIINB',
    rawText: 'Your A/c XX1234 is credited with Rs. 5000.00 on 05-11-2026 via IMPS transfer from PARENTS AC.',
    amount: 5000,
    type: 'income',
    merchant: 'Monthly Allowance',
    category: 'Income',
    date: '2026-11-05',
    account: 'XX1234',
    status: 'verified',
    method: 'Bank Transfer'
  },
  {
    id: 'sms-3',
    sender: 'VK-HDFCBK',
    rawText: 'Your A/c XX1234 is debited with Rs. 80.00 on 16-11-2026 towards UPI payment to BMTC BUS.',
    amount: 80,
    type: 'expense',
    merchant: 'BMTC Bus',
    category: 'Transportation',
    date: '2026-11-16',
    account: 'XX1234',
    status: 'pending',
    method: 'UPI'
  }
];

class PaisaDB {
  constructor() {
    this.db = null;
    this.useLocalStorage = false;
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to localStorage');
        this.useLocalStorage = true;
        this._initLocalStorage();
        return resolve(this);
      }

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          if (!db.objectStoreNames.contains('transactions')) {
            const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
            txStore.createIndex('date', 'date', { unique: false });
            txStore.createIndex('category', 'category', { unique: false });
            txStore.createIndex('type', 'type', { unique: false });
            txStore.createIndex('month', 'month', { unique: false });
          }

          if (!db.objectStoreNames.contains('budgets')) {
            db.createObjectStore('budgets', { keyPath: 'category' });
          }

          if (!db.objectStoreNames.contains('smsQueue')) {
            const smsStore = db.createObjectStore('smsQueue', { keyPath: 'id' });
            smsStore.createIndex('status', 'status', { unique: false });
            smsStore.createIndex('date', 'date', { unique: false });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
          }
        };

        request.onsuccess = async (event) => {
          this.db = event.target.result;
          await this._checkAndSeedData();
          resolve(this);
        };

        request.onerror = (event) => {
          console.warn('IndexedDB error, falling back to localStorage:', event.target.error);
          this.useLocalStorage = true;
          this._initLocalStorage();
          resolve(this);
        };
      } catch (err) {
        console.warn('IndexedDB open exception, falling back to localStorage:', err);
        this.useLocalStorage = true;
        this._initLocalStorage();
        resolve(this);
      }
    });
  }

  _initLocalStorage() {
    if (!localStorage.getItem('paisa_transactions')) {
      localStorage.setItem('paisa_transactions', JSON.stringify(INITIAL_TRANSACTIONS));
    }
    if (!localStorage.getItem('paisa_budgets')) {
      const budgetList = Object.entries(DEFAULT_BUDGETS).map(([category, amount]) => ({ category, amount }));
      localStorage.setItem('paisa_budgets', JSON.stringify(budgetList));
    }
    if (!localStorage.getItem('paisa_smsQueue')) {
      localStorage.setItem('paisa_smsQueue', JSON.stringify(INITIAL_SMS_QUEUE));
    }
    if (!localStorage.getItem('paisa_settings')) {
      const settingList = Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value }));
      localStorage.setItem('paisa_settings', JSON.stringify(settingList));
    }
  }

  async _checkAndSeedData() {
    const txCount = await this._countStore('transactions');
    if (txCount === 0) {
      console.log('Seeding initial student transaction records...');
      for (const tx of INITIAL_TRANSACTIONS) {
        await this._put('transactions', tx);
      }
      for (const [category, amount] of Object.entries(DEFAULT_BUDGETS)) {
        await this._put('budgets', { category, amount });
      }
      for (const sms of INITIAL_SMS_QUEUE) {
        await this._put('smsQueue', sms);
      }
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await this._put('settings', { key, value });
      }
    }
  }

  // Generic IndexedDB Helper: Count
  _countStore(storeName) {
    if (this.useLocalStorage) {
      const data = JSON.parse(localStorage.getItem(`paisa_${storeName}`) || '[]');
      return Promise.resolve(data.length);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Generic IndexedDB Helper: Put
  _put(storeName, item) {
    if (this.useLocalStorage) {
      const key = storeName === 'transactions' || storeName === 'smsQueue' ? 'id' : (storeName === 'budgets' ? 'category' : 'key');
      let data = JSON.parse(localStorage.getItem(`paisa_${storeName}`) || '[]');
      const index = data.findIndex(x => x[key] === item[key]);
      if (index >= 0) {
        data[index] = item;
      } else {
        data.push(item);
      }
      localStorage.setItem(`paisa_${storeName}`, JSON.stringify(data));
      return Promise.resolve(item);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  // Generic IndexedDB Helper: GetAll
  _getAll(storeName) {
    if (this.useLocalStorage) {
      const data = JSON.parse(localStorage.getItem(`paisa_${storeName}`) || '[]');
      return Promise.resolve(data);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // Generic IndexedDB Helper: Delete
  _delete(storeName, key) {
    if (this.useLocalStorage) {
      const keyField = storeName === 'transactions' || storeName === 'smsQueue' ? 'id' : (storeName === 'budgets' ? 'category' : 'key');
      let data = JSON.parse(localStorage.getItem(`paisa_${storeName}`) || '[]');
      data = data.filter(x => x[keyField] !== key);
      localStorage.setItem(`paisa_${storeName}`, JSON.stringify(data));
      return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // Generic IndexedDB Helper: Clear
  _clear(storeName) {
    if (this.useLocalStorage) {
      localStorage.setItem(`paisa_${storeName}`, JSON.stringify([]));
      return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /* =========================================================================
     Transactions API
     ========================================================================= */

  async getAllTransactions(month = null) {
    const all = await this._getAll('transactions');
    if (!month) return all;
    return all.filter(t => t.month === month || (t.date && t.date.startsWith(month)));
  }

  async getTransaction(id) {
    const all = await this._getAll('transactions');
    return all.find(t => t.id === id) || null;
  }

  async addTransaction(tx) {
    if (!tx.id) tx.id = 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    if (!tx.month && tx.date) tx.month = tx.date.substring(0, 7);
    tx.amount = parseFloat(tx.amount) || 0;
    return await this._put('transactions', tx);
  }

  async updateTransaction(tx) {
    if (!tx.month && tx.date) tx.month = tx.date.substring(0, 7);
    tx.amount = parseFloat(tx.amount) || 0;
    return await this._put('transactions', tx);
  }

  async deleteTransaction(id) {
    return await this._delete('transactions', id);
  }

  /* =========================================================================
     Budgets API
     ========================================================================= */

  async getBudgets() {
    const list = await this._getAll('budgets');
    const budgetMap = { ...DEFAULT_BUDGETS };
    list.forEach(b => {
      budgetMap[b.category] = parseFloat(b.amount) || 0;
    });
    return budgetMap;
  }

  async setBudget(category, amount) {
    return await this._put('budgets', { category, amount: parseFloat(amount) || 0 });
  }

  /* =========================================================================
     SMS Queue API
     ========================================================================= */

  async getSMSQueue() {
    return await this._getAll('smsQueue');
  }

  async addSMS(sms) {
    if (!sms.id) sms.id = 'sms-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    if (!sms.status) sms.status = 'pending';
    return await this._put('smsQueue', sms);
  }

  async updateSMS(sms) {
    return await this._put('smsQueue', sms);
  }

  async deleteSMS(id) {
    return await this._delete('smsQueue', id);
  }

  /* =========================================================================
     Settings API
     ========================================================================= */

  async getSettings() {
    const list = await this._getAll('settings');
    const settings = { ...DEFAULT_SETTINGS };
    list.forEach(item => {
      settings[item.key] = item.value;
    });
    return settings;
  }

  async setSetting(key, value) {
    return await this._put('settings', { key, value });
  }

  /* =========================================================================
     Reset, Restore & Backup API
     ========================================================================= */

  async resetToZero() {
    await this._clear('transactions');
    await this._clear('smsQueue');
    // keep default settings but set sample zero indicators
    return true;
  }

  async restoreSampleData() {
    await this.resetToZero();
    for (const tx of INITIAL_TRANSACTIONS) {
      await this._put('transactions', tx);
    }
    for (const [category, amount] of Object.entries(DEFAULT_BUDGETS)) {
      await this._put('budgets', { category, amount });
    }
    for (const sms of INITIAL_SMS_QUEUE) {
      await this._put('smsQueue', sms);
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await this._put('settings', { key, value });
    }
    return true;
  }

  async exportJSON() {
    const transactions = await this._getAll('transactions');
    const budgets = await this._getAll('budgets');
    const smsQueue = await this._getAll('smsQueue');
    const settings = await this._getAll('settings');

    return JSON.stringify({
      version: 1,
      appName: 'PAISA',
      exportDate: new Date().toISOString(),
      transactions,
      budgets,
      smsQueue,
      settings
    }, null, 2);
  }

  async importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (data.transactions && Array.isArray(data.transactions)) {
        await this._clear('transactions');
        for (const tx of data.transactions) {
          await this._put('transactions', tx);
        }
      }
      if (data.budgets && Array.isArray(data.budgets)) {
        await this._clear('budgets');
        for (const b of data.budgets) {
          await this._put('budgets', b);
        }
      }
      if (data.smsQueue && Array.isArray(data.smsQueue)) {
        await this._clear('smsQueue');
        for (const s of data.smsQueue) {
          await this._put('smsQueue', s);
        }
      }
      if (data.settings && Array.isArray(data.settings)) {
        for (const st of data.settings) {
          await this._put('settings', st);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to import JSON data:', err);
      throw err;
    }
  }
}

// Global DB instance
window.paisaDB = new PaisaDB();
