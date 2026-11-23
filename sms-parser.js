/**
 * PAISA — Smart Bank SMS Detection & Parsing Engine
 * Intelligently extracts Amount, Transaction Type, Merchant/Entity, Account, Date, and Category from Indian bank notifications.
 */

const CATEGORY_KEYWORDS = {
  'Food & Dining': ['zomato', 'swiggy', 'canteen', 'mess', 'caterer', 'domino', 'mcdonald', 'kfc', 'burger', 'pizza', 'cafe', 'restaurant', 'tapri', 'chai', 'coffee', 'bakery', 'dhaba', 'tea'],
  'Transportation': ['bmtc', 'metro', 'bmrcl', 'uber', 'ola', 'rapido', 'bus', 'train', 'irctc', 'auto', 'fuel', 'petrol', 'diesel', 'toll', 'fastag', 'transit'],
  'Groceries': ['zepto', 'blinkit', 'instamart', 'kirana', 'mart', 'supermarket', 'grocery', 'reliance', 'dmart', 'more', 'nature basket', 'store', 'provisions'],
  'Education': ['book', 'stationery', 'xerox', 'printout', 'lab', 'udemy', 'coursera', 'college', 'library', 'exam', 'tuition', 'fee', 'course', 'academy'],
  'Shopping': ['amazon', 'flipkart', 'myntra', 'meesho', 'ajio', 'zara', 'h&m', 'clothing', 'retail', 'electronics', 'croma', 'reliance digital'],
  'Entertainment': ['pvr', 'inox', 'cinepolis', 'bookmyshow', 'netflix', 'spotify', 'prime', 'hotstar', 'cinema', 'theatre', 'gaming', 'steam', 'playstation'],
  'Bills & Recharge': ['jio', 'airtel', 'vi', 'recharge', 'electricity', 'bescom', 'broadband', 'wifi', 'water', 'bill', 'dth', 'tata play', 'cylinder', 'gas'],
  'Healthcare': ['medplus', 'apollo', 'pharmacy', 'clinic', 'hospital', 'doctor', 'medicine', 'lab', '1mg', 'pharmeasy', 'dental', 'chemist'],
  'Accommodation': ['hostel', 'rent', 'pg', 'flat', 'maintenance', 'housing', 'room'],
  'Income': ['salary', 'stipend', 'allowance', 'cashback', 'interest', 'parents', 'imps from', 'neft from', 'refund', 'credited from', 'scholarship']
};

