import { ExtractedFieldMap, UploadedDocument } from '../types/audit';

export interface SamplePack {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  documents: UploadedDocument[];
  extractedFields: ExtractedFieldMap;
}

export const SAMPLE_PACKS: Record<string, SamplePack> = {
  expense_audit: {
    id: 'sp_expense_01',
    moduleId: 'expense_audit',
    title: 'Enterprise Q3 Expense Batch (With Discrepancy)',
    description: 'Contains Invoice INV-9042, PO-1029 ($12,000 max), and Payment Voucher showing a $1,500 overpayment variance.',
    documents: [
      {
        id: 'doc_inv_101',
        filename: 'Invoice_INV-9042_AcmeCorp.pdf',
        fileSize: 245000,
        mimeType: 'application/pdf',
        classifiedType: 'invoice',
        classificationConfidence: 0.98,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_po_102',
        filename: 'PurchaseOrder_PO-1029.pdf',
        fileSize: 180000,
        mimeType: 'application/pdf',
        classifiedType: 'purchase_order',
        classificationConfidence: 0.96,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_pay_103',
        filename: 'PaymentVoucher_PV-8812.pdf',
        fileSize: 130000,
        mimeType: 'application/pdf',
        classifiedType: 'payment_voucher',
        classificationConfidence: 0.94,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      }
    ],
    extractedFields: {
      invoice_vendor: {
        field_key: 'invoice_vendor',
        field_label: 'Vendor Name',
        value: 'Acme Hardware Solutions Ltd',
        extraction_status: 'success',
        chain_of_thought: 'Extracted from invoice header banner "Acme Hardware Solutions Ltd".',
        evidences: [{ document_name: 'Invoice_INV-9042_AcmeCorp.pdf', page_number: 1, evidence_text: 'Acme Hardware Solutions Ltd - Tax Invoice #INV-9042' }],
        confidence: 0.98,
        sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf',
        sourcePage: 1
      },
      invoice_number: {
        field_key: 'invoice_number',
        field_label: 'Invoice Number',
        value: 'INV-9042',
        extraction_status: 'success',
        chain_of_thought: 'Located invoice reference code next to date header.',
        evidences: [{ document_name: 'Invoice_INV-9042_AcmeCorp.pdf', page_number: 1, evidence_text: 'Invoice Number: INV-9042' }],
        confidence: 0.99,
        sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf',
        sourcePage: 1
      },
      invoice_date: {
        field_key: 'invoice_date',
        field_label: 'Invoice Date',
        value: '2026-07-15',
        extraction_status: 'success',
        chain_of_thought: 'Parsed issue date formatted as 15/07/2026.',
        evidences: [{ document_name: 'Invoice_INV-9042_AcmeCorp.pdf', page_number: 1, evidence_text: 'Date: 15/07/2026' }],
        confidence: 0.97,
        sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf',
        sourcePage: 1
      },
      invoice_amount: {
        field_key: 'invoice_amount',
        field_label: 'Invoice Amount ($)',
        value: 13500,
        extraction_status: 'success',
        chain_of_thought: 'Total invoice grand total inclusive of GST.',
        evidences: [{ document_name: 'Invoice_INV-9042_AcmeCorp.pdf', page_number: 1, evidence_text: 'Grand Total Amount Due: $13,500.00' }],
        confidence: 0.96,
        sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf',
        sourcePage: 1
      },
      invoice_gst: {
        field_key: 'invoice_gst',
        field_label: 'GST/Tax Amount ($)',
        value: 1227.27,
        extraction_status: 'success',
        chain_of_thought: 'Extracted GST 10% line item breakdown.',
        evidences: [{ document_name: 'Invoice_INV-9042_AcmeCorp.pdf', page_number: 1, evidence_text: 'Includes GST (10%): $1,227.27' }],
        confidence: 0.92,
        sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf',
        sourcePage: 1
      },
      po_number: {
        field_key: 'po_number',
        field_label: 'PO Reference Number',
        value: 'PO-1029',
        extraction_status: 'success',
        chain_of_thought: 'Identified PO number in purchase order title block.',
        evidences: [{ document_name: 'PurchaseOrder_PO-1029.pdf', page_number: 1, evidence_text: 'Purchase Order Reference: PO-1029' }],
        confidence: 0.98,
        sourceDocument: 'PurchaseOrder_PO-1029.pdf',
        sourcePage: 1
      },
      po_amount: {
        field_key: 'po_amount',
        field_label: 'PO Authorized Amount ($)',
        value: 12000,
        extraction_status: 'success',
        chain_of_thought: 'Authorized spend limit recorded in PO summary line.',
        evidences: [{ document_name: 'PurchaseOrder_PO-1029.pdf', page_number: 1, evidence_text: 'Maximum Approved Spend Limit: $12,000.00' }],
        confidence: 0.95,
        sourceDocument: 'PurchaseOrder_PO-1029.pdf',
        sourcePage: 1
      },
      payment_date: {
        field_key: 'payment_date',
        field_label: 'Payment Date',
        value: '2026-07-20',
        extraction_status: 'success',
        chain_of_thought: 'Bank transfer completion date.',
        evidences: [{ document_name: 'PaymentVoucher_PV-8812.pdf', page_number: 1, evidence_text: 'Disbursement Date: 2026-07-20' }],
        confidence: 0.98,
        sourceDocument: 'PaymentVoucher_PV-8812.pdf',
        sourcePage: 1
      },
      payment_amount: {
        field_key: 'payment_amount',
        field_label: 'Payment Amount ($)',
        value: 15000,
        extraction_status: 'success',
        chain_of_thought: 'Transferred wire amount from voucher total.',
        evidences: [{ document_name: 'PaymentVoucher_PV-8812.pdf', page_number: 1, evidence_text: 'Net Transferred Amount: $15,000.00' }],
        confidence: 0.94,
        sourceDocument: 'PaymentVoucher_PV-8812.pdf',
        sourcePage: 1
      },
      approver_name: {
        field_key: 'approver_name',
        field_label: 'Approver Name',
        value: 'David Vance (CFO)',
        extraction_status: 'success',
        chain_of_thought: 'Sign-off approval signature block on PO.',
        evidences: [{ document_name: 'PurchaseOrder_PO-1029.pdf', page_number: 1, evidence_text: 'Authorized By: David Vance, Chief Financial Officer' }],
        confidence: 0.91,
        sourceDocument: 'PurchaseOrder_PO-1029.pdf',
        sourcePage: 1
      }
    }
  },

  bank_reconciliation: {
    id: 'sp_bank_01',
    moduleId: 'bank_reconciliation',
    title: 'July Monthly Bank Reconciliation',
    description: 'Bank Statement vs General Ledger showing $4,250 unadjusted opening balance difference and $380 unrecorded bank charges.',
    documents: [
      { id: 'b_stmt', filename: 'Chase_Bank_Statement_July2026.pdf', fileSize: 340000, mimeType: 'application/pdf', classifiedType: 'bank_statement', classificationConfidence: 0.99, pageCount: 2, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() },
      { id: 'b_gl', filename: 'GL_Cash_Account_1010.pdf', fileSize: 290000, mimeType: 'application/pdf', classifiedType: 'general_ledger', classificationConfidence: 0.96, pageCount: 3, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() }
    ],
    extractedFields: {
      bank_opening_balance: {
        field_key: 'bank_opening_balance',
        field_label: 'Bank Opening Balance ($)',
        value: 145250,
        extraction_status: 'success',
        chain_of_thought: 'Beginning balance found on page 1 top header.',
        evidences: [{ document_name: 'Chase_Bank_Statement_July2026.pdf', page_number: 1, evidence_text: 'Beginning Balance on 07/01/2026: $145,250.00' }],
        confidence: 0.98,
        sourceDocument: 'Chase_Bank_Statement_July2026.pdf',
        sourcePage: 1
      },
      bank_closing_balance: {
        field_key: 'bank_closing_balance',
        field_label: 'Bank Closing Balance ($)',
        value: 182400,
        extraction_status: 'success',
        chain_of_thought: 'Ending balance on page 2 monthly summary.',
        evidences: [{ document_name: 'Chase_Bank_Statement_July2026.pdf', page_number: 2, evidence_text: 'Ending Balance on 07/31/2026: $182,400.00' }],
        confidence: 0.99,
        sourceDocument: 'Chase_Bank_Statement_July2026.pdf',
        sourcePage: 2
      },
      gl_opening_balance: {
        field_key: 'gl_opening_balance',
        field_label: 'GL Opening Balance ($)',
        value: 141000,
        extraction_status: 'success',
        chain_of_thought: 'GL cash account 1010 opening debit balance.',
        evidences: [{ document_name: 'GL_Cash_Account_1010.pdf', page_number: 1, evidence_text: 'Account 1010 Cash - Opening Balance Debit: $141,000.00' }],
        confidence: 0.97,
        sourceDocument: 'GL_Cash_Account_1010.pdf',
        sourcePage: 1
      },
      gl_closing_balance: {
        field_key: 'gl_closing_balance',
        field_label: 'GL Closing Balance ($)',
        value: 182020,
        extraction_status: 'success',
        chain_of_thought: 'GL cash account 1010 closing period total.',
        evidences: [{ document_name: 'GL_Cash_Account_1010.pdf', page_number: 3, evidence_text: 'Account 1010 Cash - Period Ending Balance: $182,020.00' }],
        confidence: 0.97,
        sourceDocument: 'GL_Cash_Account_1010.pdf',
        sourcePage: 3
      },
      total_bank_deposits: {
        field_key: 'total_bank_deposits',
        field_label: 'Total Bank Credits ($)',
        value: 45000,
        extraction_status: 'success',
        chain_of_thought: 'Sum of all bank deposits & credit entries.',
        evidences: [{ document_name: 'Chase_Bank_Statement_July2026.pdf', page_number: 2, evidence_text: 'Total Credits & Deposits: $45,000.00' }],
        confidence: 0.95,
        sourceDocument: 'Chase_Bank_Statement_July2026.pdf',
        sourcePage: 2
      },
      total_gl_deposits: {
        field_key: 'total_gl_deposits',
        field_label: 'Total Ledger Credits ($)',
        value: 45000,
        extraction_status: 'success',
        chain_of_thought: 'GL ledger debit receipts summary total.',
        evidences: [{ document_name: 'GL_Cash_Account_1010.pdf', page_number: 3, evidence_text: 'GL Total Cash Receipts / Deposits: $45,000.00' }],
        confidence: 0.95,
        sourceDocument: 'GL_Cash_Account_1010.pdf',
        sourcePage: 3
      },
      outstanding_cheques_count: {
        field_key: 'outstanding_cheques_count',
        field_label: 'Unpresented Cheques Count',
        value: 2,
        extraction_status: 'success',
        chain_of_thought: 'Count of issued cheques not cleared by bank statement.',
        evidences: [{ document_name: 'GL_Cash_Account_1010.pdf', page_number: 3, evidence_text: 'Pending Unpresented Cheques Count: 2 (CHQ-4401, CHQ-4409)' }],
        confidence: 0.91,
        sourceDocument: 'GL_Cash_Account_1010.pdf',
        sourcePage: 3
      },
      bank_charges_unrecorded: {
        field_key: 'bank_charges_unrecorded',
        field_label: 'Unrecorded Bank Charges ($)',
        value: 380,
        extraction_status: 'success',
        chain_of_thought: 'Bank statement wire charges not recorded in ledger cash account.',
        evidences: [{ document_name: 'Chase_Bank_Statement_July2026.pdf', page_number: 2, evidence_text: 'Monthly Maintenance & Wire Service Fees: $380.00' }],
        confidence: 0.92,
        sourceDocument: 'Chase_Bank_Statement_July2026.pdf',
        sourcePage: 2
      }
    }
  },

  bank_reconciliation_v2: {
    id: 'sp_bank_v2_01',
    moduleId: 'bank_reconciliation_v2',
    title: 'Infomerica Q3 Forensic Bank Batch (With Transposition & Unposted Fees)',
    description: 'Forensic reconciliation package for Infomerica Inc. containing Bank Statement, GL Cash Account #1010, and Cash Register with 18 transactions, highlighting a $18.00 transposition typo ($86.00 vs $68.00), $145.00 unrecorded wire fees, and month-end timing cut-offs.',
    documents: [
      {
        id: 'doc_stmt_v2',
        filename: 'bank_statement.pdf',
        fileSize: 320000,
        mimeType: 'application/pdf',
        classifiedType: 'bank_statement',
        classificationConfidence: 0.99,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_gl_v2',
        filename: 'general_ledger.pdf',
        fileSize: 310000,
        mimeType: 'application/pdf',
        classifiedType: 'general_ledger',
        classificationConfidence: 0.98,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'doc_cr_v2',
        filename: 'cash_register.pdf',
        fileSize: 280000,
        mimeType: 'application/pdf',
        classifiedType: 'cash_register',
        classificationConfidence: 0.95,
        pageCount: 1,
        isDigitalPdfBypassedOcr: true,
        uploadedAt: new Date().toISOString()
      }
    ],
    extractedFields: {
      bank_entity_name: {
        field_key: 'bank_entity_name',
        field_label: 'Account Holder / Legal Entity Name',
        value: 'Infomerica Inc.',
        extraction_status: 'success',
        chain_of_thought: 'Extracted from bank statement header banner.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Account Name: Infomerica Inc.' }],
        confidence: 0.99,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_name: {
        field_key: 'bank_name',
        field_label: 'Bank Institution Name',
        value: 'ABC National Bank',
        extraction_status: 'success',
        chain_of_thought: 'Header financial institution title.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Bank: ABC National Bank' }],
        confidence: 0.98,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_account_number: {
        field_key: 'bank_account_number',
        field_label: 'Bank Account Number',
        value: '1234567890',
        extraction_status: 'success',
        chain_of_thought: 'Located account number on statement header.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Account Number: 1234567890' }],
        confidence: 0.99,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      statement_start_date: {
        field_key: 'statement_start_date',
        field_label: 'Statement Start Date',
        value: '2026-07-01',
        extraction_status: 'success',
        chain_of_thought: 'Start date of statement cycle.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Statement Period: 01-Jul-2026 to 31-Jul-2026' }],
        confidence: 0.98,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      statement_end_date: {
        field_key: 'statement_end_date',
        field_label: 'Statement End Date',
        value: '2026-07-31',
        extraction_status: 'success',
        chain_of_thought: 'End date of statement cycle.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Statement Period: 01-Jul-2026 to 31-Jul-2026' }],
        confidence: 0.98,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_opening_balance: {
        field_key: 'bank_opening_balance',
        field_label: 'Bank Opening Balance ($)',
        value: 125400,
        extraction_status: 'success',
        chain_of_thought: 'Opening statement balance on 01-Jul-2026.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: '01-Jul-2026 | Opening Balance | $125,400.00' }],
        confidence: 0.99,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_closing_balance: {
        field_key: 'bank_closing_balance',
        field_label: 'Bank Closing Balance ($)',
        value: 110737,
        extraction_status: 'success',
        chain_of_thought: 'Ending statement balance on 31-Jul-2026.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: '31-Jul-2026 | Closing Balance | $110,737.00' }],
        confidence: 0.99,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      total_bank_deposits: {
        field_key: 'total_bank_deposits',
        field_label: 'Total Bank Credits/Deposits ($)',
        value: 100550,
        extraction_status: 'success',
        chain_of_thought: 'Sum total of customer deposits credited on statement.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Total Credits & Deposits: $100,550.00' }],
        confidence: 0.96,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      total_bank_withdrawals: {
        field_key: 'total_bank_withdrawals',
        field_label: 'Total Bank Debits/Withdrawals ($)',
        value: 115213,
        extraction_status: 'success',
        chain_of_thought: 'Sum total of disbursements and fees debited on statement.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Total Debits & Disbursements: $115,213.00' }],
        confidence: 0.96,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_charges_unrecorded: {
        field_key: 'bank_charges_unrecorded',
        field_label: 'Bank Service & Wire Charges ($)',
        value: 145,
        extraction_status: 'success',
        chain_of_thought: 'Unrecorded wire fee item on 28-Jul-2026.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: '28-Jul-2026 | Wire Transfer & Account Maintenance Fee | FEE-882 | $145.00' }],
        confidence: 0.94,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_interest_earned: {
        field_key: 'bank_interest_earned',
        field_label: 'Bank Interest Earned ($)',
        value: 0,
        extraction_status: 'success',
        chain_of_thought: 'No interest income earned this cycle.',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: 'Interest Earned: $0.00' }],
        confidence: 0.95,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      bank_transactions: {
        field_key: 'bank_transactions',
        field_label: 'Bank Statement Line Items',
        value: [
          { date: '2026-07-02', reference: 'DEP-101', description: 'Customer Remittance (TechCorp)', debit: 0, credit: 14500, balance: 139900 },
          { date: '2026-07-04', reference: 'TXN-201', description: 'Office Space Rent (Metro Properties)', debit: 8500, credit: 0, balance: 131400 },
          { date: '2026-07-06', reference: 'DEP-102', description: 'Client Payment (Apex Systems)', debit: 0, credit: 9800, balance: 141200 },
          { date: '2026-07-08', reference: 'TXN-202', description: 'Cloud Hosting (AWS Cloud)', debit: 3450, credit: 0, balance: 137750 },
          { date: '2026-07-10', reference: 'DEP-103', description: 'Consulting Retainer (Global Logistics)', debit: 0, credit: 22000, balance: 159750 },
          { date: '2026-07-12', reference: 'TXN-203', description: 'Software Licenses (Atlassian)', debit: 2100, credit: 0, balance: 157650 },
          { date: '2026-07-15', reference: 'TXN-204', description: 'Semi-Monthly Payroll (Staff Wages)', debit: 45000, credit: 0, balance: 112650 },
          { date: '2026-07-17', reference: 'DEP-104', description: 'Milestone Settlement (Omega Retail)', debit: 0, credit: 16400, balance: 129050 },
          { date: '2026-07-19', reference: 'TXN-205', description: 'Telecom & High-Speed Data (Verizon)', debit: 1250, credit: 0, balance: 127800 },
          { date: '2026-07-21', reference: 'DEP-105', description: 'Project Milestone (CyberSecure Ltd)', debit: 0, credit: 18750, balance: 146550 },
          { date: '2026-07-22', reference: 'TXN-206', description: 'Legal Retainer (Baker & McKenzie)', debit: 5500, credit: 0, balance: 141050 },
          { date: '2026-07-24', reference: 'DEP-106', description: 'Maintenance Contract (Starlight Infotech)', debit: 0, credit: 7600, balance: 148650 },
          { date: '2026-07-25', reference: 'TXN-207', description: 'Marketing Campaign Ads (Google Ads)', debit: 4200, credit: 0, balance: 144450 },
          { date: '2026-07-26', reference: 'TXN-208', description: 'Office Supplies & Courier (Acme Hardware)', debit: 68, credit: 0, balance: 144382 },
          { date: '2026-07-28', reference: 'FEE-882', description: 'Wire Transfer & Account Maintenance Fee', debit: 145, credit: 0, balance: 144237 },
          { date: '2026-07-29', reference: 'DEP-107', description: 'Customer Payment (Dynamic Solutions)', debit: 0, credit: 11500, balance: 155737 },
          { date: '2026-07-30', reference: 'TXN-209', description: 'Semi-Monthly Payroll (Staff Wages)', debit: 45000, credit: 0, balance: 110737 }
        ],
        extraction_status: 'success',
        chain_of_thought: 'Extracted 17 bank transactions including TXN-208 ($68.00) and wire fee FEE-882 ($145.00).',
        evidences: [{ document_name: 'bank_statement.pdf', page_number: 1, evidence_text: '26-Jul-2026 | Office Supplies & Courier (Acme Hardware) | TXN-208 | 68.00' }],
        confidence: 0.98,
        sourceDocument: 'bank_statement.pdf',
        sourcePage: 1
      },
      gl_entity_name: {
        field_key: 'gl_entity_name',
        field_label: 'GL Entity / Company Name',
        value: 'Infomerica Inc.',
        extraction_status: 'success',
        chain_of_thought: 'Company entity name on GL report header.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Company: Infomerica Inc.' }],
        confidence: 0.99,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_account_name: {
        field_key: 'gl_account_name',
        field_label: 'GL Account Description',
        value: '1010 - Operating Cash Account',
        extraction_status: 'success',
        chain_of_thought: 'Account name from GL header.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Account: 1010 - Operating Cash Account' }],
        confidence: 0.97,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_account_number: {
        field_key: 'gl_account_number',
        field_label: 'GL Linked Bank Account #',
        value: '1234567890',
        extraction_status: 'success',
        chain_of_thought: 'Linked bank account in GL cash master.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Linked Bank Account: 1234567890' }],
        confidence: 0.98,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_period_start_date: {
        field_key: 'gl_period_start_date',
        field_label: 'GL Period Start Date',
        value: '2026-07-01',
        extraction_status: 'success',
        chain_of_thought: 'Period start from GL header.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Period: 01-Jul-2026 to 31-Jul-2026' }],
        confidence: 0.98,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_period_end_date: {
        field_key: 'gl_period_end_date',
        field_label: 'GL Period End Date',
        value: '2026-07-31',
        extraction_status: 'success',
        chain_of_thought: 'Period end from GL header.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Period: 01-Jul-2026 to 31-Jul-2026' }],
        confidence: 0.98,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_opening_balance: {
        field_key: 'gl_opening_balance',
        field_label: 'GL Opening Balance ($)',
        value: 125400,
        extraction_status: 'success',
        chain_of_thought: 'GL opening debit balance.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: '01-Jul-2026 | GL-700 | Opening Balance | $125,400.00' }],
        confidence: 0.99,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_closing_balance: {
        field_key: 'gl_closing_balance',
        field_label: 'GL Closing Balance ($)',
        value: 112814,
        extraction_status: 'success',
        chain_of_thought: 'GL ending debit balance.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: '31-Jul-2026 | GL-718 | Closing Balance | $112,814.00' }],
        confidence: 0.99,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      total_gl_receipts: {
        field_key: 'total_gl_receipts',
        field_label: 'Total GL Receipts / Debits ($)',
        value: 103750,
        extraction_status: 'success',
        chain_of_thought: 'Total debit receipts in GL including deposit in transit.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Total Cash Receipts (Debits): $103,750.00' }],
        confidence: 0.95,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      total_gl_disbursements: {
        field_key: 'total_gl_disbursements',
        field_label: 'Total GL Disbursements / Credits ($)',
        value: 116336,
        extraction_status: 'success',
        chain_of_thought: 'Total credit disbursements recorded in GL.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Total Cash Disbursements (Credits): $116,336.00' }],
        confidence: 0.95,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      deposits_in_transit: {
        field_key: 'deposits_in_transit',
        field_label: 'Deposits in Transit ($)',
        value: 3200,
        extraction_status: 'success',
        chain_of_thought: 'Customer deposit on 31-Jul not yet cleared by bank.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Note: Deposit in Transit of $3,200.00 recorded on 31-Jul-2026 (DEP-108 Summit Corp)' }],
        confidence: 0.94,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      outstanding_cheques_amount: {
        field_key: 'outstanding_cheques_amount',
        field_label: 'Outstanding Cheques ($)',
        value: 1250,
        extraction_status: 'success',
        chain_of_thought: 'Unpresented cheque #1088 issued on 31-Jul.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: 'Note: Outstanding Cheque #1088 for $1,250.00 issued on 31-Jul-2026 not cleared' }],
        confidence: 0.93,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      },
      gl_transactions: {
        field_key: 'gl_transactions',
        field_label: 'GL Journal Entries',
        value: [
          { date: '2026-07-02', journal_ref: 'GL-701', description: 'Customer Remittance (TechCorp)', debit: 14500, credit: 0, running_balance: 139900 },
          { date: '2026-07-04', journal_ref: 'GL-702', description: 'Office Space Rent (Metro Properties)', debit: 0, credit: 8500, running_balance: 131400 },
          { date: '2026-07-06', journal_ref: 'GL-703', description: 'Client Payment (Apex Systems)', debit: 9800, credit: 0, running_balance: 141200 },
          { date: '2026-07-08', journal_ref: 'GL-704', description: 'Cloud Hosting (AWS Cloud)', debit: 0, credit: 3450, running_balance: 137750 },
          { date: '2026-07-10', journal_ref: 'GL-705', description: 'Consulting Retainer (Global Logistics)', debit: 22000, credit: 0, running_balance: 159750 },
          { date: '2026-07-12', journal_ref: 'GL-706', description: 'Software Licenses (Atlassian)', debit: 0, credit: 2100, running_balance: 157650 },
          { date: '2026-07-15', journal_ref: 'GL-707', description: 'Semi-Monthly Payroll (Staff Wages)', debit: 0, credit: 45000, running_balance: 112650 },
          { date: '2026-07-17', journal_ref: 'GL-708', description: 'Milestone Settlement (Omega Retail)', debit: 16400, credit: 0, running_balance: 129050 },
          { date: '2026-07-19', journal_ref: 'GL-709', description: 'Telecom & High-Speed Data (Verizon)', debit: 0, credit: 1250, running_balance: 127800 },
          { date: '2026-07-21', journal_ref: 'GL-710', description: 'Project Milestone (CyberSecure Ltd)', debit: 18750, credit: 0, running_balance: 146550 },
          { date: '2026-07-22', journal_ref: 'GL-711', description: 'Legal Retainer (Baker & McKenzie)', debit: 0, credit: 5500, running_balance: 141050 },
          { date: '2026-07-24', journal_ref: 'GL-712', description: 'Maintenance Contract (Starlight Infotech)', debit: 7600, credit: 0, running_balance: 148650 },
          { date: '2026-07-25', journal_ref: 'GL-713', description: 'Marketing Campaign Ads (Google Ads)', debit: 0, credit: 4200, running_balance: 144450 },
          { date: '2026-07-26', journal_ref: 'GL-714', description: 'Office Supplies & Courier (Acme Hardware)', debit: 0, credit: 86, running_balance: 144364 },
          { date: '2026-07-29', journal_ref: 'GL-715', description: 'Customer Payment (Dynamic Solutions)', debit: 11500, credit: 0, running_balance: 155864 },
          { date: '2026-07-30', journal_ref: 'GL-716', description: 'Semi-Monthly Payroll (Staff Wages)', debit: 0, credit: 45000, running_balance: 110864 },
          { date: '2026-07-31', journal_ref: 'GL-717', description: 'Deposit in Transit (Summit Corp)', debit: 3200, credit: 0, running_balance: 114064 },
          { date: '2026-07-31', journal_ref: 'GL-718', description: 'Outstanding Cheque #1088 (Delta Logistics)', debit: 0, credit: 1250, running_balance: 112814 }
        ],
        extraction_status: 'success',
        chain_of_thought: 'Extracted 18 line items from GL ledger including transposed entry GL-714.',
        evidences: [{ document_name: 'general_ledger.pdf', page_number: 1, evidence_text: '26-Jul-2026 | GL-714 | Office Supplies & Courier (Acme Hardware) | $86.00' }],
        confidence: 0.97,
        sourceDocument: 'general_ledger.pdf',
        sourcePage: 1
      }
    }
  }
};
