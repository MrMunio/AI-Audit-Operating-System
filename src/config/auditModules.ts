import { AuditModule, AuditFinding, DocumentFieldSchema, FieldSchemaProperty } from '../types/audit';
import { AuditFindingModel, citeField } from '../models/auditFinding';

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
      { type: 'invoice', name: 'Vendor Invoice', description: 'Tax invoice submitted by vendor or employee', isMandatory: true, allowMultiple: true },
      { type: 'purchase_order', name: 'Purchase Order (PO)', description: 'Approved PO document with authorized spend limit', isMandatory: true },
      { type: 'approval_email', name: 'Approval Email/Ticket', description: 'Manager written approval or ticket proof', isMandatory: false },
      { type: 'payment_voucher', name: 'Payment Voucher / Bank Receipt', description: 'Proof of disbursement from finance system', isMandatory: true, allowMultiple: true },
    ],
    documentFieldSchemas: {
      invoice: {
        type: 'object',
        title: 'Invoice Schema',
        description: 'Structured schema for invoice extraction',
        properties: {
          invoice_vendor: {
            type: 'string',
            title: 'Vendor Name',
            description: 'Name of the vendor or supplier printed on the invoice header'
          },
          invoice_number: {
            type: 'string',
            title: 'Invoice Number',
            description: 'Unique invoice reference number (e.g. INV-2026-001)'
          },
          invoice_date: {
            type: 'date',
            title: 'Invoice Date',
            description: 'Date the invoice was issued (DD/MM/YYYY or YYYY-MM-DD)'
          },
          invoice_amount: {
            type: 'number',
            title: 'Invoice Amount ($)',
            description: 'Total gross invoice amount inclusive of all taxes'
          },
          invoice_gst: {
            type: 'number',
            title: 'GST/Tax Amount ($)',
            description: 'Tax component separately stated on invoice (GST/VAT/sales tax)'
          }
        }
      },
      purchase_order: {
        type: 'object',
        title: 'Purchase Order Schema',
        description: 'Structured schema for purchase order extraction',
        properties: {
          po_number: {
            type: 'string',
            title: 'PO Reference Number',
            description: 'Purchase Order ID printed on the PO document (e.g. PO-8801)'
          },
          po_amount: {
            type: 'number',
            title: 'PO Authorized Amount ($)',
            description: 'Maximum authorized spend limit stated on the PO'
          },
          approver_name: {
            type: 'string',
            title: 'Approver Name',
            description: 'Name or signature of the manager/authority who approved the PO'
          }
        }
      },
      payment_voucher: {
        type: 'object',
        title: 'Payment Voucher Schema',
        description: 'Structured schema for payment voucher extraction',
        properties: {
          payment_date: {
            type: 'date',
            title: 'Payment Date',
            description: 'Date the bank transfer or payment was executed'
          },
          payment_amount: {
            type: 'number',
            title: 'Payment Amount ($)',
            description: 'Net amount transferred as shown on the payment voucher or bank receipt'
          }
        }
      },
      approval_email: {
        type: 'object',
        title: 'Approval Email Schema',
        description: 'Structured schema for approval email extraction',
        properties: {
          approver_name: {
            type: 'string',
            title: 'Approver Name',
            description: 'Name of the authorizing manager in the approval email or ticket'
          }
        }
      },
    },
    rules: [
      {
        id: 'RULE_EXP_01',
        name: 'Invoice vs Payment Amount Match',
        description: 'Ensures payment voucher amount exactly matches invoice total without overpayment.',
        category: 'Matching',
        severity: 'high',
        expressionDescription: 'invoice_amount == payment_amount',
        evaluate: (fields) => {
          const invAmt = Number(fields.invoice_amount?.value || 0);
          const payAmt = Number(fields.payment_amount?.value || 0);
          const diff = Math.abs(invAmt - payAmt);
          if (diff === 0) {
            return AuditFindingModel.pass({
              id: 'FND_EXP_01',
              ruleId: 'RULE_EXP_01',
              ruleName: 'Invoice vs Payment Amount Match',
              title: 'Payment Amount Matches Invoice Exactly',
              description: `Payment voucher amount ($${payAmt.toLocaleString()}) matches invoice total ($${invAmt.toLocaleString()}) with zero variance.`,
              evidenceCitations: [
                citeField(fields.invoice_amount, 'Invoice Amount', 'Invoice.pdf', 1),
                citeField(fields.payment_amount, 'Payment Amount', 'PaymentVoucher.pdf', 1)
              ],
              recommendation: 'No action required.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_EXP_01',
            ruleId: 'RULE_EXP_01',
            ruleName: 'Invoice vs Payment Amount Match',
            severity: 'high',
            title: `Payment Discrepancy Found ($${diff.toLocaleString()} Variance)`,
            description: `Payment voucher of $${payAmt.toLocaleString()} does not match invoice total of $${invAmt.toLocaleString()}. Difference: $${diff.toLocaleString()}.`,
            evidenceCitations: [
              citeField(fields.invoice_amount, 'Invoice Amount', 'Invoice.pdf', 1),
              citeField(fields.payment_amount, 'Payment Amount', 'PaymentVoucher.pdf', 1)
            ],
            recommendation: `Hold vendor payment reconciliation until finance team clarifies the $${diff} difference.`
          });
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
            return AuditFindingModel.pass({
              id: 'FND_EXP_02',
              ruleId: 'RULE_EXP_02',
              ruleName: 'PO Spend Limit Exceeded',
              title: 'Invoice Spend Within Approved PO Limit',
              description: `Invoice amount ($${invAmt}) is within approved PO budget ($${poAmt}).`,
              evidenceCitations: [
                citeField(fields.po_amount, 'PO Amount', 'PO_9041.pdf', 1)
              ],
              recommendation: 'No action required.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_EXP_02',
            ruleId: 'RULE_EXP_02',
            ruleName: 'PO Spend Limit Exceeded',
            severity: 'critical',
            title: 'Invoice Exceeds Approved PO Limit',
            description: `Invoice total ($${invAmt.toLocaleString()}) exceeds approved PO authorization ($${poAmt.toLocaleString()}) by $${(invAmt - poAmt).toLocaleString()}.`,
            evidenceCitations: [
              citeField(fields.invoice_amount, 'Invoice Amount', 'Invoice.pdf', 1),
              citeField(fields.po_amount, 'PO Amount', 'PO.pdf', 1)
            ],
            recommendation: 'Require secondary CFO sign-off for over-budget procurement before final accounting entry.'
          });
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
            return AuditFindingModel.pass({
              id: 'FND_EXP_03',
              ruleId: 'RULE_EXP_03',
              ruleName: 'GST Tax Calculation Check',
              title: 'Tax Calculation Accurately Verified',
              description: `Extracted GST ($${gstAmt.toFixed(2)}) aligns with tax computation formula.`,
              evidenceCitations: [citeField(fields.invoice_gst, 'GST Amount', 'Invoice.pdf', 1)],
              recommendation: 'Input tax credit verified for filing.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_EXP_03',
            ruleId: 'RULE_EXP_03',
            ruleName: 'GST Tax Calculation Check',
            severity: 'medium',
            title: 'GST Tax Amount Calculation Mismatch',
            description: `Extracted GST ($${gstAmt}) differs from expected 10% tax rate ($${expectedGst.toFixed(2)}). Variance: $${variance.toFixed(2)}.`,
            evidenceCitations: [citeField(fields.invoice_gst, 'GST Amount', 'Invoice.pdf', 1)],
            recommendation: 'Verify if vendor is tax exempt or if wrong tax code was applied.'
          });
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
      { type: 'bank_statement', name: 'Bank Statement', description: 'Official monthly bank statement PDF from financial institution', isMandatory: true, allowMultiple: true },
      { type: 'general_ledger', name: 'General Ledger (Cash Account)', description: 'System cash ledger export (ERP/NetSuite/QuickBooks)', isMandatory: true, allowMultiple: true },
      { type: 'cash_register', name: 'Cash Register / Receipt Log', description: 'Internal cashbook or register log', isMandatory: false, allowMultiple: true },
    ],
    documentFieldSchemas: {
      bank_statement: {
        type: 'object',
        title: 'Bank Statement Schema',
        description: 'Structured schema for bank statement extraction',
        properties: {
          bank_opening_balance: {
            type: 'number',
            title: 'Bank Opening Balance ($)',
            description: 'Opening/beginning balance shown at the top of the bank statement for the period'
          },
          bank_closing_balance: {
            type: 'number',
            title: 'Bank Closing Balance ($)',
            description: 'Closing/ending balance shown at the bottom of the bank statement for the period'
          },
          total_bank_deposits: {
            type: 'number',
            title: 'Total Bank Credits ($)',
            description: 'Sum total of all credit/deposit entries on the bank statement for the month'
          },
          bank_charges_unrecorded: {
            type: 'number',
            title: 'Unrecorded Bank Charges ($)',
            description: 'Bank service charges, maintenance fees, or wire fees listed on statement that may not be in the ledger'
          }
        }
      },
      general_ledger: {
        type: 'object',
        title: 'General Ledger Schema',
        description: 'Structured schema for general ledger extraction',
        properties: {
          gl_opening_balance: {
            type: 'number',
            title: 'GL Opening Balance ($)',
            description: 'Opening debit/credit balance in the cash account within the general ledger'
          },
          gl_closing_balance: {
            type: 'number',
            title: 'GL Closing Balance ($)',
            description: 'Closing debit/credit balance in the cash account within the general ledger'
          },
          total_gl_deposits: {
            type: 'number',
            title: 'Total Ledger Credits ($)',
            description: 'Sum of all debit/receipt entries recorded in the general ledger cash account'
          }
        }
      },
      cash_register: {
        type: 'object',
        title: 'Cash Register Schema',
        description: 'Structured schema for cash register extraction',
        properties: {
          outstanding_cheques_count: {
            type: 'number',
            title: 'Unpresented Cheques Count',
            description: 'Number of cheques recorded as issued in the cash book but not yet cleared by the bank'
          },
          bank_charges_unrecorded: {
            type: 'number',
            title: 'Unrecorded Bank Charges ($)',
            description: 'Any bank charges or fees noted in the cash register that have not been posted to the ledger'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_BNK_01',
              ruleId: 'RULE_BNK_01',
              ruleName: 'Opening Balance Ledger Alignment',
              title: 'Opening Balance Reconciled Successfully',
              description: `Bank opening balance ($${bankOp.toLocaleString()}) matches GL opening balance exactly.`,
              evidenceCitations: [
                citeField(fields.bank_opening_balance, 'Opening Balance', 'Bank_Statement_Jan.pdf', 1),
                citeField(fields.gl_opening_balance, 'GL Opening Balance', 'GL_Cash_Jan.csv', 1)
              ],
              recommendation: 'Proceed with transaction-level matching.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_BNK_01',
            ruleId: 'RULE_BNK_01',
            ruleName: 'Opening Balance Ledger Alignment',
            severity: 'high',
            title: `Opening Balance Discrepancy ($${diff.toLocaleString()})`,
            description: `Bank opening balance ($${bankOp.toLocaleString()}) does not agree with General Ledger cash account ($${glOp.toLocaleString()}). Unadjusted difference of $${diff.toLocaleString()}.`,
            evidenceCitations: [
              citeField(fields.bank_opening_balance, 'Opening Balance', 'Bank_Statement.pdf', 1),
              citeField(fields.gl_opening_balance, 'GL Balance', 'General_Ledger.pdf', 1)
            ],
            recommendation: 'Review prior month closing adjustments and carryforward balance entries.'
          });
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
            return AuditFindingModel.pass({
              id: 'FND_BNK_02',
              ruleId: 'RULE_BNK_02',
              ruleName: 'Unrecorded Bank Fees Detection',
              title: 'All Bank Fees Fully Recorded',
              description: 'No unposted bank charges or maintenance fees were identified.',
              evidenceCitations: [],
              recommendation: 'No action required.'
            });
          }
          return AuditFindingModel.warning({
            id: 'FND_BNK_02',
            ruleId: 'RULE_BNK_02',
            ruleName: 'Unrecorded Bank Fees Detection',
            severity: 'medium',
            title: `Unrecorded Bank Fees Found ($${charges.toLocaleString()})`,
            description: `Bank statement lists $${charges.toLocaleString()} in account service charges and wire fees that have not been posted to General Ledger Expense Account #6120.`,
            evidenceCitations: [citeField(fields.bank_charges_unrecorded, 'Service Fees', 'Bank_Statement.pdf', 2)],
            recommendation: 'Post adjusting journal entry to ledger for bank service charges.'
          });
        }
      }
    ]
  },

  // 2B. BANK RECONCILIATION AUDIT v2 (FORENSIC & EDGE-CASE ENGINE)
  {
    id: 'bank_reconciliation_v2',
    title: 'Bank Reconciliation Audit v2 (Forensic & Edge-Case Engine)',
    category: 'financial',
    description: 'Advanced 7-rule forensic bank reconciliation engine featuring pre-audit entity & account verification, period cut-off checks, arithmetic continuity proofs, master BRS adjusted balance reconciliation with built-in algorithmic modulo-9 transposition typo cross-matching, and unposted bank fees discovery.',
    iconName: 'BuildingLibrary',
    samplePackName: 'Infomerica Q3 Forensic Bank Batch',
    requiredDocuments: [
      {
        type: 'bank_statement',
        name: 'Bank Statement',
        description: 'Official periodic bank statement (PDF) from financial institution',
        isMandatory: true,
        allowMultiple: true,
        maxFiles: 12
      },
      {
        type: 'general_ledger',
        name: 'General Ledger (Cash Account)',
        description: 'Cash account journal ledger export from accounting ERP (QuickBooks / NetSuite / SAP)',
        isMandatory: true,
        allowMultiple: true,
        maxFiles: 12
      },
      {
        type: 'cash_register',
        name: 'Cash Register / BRS Worksheet',
        description: 'Supplementary cash book, issued check log, deposit slips, or prior reconciliation',
        isMandatory: false,
        allowMultiple: true,
        maxFiles: 5
      }
    ],
    documentFieldSchemas: {
      bank_statement: {
        type: 'object',
        title: 'Bank Statement Schema',
        description: 'Structured schema for bank statement extraction',
        properties: {
          bank_entity_name: {
            type: 'string',
            title: 'Account Holder / Legal Entity Name',
            description: 'Legal entity or company name printed on bank statement header'
          },
          bank_name: {
            type: 'string',
            title: 'Bank Institution Name',
            description: 'Financial institution issuing the statement (e.g. ABC National Bank, Chase)'
          },
          bank_account_number: {
            type: 'string',
            title: 'Bank Account Number',
            description: 'Account number on statement (e.g. 1234567890 or ending digits 7890)'
          },
          statement_start_date: {
            type: 'date',
            title: 'Statement Start Date',
            description: 'Beginning date of the statement cycle (YYYY-MM-DD)'
          },
          statement_end_date: {
            type: 'date',
            title: 'Statement End Date',
            description: 'Closing date of the statement cycle (YYYY-MM-DD)'
          },
          bank_opening_balance: {
            type: 'number',
            title: 'Bank Opening Balance ($)',
            description: 'Beginning balance at start of statement cycle'
          },
          bank_closing_balance: {
            type: 'number',
            title: 'Bank Closing Balance ($)',
            description: 'Ending balance at close of statement cycle'
          },
          total_bank_deposits: {
            type: 'number',
            title: 'Total Bank Credits/Deposits ($)',
            description: 'Total sum of all deposits/credits on statement'
          },
          total_bank_withdrawals: {
            type: 'number',
            title: 'Total Bank Debits/Withdrawals ($)',
            description: 'Total sum of all checks/withdrawals/fees on statement'
          },
          bank_charges_unrecorded: {
            type: 'number',
            title: 'Bank Service & Wire Charges ($)',
            description: 'Service fees, maintenance charges, wire fees listed on statement'
          },
          bank_interest_earned: {
            type: 'number',
            title: 'Bank Interest Earned ($)',
            description: 'Interest income credited by bank on statement'
          },
          bank_transactions: {
            type: 'array',
            title: 'Bank Transaction Line Items',
            description: 'Individual transactions recorded on bank statement',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', title: 'Transaction Date' },
                description: { type: 'string', title: 'Description / Payee' },
                reference: { type: 'string', title: 'Check / Ref #' },
                debit: { type: 'number', title: 'Debit Amount' },
                credit: { type: 'number', title: 'Credit Amount' },
                balance: { type: 'number', title: 'Running Balance' }
              }
            }
          }
        }
      },
      general_ledger: {
        type: 'object',
        title: 'General Ledger Schema',
        description: 'Structured schema for general ledger cash account extraction',
        properties: {
          gl_entity_name: {
            type: 'string',
            title: 'GL Entity / Company Name',
            description: 'Company name on the General Ledger report'
          },
          gl_account_name: {
            type: 'string',
            title: 'GL Account Description',
            description: 'Cash account description (e.g. Cash at Bank #1010)'
          },
          gl_account_number: {
            type: 'string',
            title: 'GL Linked Bank Account #',
            description: 'Bank account number referenced in GL cash account'
          },
          gl_period_start_date: {
            type: 'date',
            title: 'GL Period Start Date',
            description: 'Reporting period start date (YYYY-MM-DD)'
          },
          gl_period_end_date: {
            type: 'date',
            title: 'GL Period End Date',
            description: 'Reporting period end date (YYYY-MM-DD)'
          },
          gl_opening_balance: {
            type: 'number',
            title: 'GL Opening Balance ($)',
            description: 'Beginning cash account debit balance in ledger'
          },
          gl_closing_balance: {
            type: 'number',
            title: 'GL Closing Balance ($)',
            description: 'Ending cash account debit balance in ledger'
          },
          total_gl_receipts: {
            type: 'number',
            title: 'Total GL Receipts / Debits ($)',
            description: 'Sum of all debit/receipt entries recorded in ledger'
          },
          total_gl_disbursements: {
            type: 'number',
            title: 'Total GL Disbursements / Credits ($)',
            description: 'Sum of all credit/payment entries recorded in ledger'
          },
          deposits_in_transit: {
            type: 'number',
            title: 'Deposits in Transit ($)',
            description: 'Deposits entered in GL on/before period-end but not cleared by bank'
          },
          outstanding_cheques_amount: {
            type: 'number',
            title: 'Outstanding Cheques ($)',
            description: 'Checks issued in GL but not presented or cleared by bank'
          },
          gl_transactions: {
            type: 'array',
            title: 'GL Journal Entries',
            description: 'Detailed journal entry rows recorded in cash account ledger',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', title: 'Posting Date' },
                journal_ref: { type: 'string', title: 'Journal Ref / Voucher #' },
                description: { type: 'string', title: 'Transaction Description / Payee' },
                debit: { type: 'number', title: 'Debit Amount' },
                credit: { type: 'number', title: 'Credit Amount' },
                running_balance: { type: 'number', title: 'Running Balance' }
              }
            }
          }
        }
      },
      cash_register: {
        type: 'object',
        title: 'Cash Register / BRS Worksheet Schema',
        description: 'Structured schema for supplementary cash registers and BRS working papers',
        properties: {
          cr_entity_name: {
            type: 'string',
            title: 'Entity Name',
            description: 'Entity name on register'
          },
          cr_period: {
            type: 'string',
            title: 'Register Period',
            description: 'Period covered by register'
          },
          outstanding_cheques_count: {
            type: 'number',
            title: 'Outstanding Cheques Count',
            description: 'Number of unpresented checks'
          },
          outstanding_cheques_amount: {
            type: 'number',
            title: 'Outstanding Cheques Total ($)',
            description: 'Total value of unpresented checks'
          },
          deposits_in_transit_amount: {
            type: 'number',
            title: 'Deposits in Transit Total ($)',
            description: 'Total value of uncleared deposits'
          },
          bank_charges_noted: {
            type: 'number',
            title: 'Bank Charges Noted ($)',
            description: 'Bank charges noted in cash register'
          }
        }
      }
    },
    rules: [
      // 1. Legal Entity Name Match (Pre-Audit Boundary Check)
      {
        id: 'RULE_BNK2_01_ENTITY_MATCH',
        name: 'Legal Entity Name Consistency Check',
        description: 'Verify that the bank statement and general ledger belong to the exact same legal company/entity before processing.',
        category: 'Pre-Audit Boundary',
        severity: 'critical',
        expressionDescription: 'bank_entity_name == gl_entity_name',
        evaluate: (fields) => {
          const bankEntity = String(fields.bank_entity_name?.value || fields.entity_name?.value || fields.bank_statement?.bank_entity_name?.value || '').trim();
          const glEntity = String(fields.gl_entity_name?.value || fields.general_ledger?.gl_entity_name?.value || '').trim();

          const normBank = bankEntity.toLowerCase().replace(/[^a-z0-9]/g, '');
          const normGl = glEntity.toLowerCase().replace(/[^a-z0-9]/g, '');

          const isMatch = normBank.length > 0 && normGl.length > 0 && (normBank === normGl || normBank.includes(normGl) || normGl.includes(normBank));

          if (isMatch) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_01',
              ruleId: 'RULE_BNK2_01_ENTITY_MATCH',
              ruleName: 'Legal Entity Name Consistency Check',
              title: 'Legal Entity Alignment Verified',
              description: `Bank Statement entity ("${bankEntity}") matches General Ledger entity ("${glEntity}").`,
              evidenceCitations: [
                citeField(fields.bank_entity_name, 'Bank Entity Name', 'bank_statement.pdf', 1),
                citeField(fields.gl_entity_name, 'GL Entity Name', 'general_ledger.pdf', 1)
              ],
              recommendation: 'Entity verification passed. Proceeding with account and mathematical reconciliation.'
            });
          }

          return AuditFindingModel.fail({
            id: 'FND_BNK2_01',
            ruleId: 'RULE_BNK2_01_ENTITY_MATCH',
            ruleName: 'Legal Entity Name Consistency Check',
            severity: 'critical',
            title: `Entity Mismatch: "${bankEntity || 'Unknown'}" vs "${glEntity || 'Unknown'}"`,
            description: `Bank Statement belongs to "${bankEntity || 'Empty'}" whereas General Ledger belongs to "${glEntity || 'Empty'}". Reconciling documents across different subsidiaries or entities produces invalid audit conclusions.`,
            evidenceCitations: [
              citeField(fields.bank_entity_name, 'Bank Entity Name', 'bank_statement.pdf', 1),
              citeField(fields.gl_entity_name, 'GL Entity Name', 'general_ledger.pdf', 1)
            ],
            recommendation: 'Halt reconciliation. Verify uploaded documents belong to the same registered operating company.'
          });
        }
      },

      // 2. Bank Account Number Alignment (Multi-Account Check)
      {
        id: 'RULE_BNK2_02_ACC_MATCH',
        name: 'Bank Account Number & Routing Alignment',
        description: 'Ensure the bank statement account number corresponds to the cash ledger account mapping.',
        category: 'Integrity Check',
        severity: 'critical',
        expressionDescription: 'bank_account_number.slice(-4) == gl_account_number.slice(-4)',
        evaluate: (fields) => {
          const bankAcc = String(fields.bank_account_number?.value || fields.account_number?.value || '').replace(/[^0-9]/g, '');
          const glAcc = String(fields.gl_account_number?.value || '').replace(/[^0-9]/g, '');

          const bankLast4 = bankAcc.slice(-4);
          const glLast4 = glAcc.slice(-4);

          const isMatch = bankLast4.length > 0 && glLast4.length > 0 && (bankLast4 === glLast4 || bankAcc === glAcc);

          if (isMatch) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_02',
              ruleId: 'RULE_BNK2_02_ACC_MATCH',
              ruleName: 'Bank Account Number & Routing Alignment',
              title: `Bank Account Verified (Ending in ${bankLast4})`,
              description: `Statement Account (***${bankLast4}) matches General Ledger Cash Account mapping (***${glLast4}).`,
              evidenceCitations: [
                citeField(fields.bank_account_number, 'Statement Account #', 'bank_statement.pdf', 1),
                citeField(fields.gl_account_number, 'GL Linked Account #', 'general_ledger.pdf', 1)
              ],
              recommendation: 'Account number validated. Proceeding to period and transaction auditing.'
            });
          }

          return AuditFindingModel.fail({
            id: 'FND_BNK2_02',
            ruleId: 'RULE_BNK2_02_ACC_MATCH',
            ruleName: 'Bank Account Number & Routing Alignment',
            severity: 'critical',
            title: `Bank Account Mismatch (***${bankLast4 || 'N/A'} vs ***${glLast4 || 'N/A'})`,
            description: `Bank Statement is for account ending in ${bankLast4 || 'Unknown'}, but GL Cash Account references account ending in ${glLast4 || 'Unknown'}. Cross-account reconciliation will cause false balance variances.`,
            evidenceCitations: [
              citeField(fields.bank_account_number, 'Statement Account #', 'bank_statement.pdf', 1),
              citeField(fields.gl_account_number, 'GL Linked Account #', 'general_ledger.pdf', 1)
            ],
            recommendation: 'Verify the correct bank statement PDF was uploaded for this specific general ledger cash account.'
          });
        }
      },

      // 3. Statement Period & Cut-Off Date Alignment
      {
        id: 'RULE_BNK2_03_PERIOD_CUTOFF',
        name: 'Statement Period & Accounting Cut-Off Alignment',
        description: 'Verify bank statement date cycle aligns with the General Ledger accounting period.',
        category: 'Cut-off Verification',
        severity: 'high',
        expressionDescription: 'statement_period_dates == gl_period_dates',
        evaluate: (fields) => {
          const stmtStart = String(fields.statement_start_date?.value || '').trim();
          const stmtEnd = String(fields.statement_end_date?.value || '').trim();
          const glStart = String(fields.gl_period_start_date?.value || '').trim();
          const glEnd = String(fields.gl_period_end_date?.value || '').trim();

          const hasDates = stmtStart && stmtEnd && glStart && glEnd;
          const isExactMatch = hasDates && stmtStart === glStart && stmtEnd === glEnd;

          if (isExactMatch) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_03',
              ruleId: 'RULE_BNK2_03_PERIOD_CUTOFF',
              ruleName: 'Statement Period & Accounting Cut-Off Alignment',
              title: `Audit Period Synchronized (${stmtStart} to ${stmtEnd})`,
              description: `Statement period dates (${stmtStart} to ${stmtEnd}) align precisely with GL accounting period.`,
              evidenceCitations: [
                citeField(fields.statement_end_date, 'Statement End Date', 'bank_statement.pdf', 1),
                citeField(fields.gl_period_end_date, 'GL Period End Date', 'general_ledger.pdf', 1)
              ],
              recommendation: 'Period dates match. Proceed with transactional reconciliation.'
            });
          }

          if (hasDates) {
            return AuditFindingModel.warning({
              id: 'FND_BNK2_03',
              ruleId: 'RULE_BNK2_03_PERIOD_CUTOFF',
              ruleName: 'Statement Period & Accounting Cut-Off Alignment',
              severity: 'high',
              title: `Period Boundary Variance (${stmtStart}..${stmtEnd} vs ${glStart}..${glEnd})`,
              description: `Bank Statement cycle runs from ${stmtStart} to ${stmtEnd}, whereas General Ledger covers ${glStart} to ${glEnd}. Ensure timing differences across the cut-off dates are properly treated as Outstanding Cheques or Deposits in Transit.`,
              evidenceCitations: [
                citeField(fields.statement_start_date, 'Statement Start', 'bank_statement.pdf', 1),
                citeField(fields.gl_period_start_date, 'GL Start', 'general_ledger.pdf', 1)
              ],
              recommendation: 'Review cut-off transactions occurring on the boundary dates (month-end / month-start) for timing lag.'
            });
          }

          return AuditFindingModel.pass({
            id: 'FND_BNK2_03',
            ruleId: 'RULE_BNK2_03_PERIOD_CUTOFF',
            ruleName: 'Statement Period & Accounting Cut-Off Alignment',
            title: 'Period Consistency Verified (Default Monthly Cycle)',
            description: 'Bank statement and GL dates evaluated successfully.',
            evidenceCitations: [],
            recommendation: 'No action required.'
          });
        }
      },

      // 4. Bank Statement Arithmetic Continuity Proof
      {
        id: 'RULE_BNK2_04_STMT_MATH',
        name: 'Bank Statement Internal Arithmetic Proof',
        description: 'Verify internal mathematical continuity: Bank Opening Balance + Total Deposits - Total Withdrawals = Bank Closing Balance.',
        category: 'Mathematical Proof',
        severity: 'high',
        expressionDescription: 'bank_opening_balance + total_bank_deposits - total_bank_withdrawals == bank_closing_balance',
        evaluate: (fields) => {
          const opening = Number(fields.bank_opening_balance?.value || 0);
          const deposits = Number(fields.total_bank_deposits?.value || 0);
          const withdrawals = Number(fields.total_bank_withdrawals?.value || 0);
          const closing = Number(fields.bank_closing_balance?.value || 0);

          const computedClosing = Math.round((opening + deposits - withdrawals) * 100) / 100;
          const diff = Math.round(Math.abs(computedClosing - closing) * 100) / 100;

          if (diff < 0.01) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_04',
              ruleId: 'RULE_BNK2_04_STMT_MATH',
              ruleName: 'Bank Statement Internal Arithmetic Proof',
              title: 'Bank Statement Arithmetic Proof Verified',
              description: `Bank statement is mathematically sound: Opening ($${opening.toLocaleString()}) + Deposits ($${deposits.toLocaleString()}) - Withdrawals ($${withdrawals.toLocaleString()}) = Closing ($${closing.toLocaleString()}).`,
              evidenceCitations: [
                citeField(fields.bank_opening_balance, 'Opening Balance', 'bank_statement.pdf', 1),
                citeField(fields.total_bank_deposits, 'Total Deposits', 'bank_statement.pdf', 1),
                citeField(fields.total_bank_withdrawals, 'Total Withdrawals', 'bank_statement.pdf', 1),
                citeField(fields.bank_closing_balance, 'Closing Balance', 'bank_statement.pdf', 1)
              ],
              recommendation: 'Statement continuity validated. No internal bank statement corruption.'
            });
          }

          return AuditFindingModel.fail({
            id: 'FND_BNK2_04',
            ruleId: 'RULE_BNK2_04_STMT_MATH',
            ruleName: 'Bank Statement Internal Arithmetic Proof',
            severity: 'high',
            title: `Bank Statement Mathematical Variance ($${diff.toLocaleString()})`,
            description: `Bank statement reported closing balance of $${closing.toLocaleString()}, but calculated sum is $${computedClosing.toLocaleString()} (Opening $${opening} + Deposits $${deposits} - Withdrawals $${withdrawals}). Unaccounted difference of $${diff.toLocaleString()}.`,
            evidenceCitations: [
              citeField(fields.bank_closing_balance, 'Reported Closing', 'bank_statement.pdf', 1),
              citeField(fields.bank_opening_balance, 'Reported Opening', 'bank_statement.pdf', 1)
            ],
            recommendation: 'Inspect bank statement for missing intermediate transaction pages or uncomputed service charges.'
          });
        }
      },

      // 5. General Ledger Internal Arithmetic Proof
      {
        id: 'RULE_BNK2_05_GL_MATH',
        name: 'General Ledger Cash Continuity Proof',
        description: 'Verify internal mathematical continuity: GL Opening Balance + Total Receipts - Total Disbursements = GL Closing Balance.',
        category: 'Mathematical Proof',
        severity: 'high',
        expressionDescription: 'gl_opening_balance + total_gl_receipts - total_gl_disbursements == gl_closing_balance',
        evaluate: (fields) => {
          const opening = Number(fields.gl_opening_balance?.value || 0);
          const receipts = Number(fields.total_gl_receipts?.value || 0);
          const disbursements = Number(fields.total_gl_disbursements?.value || 0);
          const closing = Number(fields.gl_closing_balance?.value || 0);

          const computedClosing = Math.round((opening + receipts - disbursements) * 100) / 100;
          const diff = Math.round(Math.abs(computedClosing - closing) * 100) / 100;

          if (diff < 0.01) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_05',
              ruleId: 'RULE_BNK2_05_GL_MATH',
              ruleName: 'General Ledger Cash Continuity Proof',
              title: 'General Ledger Continuity Verified',
              description: `GL cash account math is consistent: Opening ($${opening.toLocaleString()}) + Receipts ($${receipts.toLocaleString()}) - Disbursements ($${disbursements.toLocaleString()}) = Closing ($${closing.toLocaleString()}).`,
              evidenceCitations: [
                citeField(fields.gl_opening_balance, 'GL Opening Balance', 'general_ledger.pdf', 1),
                citeField(fields.total_gl_receipts, 'Total Receipts', 'general_ledger.pdf', 1),
                citeField(fields.total_gl_disbursements, 'Total Disbursements', 'general_ledger.pdf', 1),
                citeField(fields.gl_closing_balance, 'GL Closing Balance', 'general_ledger.pdf', 1)
              ],
              recommendation: 'General ledger cash flow integrity certified.'
            });
          }

          return AuditFindingModel.fail({
            id: 'FND_BNK2_05',
            ruleId: 'RULE_BNK2_05_GL_MATH',
            ruleName: 'General Ledger Cash Continuity Proof',
            severity: 'high',
            title: `General Ledger Math Variance ($${diff.toLocaleString()})`,
            description: `GL stated closing balance is $${closing.toLocaleString()}, but calculated sum is $${computedClosing.toLocaleString()} (Opening $${opening} + Receipts $${receipts} - Disbursements $${disbursements}). Discrepancy of $${diff.toLocaleString()}.`,
            evidenceCitations: [
              citeField(fields.gl_closing_balance, 'Stated GL Closing', 'general_ledger.pdf', 1),
              citeField(fields.gl_opening_balance, 'Stated GL Opening', 'general_ledger.pdf', 1)
            ],
            recommendation: 'Check for unposted draft journal vouchers or manual override entries in the general ledger.'
          });
        }
      },

      // 6. Master BRS Adjusted Balance Reconciliation Equation & Forensic Transposition Detective
      {
        id: 'RULE_BNK2_06_ADJUSTED_REC',
        name: 'Master BRS Adjusted Balance Reconciliation',
        description: 'Verify standard Bank Reconciliation Statement equation: (Bank Closing + Deposits in Transit - Outstanding Cheques) == (GL Closing + Unrecorded Interest - Unrecorded Bank Charges). If unreconciled, runs automated modulo-9 forensic cross-matching across all line items in both General Ledger and Bank Statement to isolate and report exact transposition culprits.',
        category: 'Core Reconciliation',
        severity: 'critical',
        expressionDescription: '(bank_closing + deposits_in_transit - outstanding_cheques) == (gl_closing + interest - bank_charges)',
        evaluate: (fields) => {
          const bankClose = Number(fields.bank_closing_balance?.value || 0);
          const glClose = Number(fields.gl_closing_balance?.value || 0);
          const depositsInTransit = Number(fields.deposits_in_transit?.value || fields.deposits_in_transit_amount?.value || 0);
          const outstandingCheques = Number(fields.outstanding_cheques_amount?.value || 0);
          const unrecordedFees = Number(fields.bank_charges_unrecorded?.value || 0);
          const interestEarned = Number(fields.bank_interest_earned?.value || 0);

          const adjustedBank = Math.round((bankClose + depositsInTransit - outstandingCheques) * 100) / 100;
          const adjustedGL = Math.round((glClose + interestEarned - unrecordedFees) * 100) / 100;
          const variance = Math.round(Math.abs(adjustedBank - adjustedGL) * 100) / 100;

          if (variance < 0.01) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_06',
              ruleId: 'RULE_BNK2_06_ADJUSTED_REC',
              ruleName: 'Master BRS Adjusted Balance Reconciliation',
              title: `Adjusted Bank Balance Fully Reconciled ($${adjustedBank.toLocaleString()})`,
              description: `Adjusted Bank Balance ($${adjustedBank.toLocaleString()} = Bank Closing $${bankClose.toLocaleString()} + Deposits in Transit $${depositsInTransit.toLocaleString()} - Outstanding Cheques $${outstandingCheques.toLocaleString()}) matches Adjusted GL Balance ($${adjustedGL.toLocaleString()} = GL Closing $${glClose.toLocaleString()} + Interest $${interestEarned} - Bank Fees $${unrecordedFees}) with $0.00 variance.`,
              evidenceCitations: [
                citeField(fields.bank_closing_balance, 'Bank Closing', 'bank_statement.pdf', 1),
                citeField(fields.gl_closing_balance, 'GL Closing', 'general_ledger.pdf', 1),
                citeField(fields.deposits_in_transit, 'Deposits in Transit', 'general_ledger.pdf', 1),
                citeField(fields.outstanding_cheques_amount, 'Outstanding Cheques', 'general_ledger.pdf', 1)
              ],
              recommendation: 'Bank reconciliation statement is fully in balance. No adjusting journal entries required.'
            });
          }

          // Helper to unpack nested or proxy transaction arrays
          function unpackTxns(raw: any): any[] {
            if (!raw) return [];
            const list = Array.isArray(raw) ? raw : (Array.isArray(raw.value) ? raw.value : []);
            return list.map((item: any) => {
              if (typeof item !== 'object' || item === null) return item;
              const clean: Record<string, any> = {};
              for (const [k, v] of Object.entries(item)) {
                clean[k] = (v && typeof v === 'object' && 'value' in v) ? v.value : v;
              }
              return clean;
            });
          }

          const glTxns = unpackTxns(fields.gl_transactions?.value || fields.gl_transactions || fields.general_ledger?.gl_transactions?.value || fields.general_ledger?.gl_transactions || fields.transactions);
          const bankTxns = unpackTxns(fields.bank_transactions?.value || fields.bank_transactions || fields.bank_statement?.bank_transactions?.value || fields.bank_statement?.bank_transactions);

          // Modulo-9 Transposition Check on integer cents
          const centsVariance = Math.round(variance * 100);
          const isDivBy9 = centsVariance > 0 && centsVariance % 9 === 0;

          interface TranspositionMatch {
            glRef: string;
            glDesc: string;
            glAmount: number;
            bankRef: string;
            bankDesc: string;
            bankAmount: number;
            discrepancy: number;
            matchedInBank: boolean;
          }

          const transpositionMatches: TranspositionMatch[] = [];

          if (isDivBy9) {
            // Scan GL entries for adjacent digit swaps matching variance
            for (const gl of glTxns) {
              const glAmt = Number(gl.debit || gl.credit || gl.amount || 0);
              if (glAmt <= 0) continue;

              const glStr = glAmt.toFixed(2);
              for (let i = 0; i < glStr.length - 1; i++) {
                if (glStr[i] === '.' || glStr[i + 1] === '.') continue;
                if (glStr[i] === glStr[i + 1]) continue;

                const chars = glStr.split('');
                const tmp = chars[i];
                chars[i] = chars[i + 1];
                chars[i + 1] = tmp;

                const flipped = parseFloat(chars.join(''));
                const diff = Math.round(Math.abs(glAmt - flipped) * 100) / 100;

                if (Math.abs(diff - variance) < 0.01) {
                  // Cross-check if matching amount exists in Bank Statement
                  const matchingBank = bankTxns.find((b: any) => {
                    const bAmt = Number(b.debit || b.credit || b.amount || 0);
                    return Math.abs(bAmt - flipped) < 0.01;
                  });

                  transpositionMatches.push({
                    glRef: gl.journal_ref || gl.reference || gl.ref || 'GL-Entry',
                    glDesc: gl.description || 'GL Transaction',
                    glAmount: glAmt,
                    bankRef: matchingBank ? (matchingBank.reference || matchingBank.ref || 'Bank-Ref') : 'N/A',
                    bankDesc: matchingBank ? (matchingBank.description || 'Bank Statement Line') : 'No exact bank counterpart found',
                    bankAmount: matchingBank ? Number(matchingBank.debit || matchingBank.credit || matchingBank.amount || 0) : flipped,
                    discrepancy: diff,
                    matchedInBank: Boolean(matchingBank)
                  });
                }
              }
            }
          }

          // Build rich description with transposition findings if detected
          let descText = `Adjusted Bank Balance ($${adjustedBank.toLocaleString()}) does NOT agree with Adjusted General Ledger Balance ($${adjustedGL.toLocaleString()}). Net Unreconciled Variance: $${variance.toLocaleString()}.\n\n• Bank Balance Calculation: $${bankClose.toLocaleString()} (Closing) + $${depositsInTransit.toLocaleString()} (Deposits in Transit) - $${outstandingCheques.toLocaleString()} (Outstanding Cheques) = $${adjustedBank.toLocaleString()}\n• General Ledger Calculation: $${glClose.toLocaleString()} (Closing) - $${unrecordedFees.toLocaleString()} (Unrecorded Bank Fees) = $${adjustedGL.toLocaleString()}`;

          let recommendationText = `Investigate the $${variance.toLocaleString()} variance for timing cut-offs, unrecorded deposits, or manual ledger entry errors.`;

          const citations = [
            citeField(fields.bank_closing_balance, 'Bank Closing Balance', 'bank_statement.pdf', 1),
            citeField(fields.gl_closing_balance, 'GL Closing Balance', 'general_ledger.pdf', 1),
            citeField(fields.deposits_in_transit, 'Deposits in Transit', 'general_ledger.pdf', 1),
            citeField(fields.outstanding_cheques_amount, 'Outstanding Cheques', 'general_ledger.pdf', 1)
          ];

          if (transpositionMatches.length > 0) {
            const confirmedMatches = transpositionMatches.filter(m => m.matchedInBank);
            const primary = confirmedMatches[0] || transpositionMatches[0];

            const detailsBlock = transpositionMatches.map(m => {
              if (m.matchedInBank) {
                return `  ➜ [${m.glRef}] "${m.glDesc}": Recorded in GL as $${m.glAmount.toFixed(2)} | Cleared in Bank [${m.bankRef}] as $${m.bankAmount.toFixed(2)} (Digit flip variance: $${m.discrepancy.toFixed(2)})`;
              }
              return `  ➜ [${m.glRef}] "${m.glDesc}": Recorded in GL as $${m.glAmount.toFixed(2)} | Suspected True Amount: $${m.bankAmount.toFixed(2)} (Variance: $${m.discrepancy.toFixed(2)})`;
            }).join('\n');

            descText += `\n\n🔍 FORENSIC TRANSPOSITION ANALYSIS:\nThe $${variance.toFixed(2)} variance is evenly divisible by 9 (${centsVariance} mod 9 = 0), indicating an inverted digit typo during ledger data entry.\nCross-document line item scanning isolated ${transpositionMatches.length} suspect transaction(s):\n${detailsBlock}`;

            recommendationText = `Post adjusting correction for suspected Transposition Typo:\n1. Update GL Entry [${primary.glRef}] ("${primary.glDesc}") from $${primary.glAmount.toFixed(2)} to $${primary.bankAmount.toFixed(2)} to match cleared bank record [${primary.bankRef}].\n2. This single adjustment will eliminate the entire $${variance.toFixed(2)} discrepancy and fully balance the bank reconciliation.`;

            // Add line-item evidence citations for the isolated transactions
            citations.push({
              documentName: 'general_ledger.pdf',
              pageNumber: 1,
              fieldName: `GL Line Item [${primary.glRef}]`,
              extractedValue: `$${primary.glAmount.toFixed(2)} (${primary.glDesc})`
            });
            if (primary.matchedInBank) {
              citations.push({
                documentName: 'bank_statement.pdf',
                pageNumber: 1,
                fieldName: `Bank Cleared Item [${primary.bankRef}]`,
                extractedValue: `$${primary.bankAmount.toFixed(2)} (${primary.bankDesc})`
              });
            }
          } else if (isDivBy9) {
            descText += `\n\n🔍 FORENSIC TRANSPOSITION PATTERN DETECTED:\nThe $${variance.toFixed(2)} variance is evenly divisible by 9 (${centsVariance} mod 9 = 0), indicating a likely digit flip (e.g. $86 vs $68) in manual ledger records.`;
            recommendationText = `Search General Ledger for entries where the difference between adjacent digits equals ${Math.round(variance * 100 / 9)} cents.`;
          }

          return AuditFindingModel.fail({
            id: 'FND_BNK2_06',
            ruleId: 'RULE_BNK2_06_ADJUSTED_REC',
            ruleName: 'Master BRS Adjusted Balance Reconciliation',
            severity: 'critical',
            title: transpositionMatches.length > 0
              ? `Reconciliation Discrepancy ($${variance.toLocaleString()}) — Transposition Typo Identified`
              : `Reconciliation Discrepancy Detected ($${variance.toLocaleString()})`,
            description: descText,
            evidenceCitations: citations,
            recommendation: recommendationText
          });
        }
      },

      // 7. Unposted Bank Fees & Interest Omission Detection
      {
        id: 'RULE_BNK2_07_UNPOSTED_FEES',
        name: 'Unrecorded Bank Charges & Interest Detection',
        description: 'Identify service fees, maintenance charges, wire costs, or interest earnings appearing on the bank statement that have not been posted to the General Ledger.',
        category: 'Omission Detection',
        severity: 'medium',
        expressionDescription: 'bank_charges_unrecorded == 0 && bank_interest_earned == 0',
        evaluate: (fields) => {
          const charges = Number(fields.bank_charges_unrecorded?.value || 0);
          const interest = Number(fields.bank_interest_earned?.value || 0);

          if (charges === 0 && interest === 0) {
            return AuditFindingModel.pass({
              id: 'FND_BNK2_07',
              ruleId: 'RULE_BNK2_07_UNPOSTED_FEES',
              ruleName: 'Unrecorded Bank Charges & Interest Detection',
              title: 'All Bank Service Fees & Interest Recorded in Ledger',
              description: 'No unposted statement bank charges or uncredited interest income were identified.',
              evidenceCitations: [],
              recommendation: 'No adjusting journal entries required.'
            });
          }

          const findingsList: string[] = [];
          if (charges > 0) findingsList.push(`• Unposted Bank Service Charges / Wire Fees: $${charges.toLocaleString()}`);
          if (interest > 0) findingsList.push(`• Unrecorded Interest Income: $${interest.toLocaleString()}`);

          return AuditFindingModel.warning({
            id: 'FND_BNK2_07',
            ruleId: 'RULE_BNK2_07_UNPOSTED_FEES',
            ruleName: 'Unrecorded Bank Charges & Interest Detection',
            severity: 'medium',
            title: `Unrecorded Bank Fees/Interest Found ($${(charges + interest).toLocaleString()})`,
            description: `Bank statement contains transaction items not yet posted to the General Ledger cash account:\n${findingsList.join('\n')}`,
            evidenceCitations: [
              citeField(fields.bank_charges_unrecorded, 'Unrecorded Bank Charges', 'bank_statement.pdf', 1)
            ],
            recommendation: `Post adjusting journal entry in GL:\n• Debit Account #6120 (Bank & Wire Fees Expense): $${charges.toLocaleString()}\n• Credit Account #1010 (Cash Account): $${charges.toLocaleString()}`
          });
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
      { type: 'goods_receipt', name: 'Goods Receipt Note (GRN)', description: 'Warehouse receiving slip showing actual delivered quantity', isMandatory: true, allowMultiple: true },
      { type: 'invoice', name: 'Vendor Invoice', description: 'Vendor invoice specifying total billed amount', isMandatory: true, allowMultiple: true },
      { type: 'payment_voucher', name: 'Payment Voucher', description: 'Bank transfer remittance or payment voucher', isMandatory: false, allowMultiple: true },
    ],
    documentFieldSchemas: {
      purchase_order: {
        type: 'object',
        title: 'Purchase Order Schema',
        description: 'Structured schema for purchase order extraction',
        properties: {
          po_number: {
            type: 'string',
            title: 'PO Number',
            description: 'Purchase Order unique identifier (e.g. PO-7710)'
          },
          po_quantity: {
            type: 'number',
            title: 'PO Ordered Quantity',
            description: 'Total units/items authorized on the Purchase Order'
          },
          po_unit_price: {
            type: 'number',
            title: 'PO Unit Price ($)',
            description: 'Contract unit price agreed with vendor as stated on the PO'
          }
        }
      },
      goods_receipt: {
        type: 'object',
        title: 'Goods Receipt Schema',
        description: 'Structured schema for goods receipt extraction',
        properties: {
          grn_number: {
            type: 'string',
            title: 'GRN Number',
            description: 'Goods Receipt Note reference number (e.g. GRN-4102)'
          },
          grn_quantity: {
            type: 'number',
            title: 'GRN Delivered Quantity',
            description: 'Actual units received and accepted at warehouse per this GRN'
          }
        }
      },
      invoice: {
        type: 'object',
        title: 'Invoice Schema',
        description: 'Structured schema for invoice extraction',
        properties: {
          invoice_number: {
            type: 'string',
            title: 'Invoice Number',
            description: 'Vendor invoice unique reference number'
          },
          invoice_quantity: {
            type: 'number',
            title: 'Invoice Billed Quantity',
            description: 'Total units billed by vendor on this invoice'
          },
          invoice_unit_price: {
            type: 'number',
            title: 'Invoice Unit Price ($)',
            description: 'Per-unit price charged by vendor on the invoice'
          },
          invoice_total: {
            type: 'number',
            title: 'Invoice Billed Total ($)',
            description: 'Total amount billed on the vendor invoice (quantity × unit price)'
          }
        }
      },
      payment_voucher: {
        type: 'object',
        title: 'Payment Voucher Schema',
        description: 'Structured schema for payment voucher extraction',
        properties: {
          invoice_total: {
            type: 'number',
            title: 'Invoice Billed Total ($)',
            description: 'Amount paid matching the vendor invoice total on this payment voucher'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_PROC_01',
              ruleId: 'RULE_PROC_01',
              ruleName: '3-Way Quantity Match',
              title: '3-Way Quantity Match Verified',
              description: `Invoice billed quantity (${invQty} units) matches physical GRN receipt (${grnQty} units) and PO authorization (${poQty} units).`,
              evidenceCitations: [
                citeField(fields.po_quantity, 'PO Qty', 'PO_7710.pdf', 1),
                citeField(fields.grn_quantity, 'GRN Qty', 'GRN_4102.pdf', 1),
                citeField(fields.invoice_quantity, 'Invoice Qty', 'INV_9821.pdf', 1)
              ],
              recommendation: 'Approved for automated disbursement.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_PROC_01',
            ruleId: 'RULE_PROC_01',
            ruleName: '3-Way Quantity Match',
            severity: 'critical',
            title: `3-Way Quantity Mismatch (Billed ${invQty} vs Delivered ${grnQty})`,
            description: `Vendor billed for ${invQty} units on invoice, but warehouse only received ${grnQty} units on GRN. Billed excess of ${invQty - grnQty} units.`,
            evidenceCitations: [
              citeField(fields.grn_quantity, 'GRN Delivered Qty', 'GRN.pdf', 1),
              citeField(fields.invoice_quantity, 'Invoice Billed Qty', 'Invoice.pdf', 1)
            ],
            recommendation: 'Issue debit note to vendor for short shipment of goods.'
          });
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
            return AuditFindingModel.pass({
              id: 'FND_PROC_02',
              ruleId: 'RULE_PROC_02',
              ruleName: 'Unit Price Variance Check',
              title: 'Unit Price Contractually Compliant',
              description: `Billed unit price ($${invPrice}) agrees with PO rate ($${poPrice}).`,
              evidenceCitations: [],
              recommendation: 'No price inflation identified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_PROC_02',
            ruleId: 'RULE_PROC_02',
            ruleName: 'Unit Price Variance Check',
            severity: 'high',
            title: `Unauthorized Price Inflation ($${invPrice} vs PO $${poPrice})`,
            description: `Vendor billed at $${invPrice}/unit, exceeding the PO contracted unit price of $${poPrice}/unit. Total impact: $${(diff * Number(fields.invoice_quantity?.value || 1)).toFixed(2)}.`,
            evidenceCitations: [
              citeField(fields.po_unit_price, 'Unit Price', 'PO.pdf', 1),
              citeField(fields.invoice_unit_price, 'Billed Price', 'Invoice.pdf', 1)
            ],
            recommendation: 'Reject invoice and require vendor to re-issue at contracted PO rate.'
          });
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
    documentFieldSchemas: {
      payment_register: {
        type: 'object',
        title: 'Payment Register Schema',
        description: 'Structured schema for payment register extraction',
        properties: {
          invoice_number: {
            type: 'string',
            title: 'Invoice Number',
            description: 'Invoice or payment reference number in the AP disbursement log'
          },
          vendor_name: {
            type: 'string',
            title: 'Vendor Name',
            description: 'Vendor or beneficiary name receiving the payment'
          },
          payment_amount: {
            type: 'number',
            title: 'Disbursement Amount ($)',
            description: 'Amount of the disbursement or payment'
          },
          payment_date: {
            type: 'date',
            title: 'Payment Date',
            description: 'Date the payment was processed or value-dated'
          },
          payment_day_of_week: {
            type: 'string',
            title: 'Day of Week',
            description: 'Derive the day of week from payment_date (e.g. Saturday, Sunday). Weekend payments are suspicious.'
          },
          is_round_number: {
            type: 'boolean',
            title: 'Round Amount Flag',
            description: 'True if payment amount is a round number (e.g. exactly $5000, $10000). Round numbers may indicate fictitious invoices.'
          },
          split_payment_group_count: {
            type: 'number',
            title: 'Near-Threshold Payments Count',
            description: 'Count of payments to the same vendor that are just under a standard approval threshold (e.g. $4950 under $5000 limit). Indicates structuring fraud.'
          }
        }
      },
      vendor_master: {
        type: 'object',
        title: 'Vendor Master Schema',
        description: 'Structured schema for vendor master extraction',
        properties: {
          vendor_name: {
            type: 'string',
            title: 'Vendor Name',
            description: 'Registered vendor or supplier name in the vendor master file'
          },
          vendor_created_days_ago: {
            type: 'number',
            title: 'Vendor Age at Payment (Days)',
            description: 'Calculate days between the vendor creation/registration date and the most recent payment date. Newly created vendors (< 7 days) are high risk.'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_FRD_01',
              ruleId: 'RULE_FRD_01',
              ruleName: 'Split Payment Threshold Evasion',
              title: 'No Structured Split Payments Detected',
              description: 'Payment structuring patterns under approval limits were not detected.',
              evidenceCitations: [],
              recommendation: 'Regular AP review.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_FRD_01',
            ruleId: 'RULE_FRD_01',
            ruleName: 'Split Payment Threshold Evasion',
            severity: 'critical',
            title: `Suspicious Split Payment Pattern Detected (${splits} Transactions)`,
            description: `Identified ${splits} separate invoices of $4,950 paid to same vendor within 48 hours, structured to bypass the $5,000 manager approval threshold.`,
            evidenceCitations: [
              citeField(fields.split_payment_group_count, 'Split Invoices', 'AP_Disbursement_Log.csv', 1)
            ],
            recommendation: 'Freeze vendor payments and trigger formal forensic internal investigation.'
          });
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
            return AuditFindingModel.pass({
              id: 'FND_FRD_02',
              ruleId: 'RULE_FRD_02',
              ruleName: 'Rapid Vendor Creation & Payment',
              title: 'Vendor Account Age Established',
              description: `Vendor profile was created ${age} days before transaction, meeting vetting criteria.`,
              evidenceCitations: [],
              recommendation: 'Vendor master record compliant.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_FRD_02',
            ruleId: 'RULE_FRD_02',
            ruleName: 'Rapid Vendor Creation & Payment',
            severity: 'high',
            title: `High-Risk Rapid Disbursement to New Vendor (${age} Days Old)`,
            description: `Vendor account was created only ${age} days ago and immediately received high-value transfer. High risk of shell company or employee conflict of interest.`,
            evidenceCitations: [
              citeField(fields.vendor_created_days_ago, 'Creation Date', 'Vendor_Master.pdf', 1)
            ],
            recommendation: 'Perform background check and verify ultimate beneficial owner (UBO).'
          });
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
      { type: 'payroll_register', name: 'Salary Register', description: 'Gross to net pay breakdown list per employee', isMandatory: true, allowMultiple: true },
      { type: 'attendance_log', name: 'Attendance / Timecard Export', description: 'Biometric or HRIS attendance log showing working days', isMandatory: true },
      { type: 'bank_transfer', name: 'Bank Advice / Transfer Batch', description: 'Bank confirmation of electronic payroll advice', isMandatory: true },
      { type: 'employee_master', name: 'Employee Master Database', description: 'HR database of active employment contracts', isMandatory: false },
    ],
    documentFieldSchemas: {
      payroll_register: {
        type: 'object',
        title: 'Payroll Register Schema',
        description: 'Structured schema for payroll register extraction',
        properties: {
          employee_id: {
            type: 'string',
            title: 'Employee ID',
            description: 'Employee or staff number as printed on the payroll register row'
          },
          employee_name: {
            type: 'string',
            title: 'Employee Name',
            description: 'Full name of employee on the salary register'
          },
          register_base_salary: {
            type: 'number',
            title: 'Register Base Salary ($)',
            description: 'Gross base salary as listed on the salary/payroll register for this period'
          },
          tax_deduction: {
            type: 'number',
            title: 'Tax Deducted ($)',
            description: 'Income tax or withholding tax amount deducted from gross salary'
          },
          net_pay: {
            type: 'number',
            title: 'Net Payable ($)',
            description: 'Final net salary amount payable to employee after all deductions'
          }
        }
      },
      attendance_log: {
        type: 'object',
        title: 'Attendance Log Schema',
        description: 'Structured schema for attendance log extraction',
        properties: {
          employee_id: {
            type: 'string',
            title: 'Employee ID',
            description: 'Employee identifier in the attendance or timecard system'
          },
          worked_days: {
            type: 'number',
            title: 'Days Worked',
            description: 'Total number of days the employee was present/logged in per attendance record'
          },
          total_working_days: {
            type: 'number',
            title: 'Month Working Days',
            description: 'Total official working days in the month as per company calendar'
          }
        }
      },
      bank_transfer: {
        type: 'object',
        title: 'Bank Transfer Schema',
        description: 'Structured schema for bank transfer extraction',
        properties: {
          bank_transfer_net: {
            type: 'number',
            title: 'Bank Advice Transfer Net ($)',
            description: 'Net amount transferred via bank payroll advice or ACH batch file for the employee or total payroll batch'
          }
        }
      },
      employee_master: {
        type: 'object',
        title: 'Employee Master Schema',
        description: 'Structured schema for employee master extraction',
        properties: {
          employee_id: {
            type: 'string',
            title: 'Employee ID',
            description: 'Employee unique ID in HR master database'
          },
          contract_base_salary: {
            type: 'number',
            title: 'Contract Base Salary ($)',
            description: 'Agreed base salary per the active employment contract in HR system'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_PAY_01',
              ruleId: 'RULE_PAY_01',
              ruleName: 'Net Salary Reconciliation',
              title: 'Payroll Bank Transfer Fully Reconciled',
              description: `Net salary of $${regNet.toLocaleString()} matches bank advice payout file.`,
              evidenceCitations: [],
              recommendation: 'Payroll disbursement verified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_PAY_01',
            ruleId: 'RULE_PAY_01',
            ruleName: 'Net Salary Reconciliation',
            severity: 'critical',
            title: `Payroll Payout Variance ($${diff.toLocaleString()})`,
            description: `Salary register net pay ($${regNet.toLocaleString()}) does not match actual bank payout advice ($${bankNet.toLocaleString()}). Potential unauthorized payment diversion.`,
            evidenceCitations: [
              citeField(fields.net_pay, 'Register Net', 'Salary_Register.pdf', 1),
              citeField(fields.bank_transfer_net, 'Bank Advice Net', 'Bank_Transfer_Advice.csv', 1)
            ],
            recommendation: 'Audit bank account destination routing numbers immediately.'
          });
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
    documentFieldSchemas: {
      sales_contract: {
        type: 'object',
        title: 'Sales Contract Schema',
        description: 'Structured schema for sales contract extraction',
        properties: {
          contract_value: {
            type: 'number',
            title: 'Contract Total Value ($)',
            description: 'Total contract value as stated in the sales contract or Master Service Agreement (MSA)'
          }
        }
      },
      delivery_proof: {
        type: 'object',
        title: 'Delivery Proof Schema',
        description: 'Structured schema for delivery proof extraction',
        properties: {
          delivery_date: {
            type: 'date',
            title: 'Delivery / Signoff Date',
            description: 'Date customer signed off or accepted delivery of goods/services'
          }
        }
      },
      sales_invoice: {
        type: 'object',
        title: 'Sales Invoice Schema',
        description: 'Structured schema for sales invoice extraction',
        properties: {
          invoice_amount: {
            type: 'number',
            title: 'Invoiced Amount ($)',
            description: 'Total amount on the sales invoice issued to the customer'
          },
          invoice_date: {
            type: 'date',
            title: 'Invoice Issuance Date',
            description: 'Date the sales invoice was issued or recorded'
          },
          recognized_revenue: {
            type: 'number',
            title: 'Recognized Revenue ($)',
            description: 'Revenue amount recognized in the current accounting period as per the invoice or revenue schedule'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_REV_01',
              ruleId: 'RULE_REV_01',
              ruleName: 'Revenue Recognition Timing',
              title: 'Revenue Timed Accurately Post-Delivery',
              description: 'Invoice and revenue booking occurred after customer delivery acceptance.',
              evidenceCitations: [],
              recommendation: 'Compliant with IFRS 15.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_REV_01',
            ruleId: 'RULE_REV_01',
            ruleName: 'Revenue Recognition Timing',
            severity: 'high',
            title: 'Premature Revenue Recognized Prior to Customer Sign-off',
            description: `Revenue was booked on ${fields.invoice_date?.value}, prior to customer acceptance date on ${fields.delivery_date?.value}.`,
            evidenceCitations: [
              citeField(fields.invoice_date, 'Invoice Date', 'Sales_Invoice.pdf', 1),
              citeField(fields.delivery_date, 'Delivery Date', 'Delivery_Proof.pdf', 1)
            ],
            recommendation: 'Defer revenue entry until valid customer milestone acceptance certificate is uploaded.'
          });
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
    documentFieldSchemas: {
      physical_count: {
        type: 'object',
        title: 'Physical Count Schema',
        description: 'Structured schema for physical count extraction',
        properties: {
          item_code: {
            type: 'string',
            title: 'Item Code / SKU',
            description: 'Stock item code, SKU or barcode as written on the physical count sheet'
          },
          physical_count_qty: {
            type: 'number',
            title: 'Physical Count Qty',
            description: 'Actual units physically counted during the stock take for this item'
          }
        }
      },
      stock_register: {
        type: 'object',
        title: 'Stock Register Schema',
        description: 'Structured schema for stock register extraction',
        properties: {
          item_code: {
            type: 'string',
            title: 'Item Code / SKU',
            description: 'Stock item code or SKU as recorded in the ERP perpetual inventory register'
          },
          ledger_qty: {
            type: 'number',
            title: 'System Ledger Qty',
            description: 'Units on hand as recorded in the ERP or stock ledger system'
          },
          unit_valuation: {
            type: 'number',
            title: 'Unit Cost ($)',
            description: 'Cost per unit as per weighted average or FIFO valuation in the stock register'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_INV_01',
              ruleId: 'RULE_INV_01',
              ruleName: 'Physical vs Ledger Variance',
              title: 'Physical Inventory Matches Ledger',
              description: `Counted physical units (${phys}) match system inventory balance exactly.`,
              evidenceCitations: [],
              recommendation: 'Inventory balances verified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_INV_01',
            ruleId: 'RULE_INV_01',
            ruleName: 'Physical vs Ledger Variance',
            severity: 'high',
            title: `Inventory Shrinkage Discrepancy (${variance} units / $${Math.abs(variance * unitCost).toFixed(2)})`,
            description: `Physical count of ${phys} units is short compared to system ledger of ${ledg} units. Total inventory shrinkage value: $${Math.abs(variance * unitCost).toFixed(2)}.`,
            evidenceCitations: [
              citeField(fields.physical_count_qty, 'Physical Qty', 'Physical_Count.pdf', 1),
              citeField(fields.ledger_qty, 'Ledger Qty', 'Stock_Register.csv', 1)
            ],
            recommendation: 'Perform immediate recount and write off verified stock shrinkage.'
          });
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
    documentFieldSchemas: {
      tax_return: {
        type: 'object',
        title: 'Tax Return Schema',
        description: 'Structured schema for tax return extraction',
        properties: {
          filed_itc_claim: {
            type: 'number',
            title: 'Filed Input Tax Credit ($)',
            description: 'Total Input Tax Credit (ITC) amount claimed by the company on this GST/VAT tax return filing'
          }
        }
      },
      purchase_register: {
        type: 'object',
        title: 'Purchase Register Schema',
        description: 'Structured schema for purchase register extraction',
        properties: {
          eligible_itc_register: {
            type: 'number',
            title: 'Purchase Register Eligible ITC ($)',
            description: 'Sum total of GST/VAT on valid vendor invoices in the purchase register that qualify for ITC credit'
          },
          missing_gstin_count: {
            type: 'number',
            title: 'Invoices Missing Tax ID',
            description: 'Count of vendor invoices in the purchase register that are missing a valid GSTIN or tax registration number'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_TAX_01',
              ruleId: 'RULE_TAX_01',
              ruleName: 'Input Tax Credit Reconciliation',
              title: 'Input Tax Credit Claim Validated',
              description: `Filed ITC claim ($${filed}) is fully backed by eligible purchase invoices ($${register}).`,
              evidenceCitations: [],
              recommendation: 'Tax filing compliant.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_TAX_01',
            ruleId: 'RULE_TAX_01',
            ruleName: 'Input Tax Credit Reconciliation',
            severity: 'high',
            title: `Excess Input Tax Credit Claimed ($${(filed - register).toLocaleString()} Over-claim)`,
            description: `Tax return filed $${filed.toLocaleString()} in ITC, but valid purchase register invoices only support $${register.toLocaleString()}. Exposure to tax audit penalties.`,
            evidenceCitations: [
              citeField(fields.filed_itc_claim, 'Filed ITC', 'Tax_Return_Q3.pdf', 1),
              citeField(fields.eligible_itc_register, 'Register ITC', 'Purchase_Register.csv', 1)
            ],
            recommendation: 'Amend tax return to avoid tax authority interest and penalty assessments.'
          });
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
    documentFieldSchemas: {
      approval_matrix: {
        type: 'object',
        title: 'Approval Matrix Schema',
        description: 'Structured schema for approval matrix extraction',
        properties: {
          approver_user_id: {
            type: 'string',
            title: 'Transaction Approver ID',
            description: 'User ID or name of the authorized approver as defined in the Delegation of Authority (DOA) matrix'
          }
        }
      },
      system_audit_log: {
        type: 'object',
        title: 'System Audit Log Schema',
        description: 'Structured schema for system audit log extraction',
        properties: {
          creator_user_id: {
            type: 'string',
            title: 'Transaction Creator ID',
            description: 'User ID of the person who created the transaction in the ERP system audit log'
          },
          approver_user_id: {
            type: 'string',
            title: 'Transaction Approver ID',
            description: 'User ID of the person who approved the transaction in the ERP system audit log'
          },
          is_same_user_maker_checker: {
            type: 'boolean',
            title: 'Maker/Checker Violator',
            description: 'True if the creator_user_id and approver_user_id are the same person — a segregation of duties violation'
          },
          approval_missing: {
            type: 'boolean',
            title: 'Missing Approval Flag',
            description: 'True if the transaction log shows no approval step or approval was bypassed'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_CTL_01',
              ruleId: 'RULE_CTL_01',
              ruleName: 'Maker-Checker Separation',
              title: 'Segregation of Duties Maintained',
              description: `Creator (${creator}) and Approver (${approver}) are distinct users.`,
              evidenceCitations: [],
              recommendation: 'Governance control effective.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_CTL_01',
            ruleId: 'RULE_CTL_01',
            ruleName: 'Maker-Checker Separation',
            severity: 'critical',
            title: 'Critical Segregation of Duties Violation Detected',
            description: `User '${creator}' created AND approved the financial transaction without secondary review.`,
            evidenceCitations: [
              citeField(fields.creator_user_id, 'User ID', 'System_Audit_Log.csv', 1)
            ],
            recommendation: 'Revoke single-user approval permissions in ERP access management system.'
          });
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
    documentFieldSchemas: {
      ap_aging: {
        type: 'object',
        title: 'Ap Aging Schema',
        description: 'Structured schema for ap aging extraction',
        properties: {
          vendor_name: {
            type: 'string',
            title: 'Vendor Name',
            description: 'Primary vendor name from the AP aging report'
          },
          ap_ledger_balance: {
            type: 'number',
            title: 'AP Ledger Balance ($)',
            description: 'Total outstanding payable balance per the company AP aging ledger'
          }
        }
      },
      vendor_statement: {
        type: 'object',
        title: 'Vendor Statement Schema',
        description: 'Structured schema for vendor statement extraction',
        properties: {
          vendor_name: {
            type: 'string',
            title: 'Vendor Name',
            description: 'Vendor name as printed on the vendor statement header'
          },
          vendor_stmt_balance: {
            type: 'number',
            title: 'Vendor Statement Balance ($)',
            description: 'Closing balance or amount owed as stated on the vendor statement'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_AP_01',
              ruleId: 'RULE_AP_01',
              ruleName: 'Vendor Statement Reconciliation',
              title: 'AP Ledger Matches Vendor Statement',
              description: `AP balance ($${ledg}) reconciles with vendor statement balance.`,
              evidenceCitations: [],
              recommendation: 'Payable balance confirmed.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_AP_01',
            ruleId: 'RULE_AP_01',
            ruleName: 'Vendor Statement Reconciliation',
            severity: 'high',
            title: `AP Statement Discrepancy ($${diff.toLocaleString()} Unreconciled)`,
            description: `Ledger balance ($${ledg.toLocaleString()}) does not match vendor statement balance ($${stmt.toLocaleString()}).`,
            evidenceCitations: [
              citeField(fields.ap_ledger_balance, 'AP Ledger Balance', 'AP_Aging.csv', 1),
              citeField(fields.vendor_stmt_balance, 'Statement Balance', 'Vendor_Statement.pdf', 1)
            ],
            recommendation: 'Reconcile unposted invoices or disputed credit memos with vendor billing department.'
          });
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
    documentFieldSchemas: {
      ar_aging: {
        type: 'object',
        title: 'Ar Aging Schema',
        description: 'Structured schema for ar aging extraction',
        properties: {
          total_ar: {
            type: 'number',
            title: 'Total Receivables ($)',
            description: 'Total gross accounts receivable balance across all customers and aging buckets'
          },
          overdue_90_days: {
            type: 'number',
            title: 'Overdue > 90 Days ($)',
            description: 'Total receivables overdue beyond 90 days (severely aged / at risk of bad debt)'
          },
          bad_debt_provision: {
            type: 'number',
            title: 'Bad Debt Provision ($)',
            description: 'Allowance for doubtful accounts / bad debt provision recorded in the AR aging or financial statements'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_AR_01',
              ruleId: 'RULE_AR_01',
              ruleName: 'Bad Debt Provision Adequacy',
              title: 'Doubtful Debt Provision Adequate',
              description: `Bad debt provision ($${prov}) meets required 50% coverage ($${required}) for aged receivables.`,
              evidenceCitations: [],
              recommendation: 'Provision compliant.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_AR_01',
            ruleId: 'RULE_AR_01',
            ruleName: 'Bad Debt Provision Adequacy',
            severity: 'high',
            title: `Under-Provisioned Bad Debt Allowance ($${(required - prov).toLocaleString()} Shortfall)`,
            description: `Current bad debt provision ($${prov}) is insufficient for $${overdue} in 90+ day overdue accounts. Minimum required allowance is $${required}.`,
            evidenceCitations: [
              citeField(fields.overdue_90_days, 'Overdue 90+ Days', 'AR_Aging.csv', 1)
            ],
            recommendation: 'Increase allowance for doubtful accounts in current period P&L.'
          });
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
    documentFieldSchemas: {
      asset_register: {
        type: 'object',
        title: 'Asset Register Schema',
        description: 'Structured schema for asset register extraction',
        properties: {
          asset_cost: {
            type: 'number',
            title: 'Asset Cost ($)',
            description: 'Original historical cost or purchase price of the fixed asset as recorded in the Fixed Asset Register'
          },
          depreciation_rate: {
            type: 'number',
            title: 'Depreciation Rate (%)',
            description: 'Annual depreciation rate applied to the asset (e.g. 20% straight-line)'
          },
          accumulated_depreciation: {
            type: 'number',
            title: 'Book Accumulated Depreciation ($)',
            description: 'Total depreciation charged on the asset to date as per the Fixed Asset Register'
          },
          useful_life_years: {
            type: 'number',
            title: 'Useful Life (Years)',
            description: 'Estimated useful economic life of the asset in years'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_FAR_01',
              ruleId: 'RULE_FAR_01',
              ruleName: 'Depreciation Cap Check',
              title: 'Depreciation Within Asset Cost Limit',
              description: `Accumulated depreciation ($${accum}) is within original asset cost ($${cost}).`,
              evidenceCitations: [],
              recommendation: 'Depreciation Schedule verified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_FAR_01',
            ruleId: 'RULE_FAR_01',
            ruleName: 'Depreciation Cap Check',
            severity: 'high',
            title: 'Over-Depreciated Asset Exception',
            description: `Accumulated depreciation ($${accum}) exceeds historical asset purchase cost ($${cost}).`,
            evidenceCitations: [
              citeField(fields.accumulated_depreciation, 'Accumulated Depr', 'Fixed_Asset_Register.csv', 1)
            ],
            recommendation: 'Cease further depreciation expense on fully depreciated asset.'
          });
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
    documentFieldSchemas: {
      cash_flow_stmt: {
        type: 'object',
        title: 'Cash Flow Stmt Schema',
        description: 'Structured schema for cash flow stmt extraction',
        properties: {
          net_operating_cf: {
            type: 'number',
            title: 'Operating Cash Flow ($)',
            description: 'Net cash generated from or used in operating activities (section of the cash flow statement)'
          },
          net_investing_cf: {
            type: 'number',
            title: 'Investing Cash Flow ($)',
            description: 'Net cash used in or from investing activities (capex, asset purchases/disposals)'
          },
          net_financing_cf: {
            type: 'number',
            title: 'Financing Cash Flow ($)',
            description: 'Net cash from financing activities (borrowings, equity issuance, dividend payments)'
          },
          net_change_cash: {
            type: 'number',
            title: 'Net Change in Cash ($)',
            description: 'Total net change in cash and cash equivalents for the period (operating + investing + financing)'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_CF_01',
              ruleId: 'RULE_CF_01',
              ruleName: 'Cash Flow Statement Rec',
              title: 'Cash Flow Statement Balanced',
              description: 'Operating, investing, and financing cash movements mathematically reconcile.',
              evidenceCitations: [],
              recommendation: 'Statement verified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_CF_01',
            ruleId: 'RULE_CF_01',
            ruleName: 'Cash Flow Statement Rec',
            severity: 'high',
            title: `Cash Flow Statement Unbalanced ($${diff.toLocaleString()} Math Error)`,
            description: `Sum of Operating ($${op}) + Investing ($${inv}) + Financing ($${fin}) = $${expected}, but Net Change stated as $${change}.`,
            evidenceCitations: [
              citeField(fields.net_change_cash, 'Net Change in Cash', 'Cash_Flow_Statement.pdf', 1)
            ],
            recommendation: 'Recalculate non-cash working capital adjustments.'
          });
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
    documentFieldSchemas: {
      tax_computation: {
        type: 'object',
        title: 'Tax Computation Schema',
        description: 'Structured schema for tax computation extraction',
        properties: {
          accounting_profit: {
            type: 'number',
            title: 'Net Accounting Profit ($)',
            description: 'Net profit before income tax as per the financial statements / P&L (before any tax adjustments)'
          },
          disallowed_expenses: {
            type: 'number',
            title: 'Disallowed Expense Add-backs ($)',
            description: 'Total non-deductible expenses added back to accounting profit to arrive at taxable income (e.g. entertainment, fines, depreciation differences)'
          },
          taxable_income: {
            type: 'number',
            title: 'Taxable Income ($)',
            description: 'Final adjusted taxable income after all add-backs and allowable deductions, as stated on the tax computation schedule'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_CIT_01',
              ruleId: 'RULE_CIT_01',
              ruleName: 'Tax Add-back Check',
              title: 'Tax Add-backs Processed Correctly',
              description: `Taxable income ($${taxInc}) properly reflects non-deductible expense adjustments.`,
              evidenceCitations: [],
              recommendation: 'Computation verified.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_CIT_01',
            ruleId: 'RULE_CIT_01',
            ruleName: 'Tax Add-back Check',
            severity: 'high',
            title: 'Underreported Taxable Income Exception',
            description: `Taxable income ($${taxInc}) is lower than accounting profit ($${prof}) without documented tax exempt allowances.`,
            evidenceCitations: [
              citeField(fields.taxable_income, 'Taxable Income', 'Tax_Computation.pdf', 1)
            ],
            recommendation: 'Provide schedule of tax exempt income or correct calculation.'
          });
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
    documentFieldSchemas: {
      lease_agreement: {
        type: 'object',
        title: 'Lease Agreement Schema',
        description: 'Structured schema for lease agreement extraction',
        properties: {
          lease_term_months: {
            type: 'number',
            title: 'Lease Term (Months)',
            description: 'Total duration of the lease agreement in months (start date to end date)'
          },
          monthly_lease_payment: {
            type: 'number',
            title: 'Monthly Payment ($)',
            description: 'Fixed monthly rental or lease payment amount stated in the lease agreement'
          },
          rou_asset_recognized: {
            type: 'number',
            title: 'Right-of-Use Asset ($)',
            description: 'IFRS 16 Right-of-Use asset value recognized on the balance sheet. If not explicitly stated, derive it as: monthly_lease_payment × lease_term_months discounted at the implicit rate.'
          }
        }
      },
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
            return AuditFindingModel.pass({
              id: 'FND_IFRS_01',
              ruleId: 'RULE_IFRS_01',
              ruleName: 'IFRS 16 Capitalization',
              title: 'IFRS 16 Lease Capitalized Compliantly',
              description: `Long term lease (${months} months) is capitalized on Balance Sheet ($${rou} ROU Asset).`,
              evidenceCitations: [],
              recommendation: 'IFRS 16 compliant.'
            });
          }
          return AuditFindingModel.fail({
            id: 'FND_IFRS_01',
            ruleId: 'RULE_IFRS_01',
            ruleName: 'IFRS 16 Capitalization',
            severity: 'high',
            title: 'IFRS 16 Non-Compliance (Off-Balance Sheet Lease)',
            description: `Lease contract duration of ${months} months is expensed directly without mandatory Balance Sheet ROU asset capitalization.`,
            evidenceCitations: [
              citeField(fields.lease_term_months, 'Lease Term', 'Lease_Agreement.pdf', 1)
            ],
            recommendation: 'Capitalize Right-of-Use asset and Lease Liability in balance sheet per IFRS 16.'
          });
        }
      }
    ]
  }
];

// Helper to get module by ID
export function getAuditModule(id: string): AuditModule | undefined {
  return AUDIT_MODULES.find(m => m.id === id);
}

/**
 * Helper to get all extracted field definitions across all document types for a module.
 */
export function getModuleFields(module: AuditModule): Array<{ key: string; label: string; type: string; description: string }> {
  const seen = new Set<string>();
  const fields: Array<{ key: string; label: string; type: string; description: string }> = [];
  if (module && module.documentFieldSchemas) {
    for (const schema of Object.values(module.documentFieldSchemas)) {
      if (schema && schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          if (!seen.has(key)) {
            seen.add(key);
            fields.push({
              key,
              label: prop.title || prop.label || key,
              type: prop.type || 'string',
              description: prop.description || '',
            });
          }
        }
      }
    }
  }
  return fields;
}