class SMSParser {
  /**
   * Parse a raw SMS text string into structured transaction data
   * @param {string} rawText 
   * @param {string} sender 
   * @returns {object} Extracted transaction details
   */
  static parse(rawText, sender = 'BANK-SMS') {
    if (!rawText || typeof rawText !== 'string') {
      throw new Error('Invalid SMS text provided');
    }

    const text = rawText.trim();
    const result = {
      rawText: text,
      sender: sender.toUpperCase(),
      amount: 0,
      type: 'expense',
      merchant: 'Unknown Merchant',
      category: 'Other',
      date: new Date().toISOString().split('T')[0],
      account: 'XX1234',
      method: 'UPI',
      status: 'pending'
    };

    // 1. Detect Type (Debit/Credit)
    const isCredit = /(credited|credit|received|refunded|deposited)/i.test(text);
    const isDebit = /(debited|debit|sent|paid|spent|withdrawn|charged)/i.test(text);

    if (isCredit && !isDebit) {
      result.type = 'income';
      result.category = 'Income';
    } else {
      result.type = 'expense';
    }

    // 2. Extract Amount
    // Matches Rs. 250, Rs.250.00, INR 5,000, Rs 120.50, INR 7000
    const amountRegex = /(?:rs\.?|inr)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;
    const amountMatch = text.match(amountRegex);
    if (amountMatch && amountMatch[1]) {
      const cleanAmt = amountMatch[1].replace(/,/g, '');
      result.amount = parseFloat(cleanAmt);
    }

    // 3. Extract Account Mask
    // Matches A/c XX1234, A/c *1234, Ac ending 1234, Card ending with 1234
    const acctRegex = /(?:a\/c|account|ac|card)\s*(?:no\.?|ending)?\s*([xX*]*\d{3,4})/i;
    const acctMatch = text.match(acctRegex);
    if (acctMatch && acctMatch[1]) {
      result.account = acctMatch[1].toUpperCase();
    }

    // 4. Extract Date
    // Matches 17-11-2026, 17/11/2026, 17-Nov-2026, 2026-11-17
    const dateRegex = /(\d{1,2})[-/](\d{1,2}|[a-zA-Z]{3})[-/](\d{2,4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      try {
        const d = dateMatch[1].padStart(2, '0');
        let m = dateMatch[2];
        const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
        
        // Month conversion if alphabetical
        const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
        if (isNaN(m)) {
          m = months[m.toLowerCase().substring(0, 3)] || '11';
        } else {
          m = m.padStart(2, '0');
        }
        result.date = `${y}-${m}-${d}`;
      } catch (e) {
        // Fallback to today
      }
    }

    // 5. Extract Payment Method
    if (/upi/i.test(text) || /vpa/i.test(text)) {
      result.method = 'UPI';
    } else if (/card/i.test(text) || /pos/i.test(text)) {
      result.method = 'Debit Card';
    } else if (/neft/i.test(text)) {
      result.method = 'NEFT';
    } else if (/imps/i.test(text)) {
      result.method = 'IMPS';
    } else if (/cash/i.test(text) || /atm/i.test(text)) {
      result.method = 'Cash';
    } else {
      result.method = result.type === 'income' ? 'Bank Transfer' : 'UPI';
    }

    // 6. Extract Merchant or Beneficiary
    if (result.type === 'income') {
      const fromMatch = text.match(/(?:from|by)\s+([A-Za-z0-9\s&]+?)(?:\s+on|\.|$)/i);
      if (fromMatch && fromMatch[1]) {
        result.merchant = this._cleanMerchantName(fromMatch[1]);
      } else {
        result.merchant = 'Allowance / Transfer';
      }
    } else {
      const toMatch = text.match(/(?:to|towards|at|info:)\s+(?:upi payment to|card payment to|vpa|pos)?\s*([A-Za-z0-9\s&.'-]+?)(?:\s+on|\s+ref|\.|$)/i);
      if (toMatch && toMatch[1]) {
        result.merchant = this._cleanMerchantName(toMatch[1]);
      } else {
        result.merchant = 'Point of Sale Merchant';
      }
    }

    // 7. Auto-Categorize based on merchant and keywords
    if (result.type === 'income') {
      result.category = 'Income';
    } else {
      result.category = this.categorizeText(result.merchant + ' ' + text);
    }

    return result;
  }

  static _cleanMerchantName(name) {
    return name
      .replace(/UPI payment to/i, '')
      .replace(/card payment to/i, '')
      .replace(/VPA/i, '')
      .replace(/Ref\s*\d+/i, '')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .slice(0, 32);
  }

  /**
   * Determine best category matching given text keywords
   */
  static categorizeText(text) {
    const lower = text.toLowerCase();
    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (cat === 'Income') continue;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          return cat;
        }
      }
    }
    return 'Other';
  }

  /**
   * Ready-made Indian bank SMS simulation presets for testing
   */
  static getSimulationPresets() {
    return [
      {
        label: 'Zomato Food Delivery (₹280)',
        sender: 'VK-HDFCBK',
        text: 'Your A/c XX1234 is debited with Rs. 280.00 on 18-11-2026 towards UPI payment to ZOMATO FOOD.'
      },
      {
        label: 'Blinkit 10-Min Groceries (₹345)',
        sender: 'AD-SBIINB',
        text: 'Dear Customer, A/c XX1234 debited with INR 345.00 on 18-11-2026 towards UPI to BLINKIT GROCERIES.'
      },
      {
        label: 'BMTC Transit Pass (₹70)',
        sender: 'VK-HDFCBK',
        text: 'Your A/c XX1234 is debited with Rs. 70.00 on 18-11-2026 towards UPI payment to BMTC BUS.'
      },
      {
        label: 'Freelance Design Stipend (+₹4,500)',
        sender: 'AX-AXISBK',
        text: 'Your A/c XX1234 is credited with Rs. 4500.00 on 18-11-2026 via NEFT from CREATIVE STUDIO LLP.'
      },
      {
        label: 'Campus Xerox & Book Binding (₹110)',
        sender: 'AD-SBIINB',
        text: 'Your A/c XX1234 is debited with Rs. 110.00 on 18-11-2026 towards UPI payment to CAMPUS STATIONERY.'
      },
      {
        label: 'Apollo Pharmacy Medicines (₹165)',
        sender: 'VK-HDFCBK',
        text: 'Your A/c XX1234 is debited with Rs. 165.00 on 18-11-2026 towards UPI payment to APOLLO PHARMACY.'
      }
    ];
  }
}

window.CATEGORY_KEYWORDS = CATEGORY_KEYWORDS;
window.SMSParser = SMSParser;
