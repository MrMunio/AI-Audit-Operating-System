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
      invoice_vendor: { key: 'invoice_vendor', label: 'Vendor Name', value: 'Acme Hardware Solutions Ltd', confidence: 0.98, sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf', sourcePage: 1 },
      invoice_number: { key: 'invoice_number', label: 'Invoice Number', value: 'INV-9042', confidence: 0.99, sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf', sourcePage: 1 },
      invoice_date: { key: 'invoice_date', label: 'Invoice Date', value: '2026-07-15', confidence: 0.97, sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf', sourcePage: 1 },
      invoice_amount: { key: 'invoice_amount', label: 'Invoice Amount ($)', value: 13500, confidence: 0.96, sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf', sourcePage: 1 },
      invoice_gst: { key: 'invoice_gst', label: 'GST/Tax Amount ($)', value: 1227.27, confidence: 0.92, sourceDocument: 'Invoice_INV-9042_AcmeCorp.pdf', sourcePage: 1 },
      po_number: { key: 'po_number', label: 'PO Reference Number', value: 'PO-1029', confidence: 0.98, sourceDocument: 'PurchaseOrder_PO-1029.pdf', sourcePage: 1 },
      po_amount: { key: 'po_amount', label: 'PO Authorized Amount ($)', value: 12000, confidence: 0.95, sourceDocument: 'PurchaseOrder_PO-1029.pdf', sourcePage: 1 },
      payment_date: { key: 'payment_date', label: 'Payment Date', value: '2026-07-20', confidence: 0.98, sourceDocument: 'PaymentVoucher_PV-8812.pdf', sourcePage: 1 },
      payment_amount: { key: 'payment_amount', label: 'Payment Amount ($)', value: 15000, confidence: 0.94, sourceDocument: 'PaymentVoucher_PV-8812.pdf', sourcePage: 1 },
      approver_name: { key: 'approver_name', label: 'Approver Name', value: 'David Vance (CFO)', confidence: 0.91, sourceDocument: 'PurchaseOrder_PO-1029.pdf', sourcePage: 1 }
    }
  },

  procurement_audit: {
    id: 'sp_procurement_01',
    moduleId: 'procurement_audit',
    title: 'Hardware Procurement (3-Way Quantity Mismatch)',
    description: 'Vendor billed for 100 laptops, but warehouse GRN only received 85 units.',
    documents: [
      { id: 'p_po', filename: 'PO_7710_IT_Hardware.pdf', fileSize: 210000, mimeType: 'application/pdf', classifiedType: 'purchase_order', classificationConfidence: 0.99, pageCount: 1, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() },
      { id: 'p_grn', filename: 'GRN_4102_Warehouse_Receipt.pdf', fileSize: 195000, mimeType: 'application/pdf', classifiedType: 'goods_receipt', classificationConfidence: 0.97, pageCount: 1, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() },
      { id: 'p_inv', filename: 'VendorInvoice_INV_9821.pdf', fileSize: 230000, mimeType: 'application/pdf', classifiedType: 'invoice', classificationConfidence: 0.98, pageCount: 1, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() }
    ],
    extractedFields: {
      po_number: { key: 'po_number', label: 'PO Number', value: 'PO-7710', confidence: 0.99, sourceDocument: 'PO_7710_IT_Hardware.pdf', sourcePage: 1 },
      grn_number: { key: 'grn_number', label: 'GRN Number', value: 'GRN-4102', confidence: 0.97, sourceDocument: 'GRN_4102_Warehouse_Receipt.pdf', sourcePage: 1 },
      invoice_number: { key: 'invoice_number', label: 'Invoice Number', value: 'INV-9821', confidence: 0.99, sourceDocument: 'VendorInvoice_INV_9821.pdf', sourcePage: 1 },
      po_quantity: { key: 'po_quantity', label: 'PO Ordered Quantity', value: 100, confidence: 0.98, sourceDocument: 'PO_7710_IT_Hardware.pdf', sourcePage: 1 },
      grn_quantity: { key: 'grn_quantity', label: 'GRN Delivered Quantity', value: 85, confidence: 0.96, sourceDocument: 'GRN_4102_Warehouse_Receipt.pdf', sourcePage: 1 },
      invoice_quantity: { key: 'invoice_quantity', label: 'Invoice Billed Quantity', value: 100, confidence: 0.98, sourceDocument: 'VendorInvoice_INV_9821.pdf', sourcePage: 1 },
      po_unit_price: { key: 'po_unit_price', label: 'PO Unit Price ($)', value: 1200, confidence: 0.99, sourceDocument: 'PO_7710_IT_Hardware.pdf', sourcePage: 1 },
      invoice_unit_price: { key: 'invoice_unit_price', label: 'Invoice Unit Price ($)', value: 1200, confidence: 0.99, sourceDocument: 'VendorInvoice_INV_9821.pdf', sourcePage: 1 },
      invoice_total: { key: 'invoice_total', label: 'Invoice Billed Total ($)', value: 120000, confidence: 0.99, sourceDocument: 'VendorInvoice_INV_9821.pdf', sourcePage: 1 }
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
      bank_opening_balance: { key: 'bank_opening_balance', label: 'Bank Opening Balance ($)', value: 145250, confidence: 0.98, sourceDocument: 'Chase_Bank_Statement_July2026.pdf', sourcePage: 1 },
      bank_closing_balance: { key: 'bank_closing_balance', label: 'Bank Closing Balance ($)', value: 182400, confidence: 0.99, sourceDocument: 'Chase_Bank_Statement_July2026.pdf', sourcePage: 2 },
      gl_opening_balance: { key: 'gl_opening_balance', label: 'GL Opening Balance ($)', value: 141000, confidence: 0.97, sourceDocument: 'GL_Cash_Account_1010.pdf', sourcePage: 1 },
      gl_closing_balance: { key: 'gl_closing_balance', label: 'GL Closing Balance ($)', value: 182020, confidence: 0.97, sourceDocument: 'GL_Cash_Account_1010.pdf', sourcePage: 3 },
      total_bank_deposits: { key: 'total_bank_deposits', label: 'Total Bank Credits ($)', value: 45000, confidence: 0.95, sourceDocument: 'Chase_Bank_Statement_July2026.pdf', sourcePage: 2 },
      total_gl_deposits: { key: 'total_gl_deposits', label: 'Total Ledger Credits ($)', value: 45000, confidence: 0.95, sourceDocument: 'GL_Cash_Account_1010.pdf', sourcePage: 3 },
      outstanding_cheques_count: { key: 'outstanding_cheques_count', label: 'Unpresented Cheques Count', value: 2, confidence: 0.91, sourceDocument: 'GL_Cash_Account_1010.pdf', sourcePage: 3 },
      bank_charges_unrecorded: { key: 'bank_charges_unrecorded', label: 'Unrecorded Bank Charges ($)', value: 380, confidence: 0.92, sourceDocument: 'Chase_Bank_Statement_July2026.pdf', sourcePage: 2 }
    }
  },

  fraud_detection: {
    id: 'sp_fraud_01',
    moduleId: 'fraud_detection',
    title: 'AP Forensic Investigation Sample',
    description: 'Identifies split payments under $5,000 threshold and a 2-day-old new vendor receiving high value wire transfer.',
    documents: [
      { id: 'f_log', filename: 'AP_Disbursement_Log_2026.csv', fileSize: 180000, mimeType: 'text/csv', classifiedType: 'payment_register', classificationConfidence: 0.99, pageCount: 1, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() },
      { id: 'f_vendor', filename: 'Vendor_Master_Registry.pdf', fileSize: 220000, mimeType: 'application/pdf', classifiedType: 'vendor_master', classificationConfidence: 0.98, pageCount: 1, isDigitalPdfBypassedOcr: true, uploadedAt: new Date().toISOString() }
    ],
    extractedFields: {
      invoice_number: { key: 'invoice_number', label: 'Invoice Number', value: 'INV-SP-001', confidence: 0.99, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      vendor_name: { key: 'vendor_name', label: 'Vendor Name', value: 'Apex Global Consulting LLC', confidence: 0.98, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      payment_amount: { key: 'payment_amount', label: 'Disbursement Amount ($)', value: 14850, confidence: 0.99, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      payment_date: { key: 'payment_date', label: 'Payment Date', value: '2026-07-26', confidence: 0.98, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      payment_day_of_week: { key: 'payment_day_of_week', label: 'Day of Week', value: 'Sunday', confidence: 0.95, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      is_round_number: { key: 'is_round_number', label: 'Round Amount Flag', value: true, confidence: 0.99, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 },
      vendor_created_days_ago: { key: 'vendor_created_days_ago', label: 'Vendor Age at Payment (Days)', value: 2, confidence: 0.94, sourceDocument: 'Vendor_Master_Registry.pdf', sourcePage: 1 },
      split_payment_group_count: { key: 'split_payment_group_count', label: 'Near-Threshold Payments Count', value: 3, confidence: 0.96, sourceDocument: 'AP_Disbursement_Log_2026.csv', sourcePage: 1 }
    }
  }
};
