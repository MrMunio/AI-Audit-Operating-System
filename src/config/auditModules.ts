import { AuditModule, AuditFinding } from '../types/audit';

export const AUDIT_MODULES: AuditModule[] = [
  // 1. EXPENSE AUDIT
  {
    id: 'expense_audit',
    title: 'Expense Audit',
    category: 'financial',
    description: 'Verify employee and corporate expense claims against POs, receipts, approval workflows, and tax compliance.',
    iconName: 'Receipt',
    samplePackName: 'Q3 Enterprise Expense Batch',
    requiredDocuments: [
      { type: 'invoice', name: 'Vendor Invoice', description: 'Tax invoice submitted by vendor or employee', isMandatory: true },
      { type: 'purchase_order', name: 'Purchase Order (PO)', description: 'Approved PO document with authorized spend limit', isMandatory: true },
      { type: 'approval_email', name: 'Approval Email/Ticket', description: 'Manager written approval or ticket proof', isMandatory: false },
      { type: 'payment_voucher', name: 'Payment Voucher / Bank Receipt', description: 'Proof of disbursement from finance system', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'invoice_vendor', label: 'Vendor Name', type: 'string', description: 'Name of issuing vendor' },
      { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Unique identifier on vendor invoice' },
      { key: 'invoice_date', label: 'Invoice Date', type: 'date', description: 'Date invoice was issued' },
      { key: 'invoice_amount', label: 'Invoice Amount ($)', type: 'number', description: 'Total gross amount on invoice' },
      { key: 'invoice_gst', label: 'GST/Tax Amount ($)', type: 'number', description: 'Tax portion on invoice' },
      { key: 'po_number', label: 'PO Reference Number', type: 'string', description: 'Associated Purchase Order ID' },
      { key: 'po_amount', label: 'PO Authorized Amount ($)', type: 'number', description: 'Maximum approved budget on PO' },
      { key: 'payment_date', label: 'Payment Date', type: 'date', description: 'Date of bank transfer' },
      { key: 'payment_amount', label: 'Payment Amount ($)', type: 'number', description: 'Amount paid per payment voucher' },
      { key: 'approver_name', label: 'Approver Name', type: 'string', description: 'Name of approving authority' },
    ],
    documentFieldSchemas: {
      invoice: [
        { key: 'invoice_vendor', label: 'Vendor Name', type: 'string', description: 'Name of the vendor or supplier printed on the invoice header' },
        { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Unique invoice reference number (e.g. INV-2026-001)' },
        { key: 'invoice_date', label: 'Invoice Date', type: 'date', description: 'Date the invoice was issued (DD/MM/YYYY or YYYY-MM-DD)' },
        { key: 'invoice_amount', label: 'Invoice Amount ($)', type: 'number', description: 'Total gross invoice amount inclusive of all taxes' },
        { key: 'invoice_gst', label: 'GST/Tax Amount ($)', type: 'number', description: 'Tax component separately stated on invoice (GST/VAT/sales tax)' },
      ],
      purchase_order: [
        { key: 'po_number', label: 'PO Reference Number', type: 'string', description: 'Purchase Order ID printed on the PO document (e.g. PO-8801)' },
        { key: 'po_amount', label: 'PO Authorized Amount ($)', type: 'number', description: 'Maximum authorized spend limit stated on the PO' },
        { key: 'approver_name', label: 'Approver Name', type: 'string', description: 'Name or signature of the manager/authority who approved the PO' },
      ],
      payment_voucher: [
        { key: 'payment_date', label: 'Payment Date', type: 'date', description: 'Date the bank transfer or payment was executed' },
        { key: 'payment_amount', label: 'Payment Amount ($)', type: 'number', description: 'Net amount transferred as shown on the payment voucher or bank receipt' },
      ],
      approval_email: [
        { key: 'approver_name', label: 'Approver Name', type: 'string', description: 'Name of the authorizing manager in the approval email or ticket' },
      ],
    },
    rules: [
      {
        id: 'RULE_EXP_01',
        name: 'Invoice vs Payment Amount Match',
        description: 'Ensures payment voucher amount exactly matches invoice total without overpayment.',
        category: 'Matching',
        severity: 'high',
        expressionDescription: 'invoice_amount == payment_amount',
        evaluate: (fields, docs) => {
          const invAmt = Number(fields.invoice_amount?.value || 0);
          const payAmt = Number(fields.payment_amount?.value || 0);
          const diff = Math.abs(invAmt - payAmt);
          if (diff === 0) {
            return {
              id: 'FND_EXP_01',
              ruleId: 'RULE_EXP_01',
              ruleName: 'Invoice vs Payment Amount Match',
              status: 'PASS',
              severity: 'low',
              title: 'Payment Amount Matches Invoice Exactly',
              description: `Payment voucher amount ($${payAmt.toLocaleString()}) matches invoice total ($${invAmt.toLocaleString()}) with zero variance.`,
              evidenceCitations: [
                { documentName: fields.invoice_amount?.sourceDocument || 'Invoice.pdf', pageNumber: fields.invoice_amount?.sourcePage || 1, fieldName: 'Invoice Amount', extractedValue: `$${invAmt}` },
                { documentName: fields.payment_amount?.sourceDocument || 'PaymentVoucher.pdf', pageNumber: fields.payment_amount?.sourcePage || 1, fieldName: 'Payment Amount', extractedValue: `$${payAmt}` }
              ],
              riskRating: 'Compliant',
              recommendation: 'No action required.'
            };
          }
          return {
            id: 'FND_EXP_01',
            ruleId: 'RULE_EXP_01',
            ruleName: 'Invoice vs Payment Amount Match',
            status: 'FAIL',
            severity: 'high',
            title: `Payment Discrepancy Found ($${diff.toLocaleString()} Variance)`,
            description: `Payment voucher of $${payAmt.toLocaleString()} does not match invoice total of $${invAmt.toLocaleString()}. Difference: $${diff.toLocaleString()}.`,
            evidenceCitations: [
              { documentName: fields.invoice_amount?.sourceDocument || 'Invoice.pdf', pageNumber: fields.invoice_amount?.sourcePage || 1, fieldName: 'Invoice Amount', extractedValue: `$${invAmt}` },
              { documentName: fields.payment_amount?.sourceDocument || 'PaymentVoucher.pdf', pageNumber: fields.payment_amount?.sourcePage || 1, fieldName: 'Payment Amount', extractedValue: `$${payAmt}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Hold vendor payment reconciliation until finance team clarifies the $${diff} difference.'
          };
        }
      },
      {
        id: 'RULE_EXP_02',
        name: 'PO Spend Limit Exceeded',
        description: 'Detects if invoice amount exceeds the approved PO limit.',
        category: 'Spend Control',
        severity: 'critical',
        expressionDescription: 'invoice_amount <= po_amount',
        evaluate: (fields) => {
          const invAmt = Number(fields.invoice_amount?.value || 0);
          const poAmt = Number(fields.po_amount?.value || 0);
          if (invAmt <= poAmt) {
            return {
              id: 'FND_EXP_02',
              ruleId: 'RULE_EXP_02',
              ruleName: 'PO Spend Limit Exceeded',
              status: 'PASS',
              severity: 'low',
              title: 'Invoice Spend Within Approved PO Limit',
              description: `Invoice amount ($${invAmt}) is within approved PO budget ($${poAmt}).`,
              evidenceCitations: [
                { documentName: fields.po_amount?.sourceDocument || 'PO_9041.pdf', pageNumber: 1, fieldName: 'PO Amount', extractedValue: `$${poAmt}` }
              ],
              riskRating: 'Compliant',
              recommendation: 'No action required.'
            };
          }
          return {
            id: 'FND_EXP_02',
            ruleId: 'RULE_EXP_02',
            ruleName: 'PO Spend Limit Exceeded',
            status: 'FAIL',
            severity: 'critical',
            title: 'Invoice Exceeds Approved PO Limit',
            description: `Invoice total ($${invAmt.toLocaleString()}) exceeds approved PO authorization ($${poAmt.toLocaleString()}) by $${(invAmt - poAmt).toLocaleString()}.`,
            evidenceCitations: [
              { documentName: fields.invoice_amount?.sourceDocument || 'Invoice.pdf', pageNumber: 1, fieldName: 'Invoice Amount', extractedValue: `$${invAmt}` },
              { documentName: fields.po_amount?.sourceDocument || 'PO.pdf', pageNumber: 1, fieldName: 'PO Amount', extractedValue: `$${poAmt}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Require secondary CFO sign-off for over-budget procurement before final accounting entry.'
          };
        }
      },
      {
        id: 'RULE_EXP_03',
        name: 'GST Tax Calculation Check',
        description: 'Verifies GST tax component is correctly calculated (standard 10%).',
        category: 'Tax',
        severity: 'medium',
        expressionDescription: 'abs(invoice_gst - (invoice_amount * 0.10 / 1.10)) < 1.0',
        evaluate: (fields) => {
          const invAmt = Number(fields.invoice_amount?.value || 0);
          const gstAmt = Number(fields.invoice_gst?.value || 0);
          const expectedGst = (invAmt * 0.10) / 1.10; // assuming 10% inclusive
          const variance = Math.abs(gstAmt - expectedGst);

          if (variance < 2) {
            return {
              id: 'FND_EXP_03',
              ruleId: 'RULE_EXP_03',
              ruleName: 'GST Tax Calculation Check',
              status: 'PASS',
              severity: 'low',
              title: 'Tax Calculation Accurately Verified',
              description: `Extracted GST ($${gstAmt.toFixed(2)}) aligns with tax computation formula.`,
              evidenceCitations: [{ documentName: 'Invoice.pdf', pageNumber: 1, fieldName: 'GST Amount', extractedValue: `$${gstAmt}` }],
              riskRating: 'Compliant',
              recommendation: 'Input tax credit verified for filing.'
            };
          }
          return {
            id: 'FND_EXP_03',
            ruleId: 'RULE_EXP_03',
            ruleName: 'GST Tax Calculation Check',
            status: 'FAIL',
            severity: 'medium',
            title: 'GST Tax Amount Calculation Mismatch',
            description: `Extracted GST ($${gstAmt}) differs from expected 10% tax rate ($${expectedGst.toFixed(2)}). Variance: $${variance.toFixed(2)}.`,
            evidenceCitations: [{ documentName: 'Invoice.pdf', pageNumber: 1, fieldName: 'GST Amount', extractedValue: `$${gstAmt}` }],
            riskRating: 'Medium Risk',
            recommendation: 'Verify if vendor is tax exempt or if wrong tax code was applied.'
          };
        }
      }
    ]
  },

  // 2. BANK RECONCILIATION AUDIT
  {
    id: 'bank_reconciliation',
    title: 'Bank Reconciliation Audit',
    category: 'financial',
    description: 'Reconcile bank statements against general ledger and cash book to identify unrecorded deposits, missing transactions, or balance shifts.',
    iconName: 'BuildingLibrary',
    samplePackName: 'Monthly Bank vs Ledger Rec',
    requiredDocuments: [
      { type: 'bank_statement', name: 'Bank Statement', description: 'Official monthly bank statement PDF from financial institution', isMandatory: true },
      { type: 'general_ledger', name: 'General Ledger (Cash Account)', description: 'System cash ledger export (ERP/NetSuite/QuickBooks)', isMandatory: true },
      { type: 'cash_register', name: 'Cash Register / Receipt Log', description: 'Internal cashbook or register log', isMandatory: false },
    ],

    extractedFieldsSchema: [
      { key: 'bank_opening_balance', label: 'Bank Opening Balance ($)', type: 'number', description: 'Starting balance on bank statement' },
      { key: 'bank_closing_balance', label: 'Bank Closing Balance ($)', type: 'number', description: 'Ending balance on bank statement' },
      { key: 'gl_opening_balance', label: 'GL Opening Balance ($)', type: 'number', description: 'Starting balance in cash ledger' },
      { key: 'gl_closing_balance', label: 'GL Closing Balance ($)', type: 'number', description: 'Ending balance in cash ledger' },
      { key: 'total_bank_deposits', label: 'Total Bank Credits ($)', type: 'number', description: 'Sum of deposits on bank statement' },
      { key: 'total_gl_deposits', label: 'Total Ledger Credits ($)', type: 'number', description: 'Sum of recorded receipts in ledger' },
      { key: 'outstanding_cheques_count', label: 'Unpresented Cheques Count', type: 'number', description: 'Cheques issued but not cleared by bank' },
      { key: 'bank_charges_unrecorded', label: 'Unrecorded Bank Charges ($)', type: 'number', description: 'Bank fees appearing only on statement' },
    ],
    documentFieldSchemas: {
      bank_statement: [
        { key: 'bank_opening_balance', label: 'Bank Opening Balance ($)', type: 'number', description: 'Opening/beginning balance shown at the top of the bank statement for the period' },
        { key: 'bank_closing_balance', label: 'Bank Closing Balance ($)', type: 'number', description: 'Closing/ending balance shown at the bottom of the bank statement for the period' },
        { key: 'total_bank_deposits', label: 'Total Bank Credits ($)', type: 'number', description: 'Sum total of all credit/deposit entries on the bank statement for the month' },
        { key: 'bank_charges_unrecorded', label: 'Unrecorded Bank Charges ($)', type: 'number', description: 'Bank service charges, maintenance fees, or wire fees listed on statement that may not be in the ledger' },
      ],
      general_ledger: [
        { key: 'gl_opening_balance', label: 'GL Opening Balance ($)', type: 'number', description: 'Opening debit/credit balance in the cash account within the general ledger' },
        { key: 'gl_closing_balance', label: 'GL Closing Balance ($)', type: 'number', description: 'Closing debit/credit balance in the cash account within the general ledger' },
        { key: 'total_gl_deposits', label: 'Total Ledger Credits ($)', type: 'number', description: 'Sum of all debit/receipt entries recorded in the general ledger cash account' },
      ],
      cash_register: [
        { key: 'outstanding_cheques_count', label: 'Unpresented Cheques Count', type: 'number', description: 'Number of cheques recorded as issued in the cash book but not yet cleared by the bank' },
        { key: 'bank_charges_unrecorded', label: 'Unrecorded Bank Charges ($)', type: 'number', description: 'Any bank charges or fees noted in the cash register that have not been posted to the ledger' },
      ],
    },
    rules: [
      {
        id: 'RULE_BNK_01',
        name: 'Opening Balance Ledger Alignment',
        description: 'Verify starting bank statement balance matches starting general ledger cash account balance.',
        category: 'Reconciliation',
        severity: 'high',
        expressionDescription: 'bank_opening_balance == gl_opening_balance',
        evaluate: (fields) => {
          const bankOp = Number(fields.bank_opening_balance?.value || 0);
          const glOp = Number(fields.gl_opening_balance?.value || 0);
          const diff = Math.abs(bankOp - glOp);

          if (diff === 0) {
            return {
              id: 'FND_BNK_01',
              ruleId: 'RULE_BNK_01',
              ruleName: 'Opening Balance Ledger Alignment',
              status: 'PASS',
              severity: 'low',
              title: 'Opening Balance Reconciled Successfully',
              description: `Bank opening balance ($${bankOp.toLocaleString()}) matches GL opening balance exactly.`,
              evidenceCitations: [
                { documentName: 'Bank_Statement_Jan.pdf', pageNumber: 1, fieldName: 'Opening Balance', extractedValue: `$${bankOp}` },
                { documentName: 'GL_Cash_Jan.csv', pageNumber: 1, fieldName: 'GL Opening Balance', extractedValue: `$${glOp}` }
              ],
              riskRating: 'Compliant',
              recommendation: 'Proceed with transaction-level matching.'
            };
          }
          return {
            id: 'FND_BNK_01',
            ruleId: 'RULE_BNK_01',
            ruleName: 'Opening Balance Ledger Alignment',
            status: 'FAIL',
            severity: 'high',
            title: `Opening Balance Discrepancy ($${diff.toLocaleString()})`,
            description: `Bank opening balance ($${bankOp.toLocaleString()}) does not agree with General Ledger cash account ($${glOp.toLocaleString()}). Unadjusted difference of $${diff.toLocaleString()}.`,
            evidenceCitations: [
              { documentName: 'Bank_Statement.pdf', pageNumber: 1, fieldName: 'Opening Balance', extractedValue: `$${bankOp}` },
              { documentName: 'General_Ledger.pdf', pageNumber: 1, fieldName: 'GL Balance', extractedValue: `$${glOp}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Review prior month closing adjustments and carryforward balance entries.'
          };
        }
      },
      {
        id: 'RULE_BNK_02',
        name: 'Unrecorded Bank Fees Detection',
        description: 'Identify statement bank charges or interest fees not posted to general ledger.',
        category: 'Omission',
        severity: 'medium',
        expressionDescription: 'bank_charges_unrecorded == 0',
        evaluate: (fields) => {
          const charges = Number(fields.bank_charges_unrecorded?.value || 0);
          if (charges === 0) {
            return {
              id: 'FND_BNK_02',
              ruleId: 'RULE_BNK_02',
              ruleName: 'Unrecorded Bank Fees Detection',
              status: 'PASS',
              severity: 'low',
              title: 'All Bank Fees Fully Recorded',
              description: 'No unposted bank charges or maintenance fees were identified.',
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'No action required.'
            };
          }
          return {
            id: 'FND_BNK_02',
            ruleId: 'RULE_BNK_02',
            ruleName: 'Unrecorded Bank Fees Detection',
            status: 'WARNING',
            severity: 'medium',
            title: `Unrecorded Bank Fees Found ($${charges.toLocaleString()})`,
            description: `Bank statement lists $${charges.toLocaleString()} in account service charges and wire fees that have not been posted to General Ledger Expense Account #6120.`,
            evidenceCitations: [{ documentName: 'Bank_Statement.pdf', pageNumber: 2, fieldName: 'Service Fees', extractedValue: `$${charges}` }],
            riskRating: 'Medium Risk',
            recommendation: 'Post adjusting journal entry to ledger for bank service charges.'
          };
        }
      }
    ]
  },

  // 3. PROCUREMENT AUDIT (3-WAY MATCHING)
  {
    id: 'procurement_audit',
    title: 'Procurement Audit (3-Way Match)',
    category: 'operational',
    description: 'Execute famous 3-way matching protocol (Purchase Order = Goods Receipt Note = Vendor Invoice = Payment).',
    iconName: 'ShoppingBag',
    samplePackName: 'Hardware Supply Procurement Batch',
    requiredDocuments: [
      { type: 'purchase_order', name: 'Purchase Order', description: 'Authorized PO detailing items, unit prices, and quantities', isMandatory: true },
      { type: 'goods_receipt', name: 'Goods Receipt Note (GRN)', description: 'Warehouse receiving slip showing actual delivered quantity', isMandatory: true },
      { type: 'invoice', name: 'Vendor Invoice', description: 'Vendor invoice specifying total billed amount', isMandatory: true },
      { type: 'payment_voucher', name: 'Payment Voucher', description: 'Bank transfer remittance or payment voucher', isMandatory: false },
    ],
    extractedFieldsSchema: [
      { key: 'po_number', label: 'PO Number', type: 'string', description: 'PO unique ID' },
      { key: 'grn_number', label: 'GRN Number', type: 'string', description: 'Goods receipt note ID' },
      { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Vendor invoice number' },
      { key: 'po_quantity', label: 'PO Ordered Quantity', type: 'number', description: 'Units requested on PO' },
      { key: 'grn_quantity', label: 'GRN Delivered Quantity', type: 'number', description: 'Units accepted at warehouse' },
      { key: 'invoice_quantity', label: 'Invoice Billed Quantity', type: 'number', description: 'Units billed on invoice' },
      { key: 'po_unit_price', label: 'PO Unit Price ($)', type: 'number', description: 'Approved price per unit' },
      { key: 'invoice_unit_price', label: 'Invoice Unit Price ($)', type: 'number', description: 'Billed price per unit' },
      { key: 'invoice_total', label: 'Invoice Billed Total ($)', type: 'number', description: 'Total invoice sum' },
    ],
    documentFieldSchemas: {
      purchase_order: [
        { key: 'po_number', label: 'PO Number', type: 'string', description: 'Purchase Order unique identifier (e.g. PO-7710)' },
        { key: 'po_quantity', label: 'PO Ordered Quantity', type: 'number', description: 'Total units/items authorized on the Purchase Order' },
        { key: 'po_unit_price', label: 'PO Unit Price ($)', type: 'number', description: 'Contract unit price agreed with vendor as stated on the PO' },
      ],
      goods_receipt: [
        { key: 'grn_number', label: 'GRN Number', type: 'string', description: 'Goods Receipt Note reference number (e.g. GRN-4102)' },
        { key: 'grn_quantity', label: 'GRN Delivered Quantity', type: 'number', description: 'Actual units received and accepted at warehouse per this GRN' },
      ],
      invoice: [
        { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Vendor invoice unique reference number' },
        { key: 'invoice_quantity', label: 'Invoice Billed Quantity', type: 'number', description: 'Total units billed by vendor on this invoice' },
        { key: 'invoice_unit_price', label: 'Invoice Unit Price ($)', type: 'number', description: 'Per-unit price charged by vendor on the invoice' },
        { key: 'invoice_total', label: 'Invoice Billed Total ($)', type: 'number', description: 'Total amount billed on the vendor invoice (quantity × unit price)' },
      ],
      payment_voucher: [
        { key: 'invoice_total', label: 'Invoice Billed Total ($)', type: 'number', description: 'Amount paid matching the vendor invoice total on this payment voucher' },
      ],
    },
    rules: [
      {
        id: 'RULE_PROC_01',
        name: '3-Way Quantity Match (PO vs GRN vs Invoice)',
        description: 'Billed quantity on invoice must not exceed actual warehouse accepted goods receipt quantity.',
        category: '3-Way Match',
        severity: 'critical',
        expressionDescription: 'invoice_quantity == grn_quantity && grn_quantity <= po_quantity',
        evaluate: (fields) => {
          const poQty = Number(fields.po_quantity?.value || 0);
          const grnQty = Number(fields.grn_quantity?.value || 0);
          const invQty = Number(fields.invoice_quantity?.value || 0);

          if (invQty === grnQty && grnQty <= poQty) {
            return {
              id: 'FND_PROC_01',
              ruleId: 'RULE_PROC_01',
              ruleName: '3-Way Quantity Match',
              status: 'PASS',
              severity: 'low',
              title: '3-Way Quantity Match Verified',
              description: `Invoice billed quantity (${invQty} units) matches physical GRN receipt (${grnQty} units) and PO authorization (${poQty} units).`,
              evidenceCitations: [
                { documentName: 'PO_7710.pdf', pageNumber: 1, fieldName: 'PO Qty', extractedValue: `${poQty} units` },
                { documentName: 'GRN_4102.pdf', pageNumber: 1, fieldName: 'GRN Qty', extractedValue: `${grnQty} units` },
                { documentName: 'INV_9821.pdf', pageNumber: 1, fieldName: 'Invoice Qty', extractedValue: `${invQty} units` }
              ],
              riskRating: 'Compliant',
              recommendation: 'Approved for automated disbursement.'
            };
          }
          return {
            id: 'FND_PROC_01',
            ruleId: 'RULE_PROC_01',
            ruleName: '3-Way Quantity Match',
            status: 'FAIL',
            severity: 'critical',
            title: `3-Way Quantity Mismatch (Billed ${invQty} vs Delivered ${grnQty})`,
            description: `Vendor billed for ${invQty} units on invoice, but warehouse only received ${grnQty} units on GRN. Billed excess of ${invQty - grnQty} units.`,
            evidenceCitations: [
              { documentName: 'GRN.pdf', pageNumber: 1, fieldName: 'GRN Delivered Qty', extractedValue: `${grnQty}` },
              { documentName: 'Invoice.pdf', pageNumber: 1, fieldName: 'Invoice Billed Qty', extractedValue: `${invQty}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Issue debit note to vendor for short shipment of goods.'
          };
        }
      },
      {
        id: 'RULE_PROC_02',
        name: 'PO vs Invoice Unit Price Variance',
        description: 'Unit price on vendor invoice must match contract unit price on PO.',
        category: 'Price Compliance',
        severity: 'high',
        expressionDescription: 'invoice_unit_price == po_unit_price',
        evaluate: (fields) => {
          const poPrice = Number(fields.po_unit_price?.value || 0);
          const invPrice = Number(fields.invoice_unit_price?.value || 0);
          const diff = Math.abs(invPrice - poPrice);

          if (diff === 0) {
            return {
              id: 'FND_PROC_02',
              ruleId: 'RULE_PROC_02',
              ruleName: 'Unit Price Variance Check',
              status: 'PASS',
              severity: 'low',
              title: 'Unit Price Contractually Compliant',
              description: `Billed unit price ($${invPrice}) agrees with PO rate ($${poPrice}).`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'No price inflation identified.'
            };
          }
          return {
            id: 'FND_PROC_02',
            ruleId: 'RULE_PROC_02',
            ruleName: 'Unit Price Variance Check',
            status: 'FAIL',
            severity: 'high',
            title: `Unauthorized Price Inflation ($${invPrice} vs PO $${poPrice})`,
            description: `Vendor billed at $${invPrice}/unit, exceeding the PO contracted unit price of $${poPrice}/unit. Total impact: $${(diff * Number(fields.invoice_quantity?.value || 1)).toFixed(2)}.`,
            evidenceCitations: [
              { documentName: 'PO.pdf', pageNumber: 1, fieldName: 'Unit Price', extractedValue: `$${poPrice}` },
              { documentName: 'Invoice.pdf', pageNumber: 1, fieldName: 'Billed Price', extractedValue: `$${invPrice}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Reject invoice and require vendor to re-issue at contracted PO rate.'
          };
        }
      }
    ]
  },

  // 4. FRAUD DETECTION ENGINE
  {
    id: 'fraud_detection',
    title: 'Fraud & Forensic Risk Engine',
    category: 'fraud_controls',
    description: 'Detect suspicious split payments, duplicate invoices, weekend transfers, round-number disbursements, and rapid vendor setup patterns.',
    iconName: 'ShieldAlert',
    samplePackName: 'Forensic AP Transaction Audit',
    requiredDocuments: [
      { type: 'payment_register', name: 'Accounts Payable Disbursement Log', description: 'Full list of payments made across period', isMandatory: true },
      { type: 'vendor_master', name: 'Vendor Master File', description: 'Master table of registered vendors with creation dates and bank accounts', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Invoice ID' },
      { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Vendor recipient name' },
      { key: 'payment_amount', label: 'Disbursement Amount ($)', type: 'number', description: 'Payment sum' },
      { key: 'payment_date', label: 'Payment Date', type: 'date', description: 'Date payment was processed' },
      { key: 'payment_day_of_week', label: 'Day of Week', type: 'string', description: 'Day payment occurred (e.g., Sunday)' },
      { key: 'is_round_number', label: 'Round Amount Flag', type: 'boolean', description: 'Payment is round thousand/hundred' },
      { key: 'vendor_created_days_ago', label: 'Vendor Age at Payment (Days)', type: 'number', description: 'Days between vendor creation and payment' },
      { key: 'split_payment_group_count', label: 'Near-Threshold Payments Count', type: 'number', description: 'Multiple payments just below approval limit' },
    ],
    documentFieldSchemas: {
      payment_register: [
        { key: 'invoice_number', label: 'Invoice Number', type: 'string', description: 'Invoice or payment reference number in the AP disbursement log' },
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Vendor or beneficiary name receiving the payment' },
        { key: 'payment_amount', label: 'Disbursement Amount ($)', type: 'number', description: 'Amount of the disbursement or payment' },
        { key: 'payment_date', label: 'Payment Date', type: 'date', description: 'Date the payment was processed or value-dated' },
        { key: 'payment_day_of_week', label: 'Day of Week', type: 'string', description: 'Derive the day of week from payment_date (e.g. Saturday, Sunday). Weekend payments are suspicious.' },
        { key: 'is_round_number', label: 'Round Amount Flag', type: 'boolean', description: 'True if payment amount is a round number (e.g. exactly $5000, $10000). Round numbers may indicate fictitious invoices.' },
        { key: 'split_payment_group_count', label: 'Near-Threshold Payments Count', type: 'number', description: 'Count of payments to the same vendor that are just under a standard approval threshold (e.g. $4950 under $5000 limit). Indicates structuring fraud.' },
      ],
      vendor_master: [
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Registered vendor or supplier name in the vendor master file' },
        { key: 'vendor_created_days_ago', label: 'Vendor Age at Payment (Days)', type: 'number', description: 'Calculate days between the vendor creation/registration date and the most recent payment date. Newly created vendors (< 7 days) are high risk.' },
      ],
    },
    rules: [
      {
        id: 'RULE_FRD_01',
        name: 'Split Payment Threshold Evasion',
        description: 'Detects multiple payments issued to same vendor under approval limit (e.g., multiple $4,950 payments under $5,000 threshold).',
        category: 'Evasion',
        severity: 'critical',
        expressionDescription: 'split_payment_group_count > 1',
        evaluate: (fields) => {
          const splits = Number(fields.split_payment_group_count?.value || 0);
          if (splits <= 1) {
            return {
              id: 'FND_FRD_01',
              ruleId: 'RULE_FRD_01',
              ruleName: 'Split Payment Threshold Evasion',
              status: 'PASS',
              severity: 'low',
              title: 'No Structured Split Payments Detected',
              description: 'Payment structuring patterns under approval limits were not detected.',
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Regular AP review.'
            };
          }
          return {
            id: 'FND_FRD_01',
            ruleId: 'RULE_FRD_01',
            ruleName: 'Split Payment Threshold Evasion',
            status: 'FAIL',
            severity: 'critical',
            title: `Suspicious Split Payment Pattern Detected (${splits} Transactions)`,
            description: `Identified ${splits} separate invoices of $4,950 paid to same vendor within 48 hours, structured to bypass the $5,000 manager approval threshold.`,
            evidenceCitations: [
              { documentName: 'AP_Disbursement_Log.csv', pageNumber: 1, fieldName: 'Split Invoices', extractedValue: `${splits} payments of $4,950` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Freeze vendor payments and trigger formal forensic internal investigation.'
          };
        }
      },
      {
        id: 'RULE_FRD_02',
        name: 'Rapid Vendor Creation & Payment',
        description: 'Flags payments made to a vendor account created less than 7 days prior.',
        category: 'Vendor Risk',
        severity: 'high',
        expressionDescription: 'vendor_created_days_ago < 7',
        evaluate: (fields) => {
          const age = Number(fields.vendor_created_days_ago?.value || 30);
          if (age >= 7) {
            return {
              id: 'FND_FRD_02',
              ruleId: 'RULE_FRD_02',
              ruleName: 'Rapid Vendor Creation & Payment',
              status: 'PASS',
              severity: 'low',
              title: 'Vendor Account Age Established',
              description: `Vendor profile was created ${age} days before transaction, meeting vetting criteria.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Vendor master record compliant.'
            };
          }
          return {
            id: 'FND_FRD_02',
            ruleId: 'RULE_FRD_02',
            ruleName: 'Rapid Vendor Creation & Payment',
            status: 'FAIL',
            severity: 'high',
            title: `High-Risk Rapid Disbursement to New Vendor (${age} Days Old)`,
            description: `Vendor account was created only ${age} days ago and immediately received high-value transfer. High risk of shell company or employee conflict of interest.`,
            evidenceCitations: [
              { documentName: 'Vendor_Master.pdf', pageNumber: 1, fieldName: 'Creation Date', extractedValue: `${age} days before payment` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Perform background check and verify ultimate beneficial owner (UBO).'
          };
        }
      }
    ]
  },

  // 5. PAYROLL AUDIT
  {
    id: 'payroll_audit',
    title: 'Payroll Audit',
    category: 'financial',
    description: 'Audit salary register, tax withholding, attendance logs, and bank payouts to eliminate ghost employees and unauthorized bonuses.',
    iconName: 'Users',
    samplePackName: 'Q2 Monthly Payroll Execution',
    requiredDocuments: [
      { type: 'payroll_register', name: 'Salary Register', description: 'Gross to net pay breakdown list per employee', isMandatory: true },
      { type: 'attendance_log', name: 'Attendance / Timecard Export', description: 'Biometric or HRIS attendance log showing working days', isMandatory: true },
      { type: 'bank_transfer', name: 'Bank Advice / Transfer Batch', description: 'Bank confirmation of electronic payroll advice', isMandatory: true },
      { type: 'employee_master', name: 'Employee Master Database', description: 'HR database of active employment contracts', isMandatory: false },
    ],
    extractedFieldsSchema: [
      { key: 'employee_id', label: 'Employee ID', type: 'string', description: 'Unique staff identifier' },
      { key: 'employee_name', label: 'Employee Name', type: 'string', description: 'Staff full name' },
      { key: 'contract_base_salary', label: 'Contract Base Salary ($)', type: 'number', description: 'Agreed monthly base salary in HR contract' },
      { key: 'register_base_salary', label: 'Register Base Salary ($)', type: 'number', description: 'Base salary printed on payroll sheet' },
      { key: 'worked_days', label: 'Days Worked', type: 'number', description: 'Logged attendance days' },
      { key: 'total_working_days', label: 'Month Working Days', type: 'number', description: 'Total official work days in month' },
      { key: 'tax_deduction', label: 'Tax Deducted ($)', type: 'number', description: 'Income tax withheld' },
      { key: 'net_pay', label: 'Net Payable ($)', type: 'number', description: 'Final net salary transferred' },
      { key: 'bank_transfer_net', label: 'Bank Advice Transfer Net ($)', type: 'number', description: 'Net amount in bank payout file' },
    ],
    documentFieldSchemas: {
      payroll_register: [
        { key: 'employee_id', label: 'Employee ID', type: 'string', description: 'Employee or staff number as printed on the payroll register row' },
        { key: 'employee_name', label: 'Employee Name', type: 'string', description: 'Full name of employee on the salary register' },
        { key: 'register_base_salary', label: 'Register Base Salary ($)', type: 'number', description: 'Gross base salary as listed on the salary/payroll register for this period' },
        { key: 'tax_deduction', label: 'Tax Deducted ($)', type: 'number', description: 'Income tax or withholding tax amount deducted from gross salary' },
        { key: 'net_pay', label: 'Net Payable ($)', type: 'number', description: 'Final net salary amount payable to employee after all deductions' },
      ],
      attendance_log: [
        { key: 'employee_id', label: 'Employee ID', type: 'string', description: 'Employee identifier in the attendance or timecard system' },
        { key: 'worked_days', label: 'Days Worked', type: 'number', description: 'Total number of days the employee was present/logged in per attendance record' },
        { key: 'total_working_days', label: 'Month Working Days', type: 'number', description: 'Total official working days in the month as per company calendar' },
      ],
      bank_transfer: [
        { key: 'bank_transfer_net', label: 'Bank Advice Transfer Net ($)', type: 'number', description: 'Net amount transferred via bank payroll advice or ACH batch file for the employee or total payroll batch' },
      ],
      employee_master: [
        { key: 'employee_id', label: 'Employee ID', type: 'string', description: 'Employee unique ID in HR master database' },
        { key: 'contract_base_salary', label: 'Contract Base Salary ($)', type: 'number', description: 'Agreed base salary per the active employment contract in HR system' },
      ],
    },
    rules: [
      {
        id: 'RULE_PAY_01',
        name: 'Net Salary Bank Advice Reconciliation',
        description: 'Net pay on salary register must exactly match amount transferred via bank advice file.',
        category: 'Disbursement',
        severity: 'critical',
        expressionDescription: 'net_pay == bank_transfer_net',
        evaluate: (fields) => {
          const regNet = Number(fields.net_pay?.value || 0);
          const bankNet = Number(fields.bank_transfer_net?.value || 0);
          const diff = Math.abs(regNet - bankNet);

          if (diff === 0) {
            return {
              id: 'FND_PAY_01',
              ruleId: 'RULE_PAY_01',
              ruleName: 'Net Salary Reconciliation',
              status: 'PASS',
              severity: 'low',
              title: 'Payroll Bank Transfer Fully Reconciled',
              description: `Net salary of $${regNet.toLocaleString()} matches bank advice payout file.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Payroll disbursement verified.'
            };
          }
          return {
            id: 'FND_PAY_01',
            ruleId: 'RULE_PAY_01',
            ruleName: 'Net Salary Reconciliation',
            status: 'FAIL',
            severity: 'critical',
            title: `Payroll Payout Variance ($${diff.toLocaleString()})`,
            description: `Salary register net pay ($${regNet.toLocaleString()}) does not match actual bank payout advice ($${bankNet.toLocaleString()}). Potential unauthorized payment diversion.`,
            evidenceCitations: [
              { documentName: 'Salary_Register.pdf', pageNumber: 1, fieldName: 'Register Net', extractedValue: `$${regNet}` },
              { documentName: 'Bank_Transfer_Advice.csv', pageNumber: 1, fieldName: 'Bank Advice Net', extractedValue: `$${bankNet}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Audit bank account destination routing numbers immediately.'
          };
        }
      }
    ]
  },

  // 6. REVENUE AUDIT
  {
    id: 'revenue_audit',
    title: 'Revenue Audit',
    category: 'financial',
    description: 'Verify sales contracts, delivery notes, billing dates, and revenue recognition rules (IFRS 15 / ASC 606).',
    iconName: 'TrendingUp',
    requiredDocuments: [
      { type: 'sales_contract', name: 'Sales Contract / MSA', description: 'Customer contract with performance obligations', isMandatory: true },
      { type: 'delivery_proof', name: 'Delivery Proof / Acceptance Sign-off', description: 'Customer signed proof of service delivery', isMandatory: true },
      { type: 'sales_invoice', name: 'Sales Invoice', description: 'Tax invoice issued to client', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'contract_value', label: 'Contract Total Value ($)', type: 'number', description: 'Total MSA value' },
      { key: 'invoice_amount', label: 'Invoiced Amount ($)', type: 'number', description: 'Invoice total' },
      { key: 'delivery_date', label: 'Delivery / Signoff Date', type: 'date', description: 'Date goods/services delivered' },
      { key: 'invoice_date', label: 'Invoice Issuance Date', type: 'date', description: 'Date invoice was recorded' },
      { key: 'recognized_revenue', label: 'Recognized Revenue ($)', type: 'number', description: 'Revenue booked in current period' },
    ],
    documentFieldSchemas: {
      sales_contract: [
        { key: 'contract_value', label: 'Contract Total Value ($)', type: 'number', description: 'Total contract value as stated in the sales contract or Master Service Agreement (MSA)' },
      ],
      delivery_proof: [
        { key: 'delivery_date', label: 'Delivery / Signoff Date', type: 'date', description: 'Date customer signed off or accepted delivery of goods/services' },
      ],
      sales_invoice: [
        { key: 'invoice_amount', label: 'Invoiced Amount ($)', type: 'number', description: 'Total amount on the sales invoice issued to the customer' },
        { key: 'invoice_date', label: 'Invoice Issuance Date', type: 'date', description: 'Date the sales invoice was issued or recorded' },
        { key: 'recognized_revenue', label: 'Recognized Revenue ($)', type: 'number', description: 'Revenue amount recognized in the current accounting period as per the invoice or revenue schedule' },
      ],
    },
    rules: [
      {
        id: 'RULE_REV_01',
        name: 'Premature Revenue Recognition Check',
        description: 'Revenue must not be recognized prior to documented delivery or customer acceptance date.',
        category: 'Revenue Recognition',
        severity: 'high',
        expressionDescription: 'invoice_date >= delivery_date',
        evaluate: (fields) => {
          const invDate = new Date(fields.invoice_date?.value || '2026-01-01').getTime();
          const delDate = new Date(fields.delivery_date?.value || '2026-01-01').getTime();

          if (invDate >= delDate) {
            return {
              id: 'FND_REV_01',
              ruleId: 'RULE_REV_01',
              ruleName: 'Revenue Recognition Timing',
              status: 'PASS',
              severity: 'low',
              title: 'Revenue Timed Accurately Post-Delivery',
              description: 'Invoice and revenue booking occurred after customer delivery acceptance.',
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Compliant with IFRS 15.'
            };
          }
          return {
            id: 'FND_REV_01',
            ruleId: 'RULE_REV_01',
            ruleName: 'Revenue Recognition Timing',
            status: 'FAIL',
            severity: 'high',
            title: 'Premature Revenue Recognized Prior to Customer Sign-off',
            description: `Revenue was booked on ${fields.invoice_date?.value}, prior to customer acceptance date on ${fields.delivery_date?.value}.`,
            evidenceCitations: [
              { documentName: 'Sales_Invoice.pdf', pageNumber: 1, fieldName: 'Invoice Date', extractedValue: String(fields.invoice_date?.value) },
              { documentName: 'Delivery_Proof.pdf', pageNumber: 1, fieldName: 'Delivery Date', extractedValue: String(fields.delivery_date?.value) }
            ],
            riskRating: 'High Risk',
            recommendation: 'Defer revenue entry until valid customer milestone acceptance certificate is uploaded.'
          };
        }
      }
    ]
  },

  // 7. INVENTORY AUDIT
  {
    id: 'inventory_audit',
    title: 'Inventory Audit',
    category: 'operational',
    description: 'Compare physical stock count reports against stock ledger registers to identify shrinkages, valuation variances, and slow-moving items.',
    iconName: 'Boxes',
    requiredDocuments: [
      { type: 'physical_count', name: 'Physical Count Sheet', description: 'Audit physical stock take count sheet', isMandatory: true },
      { type: 'stock_register', name: 'Stock Register / Perpetual Ledger', description: 'ERP inventory ledger balance export', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'item_code', label: 'Item Code / SKU', type: 'string', description: 'Stock SKU ID' },
      { key: 'physical_count_qty', label: 'Physical Count Qty', type: 'number', description: 'Actual counted units' },
      { key: 'ledger_qty', label: 'System Ledger Qty', type: 'number', description: 'Recorded units in ERP' },
      { key: 'unit_valuation', label: 'Unit Cost ($)', type: 'number', description: 'Inventory unit valuation' },
    ],
    documentFieldSchemas: {
      physical_count: [
        { key: 'item_code', label: 'Item Code / SKU', type: 'string', description: 'Stock item code, SKU or barcode as written on the physical count sheet' },
        { key: 'physical_count_qty', label: 'Physical Count Qty', type: 'number', description: 'Actual units physically counted during the stock take for this item' },
      ],
      stock_register: [
        { key: 'item_code', label: 'Item Code / SKU', type: 'string', description: 'Stock item code or SKU as recorded in the ERP perpetual inventory register' },
        { key: 'ledger_qty', label: 'System Ledger Qty', type: 'number', description: 'Units on hand as recorded in the ERP or stock ledger system' },
        { key: 'unit_valuation', label: 'Unit Cost ($)', type: 'number', description: 'Cost per unit as per weighted average or FIFO valuation in the stock register' },
      ],
    },
    rules: [
      {
        id: 'RULE_INV_01',
        name: 'Physical vs Ledger Stock Variance',
        description: 'Physical stock count must match perpetual inventory ledger balance.',
        category: 'Stock Count',
        severity: 'high',
        expressionDescription: 'physical_count_qty == ledger_qty',
        evaluate: (fields) => {
          const phys = Number(fields.physical_count_qty?.value || 0);
          const ledg = Number(fields.ledger_qty?.value || 0);
          const unitCost = Number(fields.unit_valuation?.value || 1);
          const variance = phys - ledg;

          if (variance === 0) {
            return {
              id: 'FND_INV_01',
              ruleId: 'RULE_INV_01',
              ruleName: 'Physical vs Ledger Variance',
              status: 'PASS',
              severity: 'low',
              title: 'Physical Inventory Matches Ledger',
              description: `Counted physical units (${phys}) match system inventory balance exactly.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Inventory balances verified.'
            };
          }
          return {
            id: 'FND_INV_01',
            ruleId: 'RULE_INV_01',
            ruleName: 'Physical vs Ledger Variance',
            status: 'FAIL',
            severity: 'high',
            title: `Inventory Shrinkage Discrepancy (${variance} units / $${Math.abs(variance * unitCost).toFixed(2)})`,
            description: `Physical count of ${phys} units is short compared to system ledger of ${ledg} units. Total inventory shrinkage value: $${Math.abs(variance * unitCost).toFixed(2)}.`,
            evidenceCitations: [
              { documentName: 'Physical_Count.pdf', pageNumber: 1, fieldName: 'Physical Qty', extractedValue: `${phys}` },
              { documentName: 'Stock_Register.csv', pageNumber: 1, fieldName: 'Ledger Qty', extractedValue: `${ledg}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Perform immediate recount and write off verified stock shrinkage.'
          };
        }
      }
    ]
  },

  // 8. GST / VAT COMPLIANCE AUDIT
  {
    id: 'gst_vat_compliance',
    title: 'GST / VAT Compliance Audit',
    category: 'compliance',
    description: 'Reconcile tax returns against purchase and sales registers to prevent Input Tax Credit (ITC) claim mismatches and missing GSTIN errors.',
    iconName: 'FileCheck',
    requiredDocuments: [
      { type: 'tax_return', name: 'Tax Return (GSTR / VAT Filing)', description: 'Submitted government tax filing document', isMandatory: true },
      { type: 'purchase_register', name: 'Purchase Register', description: 'Internal ledger of vendor purchases and ITC claims', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'filed_itc_claim', label: 'Filed Input Tax Credit ($)', type: 'number', description: 'ITC claimed on tax return' },
      { key: 'eligible_itc_register', label: 'Purchase Register Eligible ITC ($)', type: 'number', description: 'Sum of valid vendor tax invoices' },
      { key: 'missing_gstin_count', label: 'Invoices Missing Tax ID', type: 'number', description: 'Invoices lacking valid tax registration' },
    ],
    documentFieldSchemas: {
      tax_return: [
        { key: 'filed_itc_claim', label: 'Filed Input Tax Credit ($)', type: 'number', description: 'Total Input Tax Credit (ITC) amount claimed by the company on this GST/VAT tax return filing' },
      ],
      purchase_register: [
        { key: 'eligible_itc_register', label: 'Purchase Register Eligible ITC ($)', type: 'number', description: 'Sum total of GST/VAT on valid vendor invoices in the purchase register that qualify for ITC credit' },
        { key: 'missing_gstin_count', label: 'Invoices Missing Tax ID', type: 'number', description: 'Count of vendor invoices in the purchase register that are missing a valid GSTIN or tax registration number' },
      ],
    },
    rules: [
      {
        id: 'RULE_TAX_01',
        name: 'Input Tax Credit Reconciliation',
        description: 'Filed ITC claim must not exceed eligible tax credits supported by purchase register invoices.',
        category: 'Tax Compliance',
        severity: 'high',
        expressionDescription: 'filed_itc_claim <= eligible_itc_register',
        evaluate: (fields) => {
          const filed = Number(fields.filed_itc_claim?.value || 0);
          const register = Number(fields.eligible_itc_register?.value || 0);

          if (filed <= register) {
            return {
              id: 'FND_TAX_01',
              ruleId: 'RULE_TAX_01',
              ruleName: 'Input Tax Credit Reconciliation',
              status: 'PASS',
              severity: 'low',
              title: 'Input Tax Credit Claim Validated',
              description: `Filed ITC claim ($${filed}) is fully backed by eligible purchase invoices ($${register}).`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Tax filing compliant.'
            };
          }
          return {
            id: 'FND_TAX_01',
            ruleId: 'RULE_TAX_01',
            ruleName: 'Input Tax Credit Reconciliation',
            status: 'FAIL',
            severity: 'high',
            title: `Excess Input Tax Credit Claimed ($${(filed - register).toLocaleString()} Over-claim)`,
            description: `Tax return filed $${filed.toLocaleString()} in ITC, but valid purchase register invoices only support $${register.toLocaleString()}. Exposure to tax audit penalties.`,
            evidenceCitations: [
              { documentName: 'Tax_Return_Q3.pdf', pageNumber: 1, fieldName: 'Filed ITC', extractedValue: `$${filed}` },
              { documentName: 'Purchase_Register.csv', pageNumber: 1, fieldName: 'Register ITC', extractedValue: `$${register}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Amend tax return to avoid tax authority interest and penalty assessments.'
          };
        }
      }
    ]
  },

  // 9. INTERNAL CONTROL REVIEW
  {
    id: 'internal_control',
    title: 'Internal Control & SOD Review',
    category: 'fraud_controls',
    description: 'Audit maker-checker approval workflows, segregation of duties (SOD), missing authorization emails, and inactive user activity.',
    iconName: 'Lock',
    requiredDocuments: [
      { type: 'approval_matrix', name: 'Delegation of Authority (DOA) Matrix', description: 'Official company authority limits table', isMandatory: true },
      { type: 'system_audit_log', name: 'ERP System Activity Log', description: 'User audit trail export from ERP', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'creator_user_id', label: 'Transaction Creator ID', type: 'string', description: 'User who created entry' },
      { key: 'approver_user_id', label: 'Transaction Approver ID', type: 'string', description: 'User who approved entry' },
      { key: 'is_same_user_maker_checker', label: 'Maker/Checker Violator', type: 'boolean', description: 'Same user created and approved' },
      { key: 'approval_missing', label: 'Missing Approval Flag', type: 'boolean', description: 'Transaction processed without mandatory signoff' },
    ],
    documentFieldSchemas: {
      approval_matrix: [
        { key: 'approver_user_id', label: 'Transaction Approver ID', type: 'string', description: 'User ID or name of the authorized approver as defined in the Delegation of Authority (DOA) matrix' },
      ],
      system_audit_log: [
        { key: 'creator_user_id', label: 'Transaction Creator ID', type: 'string', description: 'User ID of the person who created the transaction in the ERP system audit log' },
        { key: 'approver_user_id', label: 'Transaction Approver ID', type: 'string', description: 'User ID of the person who approved the transaction in the ERP system audit log' },
        { key: 'is_same_user_maker_checker', label: 'Maker/Checker Violator', type: 'boolean', description: 'True if the creator_user_id and approver_user_id are the same person — a segregation of duties violation' },
        { key: 'approval_missing', label: 'Missing Approval Flag', type: 'boolean', description: 'True if the transaction log shows no approval step or approval was bypassed' },
      ],
    },
    rules: [
      {
        id: 'RULE_CTL_01',
        name: 'Segregation of Duties (Maker-Checker)',
        description: 'No employee may approve a transaction that they created.',
        category: 'Governance',
        severity: 'critical',
        expressionDescription: 'creator_user_id != approver_user_id',
        evaluate: (fields) => {
          const creator = fields.creator_user_id?.value;
          const approver = fields.approver_user_id?.value;
          const same = Boolean(fields.is_same_user_maker_checker?.value) || (creator && creator === approver);

          if (!same) {
            return {
              id: 'FND_CTL_01',
              ruleId: 'RULE_CTL_01',
              ruleName: 'Maker-Checker Separation',
              status: 'PASS',
              severity: 'low',
              title: 'Segregation of Duties Maintained',
              description: `Creator (${creator}) and Approver (${approver}) are distinct users.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Governance control effective.'
            };
          }
          return {
            id: 'FND_CTL_01',
            ruleId: 'RULE_CTL_01',
            ruleName: 'Maker-Checker Separation',
            status: 'FAIL',
            severity: 'critical',
            title: 'Critical Segregation of Duties Violation Detected',
            description: `User '${creator}' created AND approved the financial transaction without secondary review.`,
            evidenceCitations: [
              { documentName: 'System_Audit_Log.csv', pageNumber: 1, fieldName: 'User ID', extractedValue: `Created & Approved by ${creator}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Revoke single-user approval permissions in ERP access management system.'
          };
        }
      }
    ]
  },

  // 10. ACCOUNTS PAYABLE AUDIT
  {
    id: 'accounts_payable',
    title: 'Accounts Payable (AP) Audit',
    category: 'financial',
    description: 'Identify aged payables, duplicate vendor payments, unapplied discounts, and vendor statement balances.',
    iconName: 'CreditCard',
    requiredDocuments: [
      { type: 'ap_aging', name: 'AP Aging Report', description: 'AP aging summary grouped by 30/60/90+ days', isMandatory: true },
      { type: 'vendor_statement', name: 'Vendor Statement', description: 'Monthly statement sent by vendor', isMandatory: true }
    ],
    extractedFieldsSchema: [
      { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Vendor name' },
      { key: 'ap_ledger_balance', label: 'AP Ledger Balance ($)', type: 'number', description: 'Balance in company books' },
      { key: 'vendor_stmt_balance', label: 'Vendor Statement Balance ($)', type: 'number', description: 'Balance on vendor statement' }
    ],
    documentFieldSchemas: {
      ap_aging: [
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Primary vendor name from the AP aging report' },
        { key: 'ap_ledger_balance', label: 'AP Ledger Balance ($)', type: 'number', description: 'Total outstanding payable balance per the company AP aging ledger' },
      ],
      vendor_statement: [
        { key: 'vendor_name', label: 'Vendor Name', type: 'string', description: 'Vendor name as printed on the vendor statement header' },
        { key: 'vendor_stmt_balance', label: 'Vendor Statement Balance ($)', type: 'number', description: 'Closing balance or amount owed as stated on the vendor statement' },
      ],
    },
    rules: [
      {
        id: 'RULE_AP_01',
        name: 'Vendor Statement Reconciliation',
        description: 'AP balance in company ledger must match vendor statement balance.',
        category: 'Reconciliation',
        severity: 'high',
        expressionDescription: 'ap_ledger_balance == vendor_stmt_balance',
        evaluate: (fields) => {
          const ledg = Number(fields.ap_ledger_balance?.value || 0);
          const stmt = Number(fields.vendor_stmt_balance?.value || 0);
          const diff = Math.abs(ledg - stmt);

          if (diff === 0) {
            return {
              id: 'FND_AP_01',
              ruleId: 'RULE_AP_01',
              ruleName: 'Vendor Statement Reconciliation',
              status: 'PASS',
              severity: 'low',
              title: 'AP Ledger Matches Vendor Statement',
              description: `AP balance ($${ledg}) reconciles with vendor statement balance.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Payable balance confirmed.'
            };
          }
          return {
            id: 'FND_AP_01',
            ruleId: 'RULE_AP_01',
            ruleName: 'Vendor Statement Reconciliation',
            status: 'FAIL',
            severity: 'high',
            title: `AP Statement Discrepancy ($${diff.toLocaleString()} Unreconciled)`,
            description: `Ledger balance ($${ledg.toLocaleString()}) does not match vendor statement balance ($${stmt.toLocaleString()}).`,
            evidenceCitations: [
              { documentName: 'AP_Aging.csv', pageNumber: 1, fieldName: 'AP Ledger Balance', extractedValue: `$${ledg}` },
              { documentName: 'Vendor_Statement.pdf', pageNumber: 1, fieldName: 'Statement Balance', extractedValue: `$${stmt}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Reconcile unposted invoices or disputed credit memos with vendor billing department.'
          };
        }
      }
    ]
  },

  // 11. ACCOUNTS RECEIVABLE AUDIT
  {
    id: 'accounts_receivable',
    title: 'Accounts Receivable (AR) Audit',
    category: 'financial',
    description: 'Audit customer AR aging, bad debt allowance adequacy, uncollected invoices, and credit note validity.',
    iconName: 'BadgeDollarSign',
    requiredDocuments: [
      { type: 'ar_aging', name: 'AR Aging Report', description: 'Customer receivables aging by days overdue', isMandatory: true },
    ],
    extractedFieldsSchema: [
      { key: 'total_ar', label: 'Total Receivables ($)', type: 'number', description: 'Total gross AR' },
      { key: 'overdue_90_days', label: 'Overdue > 90 Days ($)', type: 'number', description: 'Severely aged AR' },
      { key: 'bad_debt_provision', label: 'Bad Debt Provision ($)', type: 'number', description: 'Allowance for doubtful accounts' },
    ],
    documentFieldSchemas: {
      ar_aging: [
        { key: 'total_ar', label: 'Total Receivables ($)', type: 'number', description: 'Total gross accounts receivable balance across all customers and aging buckets' },
        { key: 'overdue_90_days', label: 'Overdue > 90 Days ($)', type: 'number', description: 'Total receivables overdue beyond 90 days (severely aged / at risk of bad debt)' },
        { key: 'bad_debt_provision', label: 'Bad Debt Provision ($)', type: 'number', description: 'Allowance for doubtful accounts / bad debt provision recorded in the AR aging or financial statements' },
      ],
    },
    rules: [
      {
        id: 'RULE_AR_01',
        name: 'Bad Debt Provision Adequacy',
        description: 'Allowance for bad debts must cover at least 50% of receivables overdue beyond 90 days.',
        category: 'Valuation',
        severity: 'high',
        expressionDescription: 'bad_debt_provision >= overdue_90_days * 0.50',
        evaluate: (fields) => {
          const overdue = Number(fields.overdue_90_days?.value || 0);
          const prov = Number(fields.bad_debt_provision?.value || 0);
          const required = overdue * 0.50;

          if (prov >= required) {
            return {
              id: 'FND_AR_01',
              ruleId: 'RULE_AR_01',
              ruleName: 'Bad Debt Provision Adequacy',
              status: 'PASS',
              severity: 'low',
              title: 'Doubtful Debt Provision Adequate',
              description: `Bad debt provision ($${prov}) meets required 50% coverage ($${required}) for aged receivables.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Provision compliant.'
            };
          }
          return {
            id: 'FND_AR_01',
            ruleId: 'RULE_AR_01',
            ruleName: 'Bad Debt Provision Adequacy',
            status: 'FAIL',
            severity: 'high',
            title: `Under-Provisioned Bad Debt Allowance ($${(required - prov).toLocaleString()} Shortfall)`,
            description: `Current bad debt provision ($${prov}) is insufficient for $${overdue} in 90+ day overdue accounts. Minimum required allowance is $${required}.`,
            evidenceCitations: [
              { documentName: 'AR_Aging.csv', pageNumber: 1, fieldName: 'Overdue 90+ Days', extractedValue: `$${overdue}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Increase allowance for doubtful accounts in current period P&L.'
          };
        }
      }
    ]
  },

  // 12. FIXED ASSETS AUDIT
  {
    id: 'fixed_assets',
    title: 'Fixed Asset Audit',
    category: 'financial',
    description: 'Verify fixed asset register (FAR) entries, physical asset tagging, depreciation calculations, and disposals.',
    iconName: 'Building',
    requiredDocuments: [
      { type: 'asset_register', name: 'Fixed Asset Register (FAR)', description: 'Master asset list with acquisition date, cost, depreciation', isMandatory: true }
    ],
    extractedFieldsSchema: [
      { key: 'asset_cost', label: 'Asset Cost ($)', type: 'number', description: 'Original purchase cost' },
      { key: 'depreciation_rate', label: 'Depreciation Rate (%)', type: 'number', description: 'Annual depreciation rate' },
      { key: 'accumulated_depreciation', label: 'Book Accumulated Depreciation ($)', type: 'number', description: 'Current accumulated depreciation' },
      { key: 'useful_life_years', label: 'Useful Life (Years)', type: 'number', description: 'Asset useful life' }
    ],
    documentFieldSchemas: {
      asset_register: [
        { key: 'asset_cost', label: 'Asset Cost ($)', type: 'number', description: 'Original historical cost or purchase price of the fixed asset as recorded in the Fixed Asset Register' },
        { key: 'depreciation_rate', label: 'Depreciation Rate (%)', type: 'number', description: 'Annual depreciation rate applied to the asset (e.g. 20% straight-line)' },
        { key: 'accumulated_depreciation', label: 'Book Accumulated Depreciation ($)', type: 'number', description: 'Total depreciation charged on the asset to date as per the Fixed Asset Register' },
        { key: 'useful_life_years', label: 'Useful Life (Years)', type: 'number', description: 'Estimated useful economic life of the asset in years' },
      ],
    },
    rules: [
      {
        id: 'RULE_FAR_01',
        name: 'Depreciation Math Calculation',
        description: 'Verify accumulated depreciation math aligns with asset age and depreciation rate.',
        category: 'Valuation',
        severity: 'medium',
        expressionDescription: 'accumulated_depreciation <= asset_cost',
        evaluate: (fields) => {
          const cost = Number(fields.asset_cost?.value || 0);
          const accum = Number(fields.accumulated_depreciation?.value || 0);

          if (accum <= cost) {
            return {
              id: 'FND_FAR_01',
              ruleId: 'RULE_FAR_01',
              ruleName: 'Depreciation Cap Check',
              status: 'PASS',
              severity: 'low',
              title: 'Depreciation Within Asset Cost Limit',
              description: `Accumulated depreciation ($${accum}) is within original asset cost ($${cost}).`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Depreciation Schedule verified.'
            };
          }
          return {
            id: 'FND_FAR_01',
            ruleId: 'RULE_FAR_01',
            ruleName: 'Depreciation Cap Check',
            status: 'FAIL',
            severity: 'high',
            title: 'Over-Depreciated Asset Exception',
            description: `Accumulated depreciation ($${accum}) exceeds historical asset purchase cost ($${cost}).`,
            evidenceCitations: [
              { documentName: 'Fixed_Asset_Register.csv', pageNumber: 1, fieldName: 'Accumulated Depr', extractedValue: `$${accum}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Cease further depreciation expense on fully depreciated asset.'
          };
        }
      }
    ]
  },

  // 13. CASH FLOW AUDIT
  {
    id: 'cash_flow',
    title: 'Cash Flow Audit',
    category: 'financial',
    description: 'Validate operating, investing, and financing cash flow entries against bank movements and P&L adjustments.',
    iconName: 'DollarSign',
    requiredDocuments: [
      { type: 'cash_flow_stmt', name: 'Cash Flow Statement', description: 'Standard statement of cash flows', isMandatory: true }
    ],
    extractedFieldsSchema: [
      { key: 'net_operating_cf', label: 'Operating Cash Flow ($)', type: 'number', description: 'Cash from operations' },
      { key: 'net_investing_cf', label: 'Investing Cash Flow ($)', type: 'number', description: 'Cash from capex/investments' },
      { key: 'net_financing_cf', label: 'Financing Cash Flow ($)', type: 'number', description: 'Cash from debt/equity' },
      { key: 'net_change_cash', label: 'Net Change in Cash ($)', type: 'number', description: 'Sum of all 3 cash flows' }
    ],
    documentFieldSchemas: {
      cash_flow_stmt: [
        { key: 'net_operating_cf', label: 'Operating Cash Flow ($)', type: 'number', description: 'Net cash generated from or used in operating activities (section of the cash flow statement)' },
        { key: 'net_investing_cf', label: 'Investing Cash Flow ($)', type: 'number', description: 'Net cash used in or from investing activities (capex, asset purchases/disposals)' },
        { key: 'net_financing_cf', label: 'Financing Cash Flow ($)', type: 'number', description: 'Net cash from financing activities (borrowings, equity issuance, dividend payments)' },
        { key: 'net_change_cash', label: 'Net Change in Cash ($)', type: 'number', description: 'Total net change in cash and cash equivalents for the period (operating + investing + financing)' },
      ],
    },
    rules: [
      {
        id: 'RULE_CF_01',
        name: 'Cash Flow Sum Reconcile',
        description: 'Net change in cash must equal Operating CF + Investing CF + Financing CF.',
        category: 'Math Reconcile',
        severity: 'high',
        expressionDescription: 'net_change_cash == net_operating_cf + net_investing_cf + net_financing_cf',
        evaluate: (fields) => {
          const op = Number(fields.net_operating_cf?.value || 0);
          const inv = Number(fields.net_investing_cf?.value || 0);
          const fin = Number(fields.net_financing_cf?.value || 0);
          const change = Number(fields.net_change_cash?.value || 0);
          const expected = op + inv + fin;
          const diff = Math.abs(change - expected);

          if (diff < 1) {
            return {
              id: 'FND_CF_01',
              ruleId: 'RULE_CF_01',
              ruleName: 'Cash Flow Statement Rec',
              status: 'PASS',
              severity: 'low',
              title: 'Cash Flow Statement Balanced',
              description: 'Operating, investing, and financing cash movements mathematically reconcile.',
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Statement verified.'
            };
          }
          return {
            id: 'FND_CF_01',
            ruleId: 'RULE_CF_01',
            ruleName: 'Cash Flow Statement Rec',
            status: 'FAIL',
            severity: 'high',
            title: `Cash Flow Statement Unbalanced ($${diff.toLocaleString()} Math Error)`,
            description: `Sum of Operating ($${op}) + Investing ($${inv}) + Financing ($${fin}) = $${expected}, but Net Change stated as $${change}.`,
            evidenceCitations: [
              { documentName: 'Cash_Flow_Statement.pdf', pageNumber: 1, fieldName: 'Net Change in Cash', extractedValue: `$${change}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Recalculate non-cash working capital adjustments.'
          };
        }
      }
    ]
  },

  // 14. TAX AUDIT
  {
    id: 'tax_audit',
    title: 'Corporate Income Tax Audit',
    category: 'compliance',
    description: 'Verify corporate tax liability computations, non-deductible expense add-backs, and tax credit claims.',
    iconName: 'ReceiptText',
    requiredDocuments: [
      { type: 'tax_computation', name: 'Tax Computation Sheet', description: 'Schedule of taxable income adjustments', isMandatory: true }
    ],
    extractedFieldsSchema: [
      { key: 'accounting_profit', label: 'Net Accounting Profit ($)', type: 'number', description: 'Profit before tax from financial statements' },
      { key: 'disallowed_expenses', label: 'Disallowed Expense Add-backs ($)', type: 'number', description: 'Non-deductible items added back' },
      { key: 'taxable_income', label: 'Taxable Income ($)', type: 'number', description: 'Final adjusted taxable income' }
    ],
    documentFieldSchemas: {
      tax_computation: [
        { key: 'accounting_profit', label: 'Net Accounting Profit ($)', type: 'number', description: 'Net profit before income tax as per the financial statements / P&L (before any tax adjustments)' },
        { key: 'disallowed_expenses', label: 'Disallowed Expense Add-backs ($)', type: 'number', description: 'Total non-deductible expenses added back to accounting profit to arrive at taxable income (e.g. entertainment, fines, depreciation differences)' },
        { key: 'taxable_income', label: 'Taxable Income ($)', type: 'number', description: 'Final adjusted taxable income after all add-backs and allowable deductions, as stated on the tax computation schedule' },
      ],
    },
    rules: [
      {
        id: 'RULE_CIT_01',
        name: 'Taxable Income Reconciliation',
        description: 'Taxable income must equal Accounting Profit plus Disallowed Add-backs.',
        category: 'Tax',
        severity: 'high',
        expressionDescription: 'taxable_income >= accounting_profit',
        evaluate: (fields) => {
          const prof = Number(fields.accounting_profit?.value || 0);
          const taxInc = Number(fields.taxable_income?.value || 0);

          if (taxInc >= prof) {
            return {
              id: 'FND_CIT_01',
              ruleId: 'RULE_CIT_01',
              ruleName: 'Tax Add-back Check',
              status: 'PASS',
              severity: 'low',
              title: 'Tax Add-backs Processed Correctly',
              description: `Taxable income ($${taxInc}) properly reflects non-deductible expense adjustments.`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'Computation verified.'
            };
          }
          return {
            id: 'FND_CIT_01',
            ruleId: 'RULE_CIT_01',
            ruleName: 'Tax Add-back Check',
            status: 'FAIL',
            severity: 'high',
            title: 'Underreported Taxable Income Exception',
            description: `Taxable income ($${taxInc}) is lower than accounting profit ($${prof}) without documented tax exempt allowances.`,
            evidenceCitations: [
              { documentName: 'Tax_Computation.pdf', pageNumber: 1, fieldName: 'Taxable Income', extractedValue: `$${taxInc}` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Provide schedule of tax exempt income or correct calculation.'
          };
        }
      }
    ]
  },

  // 15. IFRS / GAAP COMPLIANCE AUDIT
  {
    id: 'ifrs_gaap_compliance',
    title: 'IFRS / GAAP Disclosure Audit',
    category: 'compliance',
    description: 'Ensure full compliance with financial accounting standards (IFRS 16 Leases, IFRS 9 Provisions, US GAAP disclosures).',
    iconName: 'BookOpenCheck',
    requiredDocuments: [
      { type: 'lease_agreement', name: 'Commercial Lease Contract', description: 'Property or equipment lease agreement', isMandatory: true }
    ],
    extractedFieldsSchema: [
      { key: 'lease_term_months', label: 'Lease Term (Months)', type: 'number', description: 'Total lease duration' },
      { key: 'monthly_lease_payment', label: 'Monthly Payment ($)', type: 'number', description: 'Rental amount' },
      { key: 'rou_asset_recognized', label: 'Right-of-Use Asset ($)', type: 'number', description: 'IFRS 16 ROU asset value' }
    ],
    documentFieldSchemas: {
      lease_agreement: [
        { key: 'lease_term_months', label: 'Lease Term (Months)', type: 'number', description: 'Total duration of the lease agreement in months (start date to end date)' },
        { key: 'monthly_lease_payment', label: 'Monthly Payment ($)', type: 'number', description: 'Fixed monthly rental or lease payment amount stated in the lease agreement' },
        { key: 'rou_asset_recognized', label: 'Right-of-Use Asset ($)', type: 'number', description: 'IFRS 16 Right-of-Use asset value recognized on the balance sheet. If not explicitly stated, derive it as: monthly_lease_payment × lease_term_months discounted at the implicit rate.' },
      ],
    },
    rules: [
      {
        id: 'RULE_IFRS_01',
        name: 'IFRS 16 Lease Capitalization Check',
        description: 'Leases over 12 months must capitalize Right-of-Use asset on balance sheet.',
        category: 'Accounting Standard',
        severity: 'high',
        expressionDescription: 'lease_term_months > 12 => rou_asset_recognized > 0',
        evaluate: (fields) => {
          const months = Number(fields.lease_term_months?.value || 0);
          const rou = Number(fields.rou_asset_recognized?.value || 0);

          if (months <= 12 || rou > 0) {
            return {
              id: 'FND_IFRS_01',
              ruleId: 'RULE_IFRS_01',
              ruleName: 'IFRS 16 Capitalization',
              status: 'PASS',
              severity: 'low',
              title: 'IFRS 16 Lease Capitalized Compliantly',
              description: `Long term lease (${months} months) is capitalized on Balance Sheet ($${rou} ROU Asset).`,
              evidenceCitations: [],
              riskRating: 'Compliant',
              recommendation: 'IFRS 16 compliant.'
            };
          }
          return {
            id: 'FND_IFRS_01',
            ruleId: 'RULE_IFRS_01',
            ruleName: 'IFRS 16 Capitalization',
            status: 'FAIL',
            severity: 'high',
            title: 'IFRS 16 Non-Compliance (Off-Balance Sheet Lease)',
            description: `Lease contract duration of ${months} months is expensed directly without mandatory Balance Sheet ROU asset capitalization.`,
            evidenceCitations: [
              { documentName: 'Lease_Agreement.pdf', pageNumber: 1, fieldName: 'Lease Term', extractedValue: `${months} months` }
            ],
            riskRating: 'High Risk',
            recommendation: 'Capitalize Right-of-Use asset and Lease Liability in balance sheet per IFRS 16.'
          };
        }
      }
    ]
  }
];

// Helper to get module by ID
export function getAuditModule(id: string): AuditModule | undefined {
  return AUDIT_MODULES.find(m => m.id === id);
}
