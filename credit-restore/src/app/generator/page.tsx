'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { jsPDF } from 'jspdf'

type LetterType = 'validation' | 'fcra' | 'fdcpa' | 'goodwill' | 'packet'

interface FormData {
  // Personal
  fullName: string
  address: string
  city: string
  state: string
  zip: string
  // Debt
  creditorName: string
  accountNumber: string
  debtAmount: string
  bureau: 'experian' | 'equifax' | 'transunion' | 'all'
  reportDate: string
  // Letter
  letterType: LetterType
  disputeReason: 'identity_theft' | 'inaccurate_reporting' | 'not_mine' | 'paid_not_updated'
  date: string
}

export default function Generator() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    creditorName: '',
    accountNumber: '',
    debtAmount: '',
    bureau: 'all',
    reportDate: '',
    letterType: 'validation',
    disputeReason: 'inaccurate_reporting',
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  })
  const [generatedLetter, setGeneratedLetter] = useState('')
  const letterRef = useRef<HTMLDivElement>(null)

  const updateField = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const generateLetter = () => {
    const { fullName, address, city, state, zip, creditorName, accountNumber, debtAmount, bureau, reportDate, letterType, disputeReason, date } = formData
    const fullAddress = `${address}, ${city}, ${state} ${zip}`
    
    let letter = ''

    switch (letterType) {
      case 'validation':
        letter = `
${fullName}
${fullAddress}
${date}

VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED

${creditorName || '[CREDITOR NAME]'}
[ADDRESS]
[CITY, STATE ZIP]

RE: Account # ${accountNumber || '[ACCOUNT NUMBER]'}

Dear Sir/Madam:

Pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g, I hereby dispute the above-referenced debt and request validation.

I am requesting that you provide the following:

1. Proof I owe this debt - Original signed agreement or credit application
2. Chain of custody - Documentation showing how this debt was transferred from the original creditor to your company
3. Original creditor name - The name of the original creditor and account number
4. Itemized statement - A detailed breakdown showing the current balance and how it was calculated

Until you provide this validation, I demand that you:
- STOP all collection activities
- REMOVE this account from my credit reports
- CEASE reporting to any credit bureau

If you cannot validate this debt, you must cease collection and delete all reporting per FDCPA § 1692g(a)(4).

I reserve all rights under federal and state law. Failure to respond within 30 days will be considered a violation of the FDCPA.

Sincerely,

${fullName}
${fullAddress}
`
        break

      case 'fcra':
        letter = `
${fullName}
${fullAddress}
${date}

VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED

Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374

RE: Dispute of Account - ${creditorName || '[CREDITOR NAME]'}

Dear Dispute Department:

I am disputing the following account on my credit report:

- Creditor: ${creditorName || '[CREDITOR NAME]'}
- Account #: ${accountNumber || '[ACCOUNT NUMBER]'}
- Reported Balance: $${debtAmount || '[AMOUNT]'}

BASIS FOR DISPUTE:

I dispute this debt because:

1. Debt not validated - I have requested debt validation from the creditor. Until they provide proof, they cannot legally report this debt.
2. FCRA Violation - Per 15 U.S.C. § 1681i, you must investigate disputed information within 30 days. If the furnisher cannot verify, it must be deleted.
3. Inaccurate reporting - This debt may be beyond the statute of limitations or otherwise unenforceable.

DEMAND:

Pursuant to the Fair Credit Reporting Act (FCRA), I demand that you:

1. Investigate this dispute immediately
2. Contact the furnisher and require proof of this debt
3. If they cannot verify, DELETE this account from my credit report
4. Provide written confirmation of investigation results

I reserve all rights under the FCRA, including the right to sue for violations.

Sincerely,

${fullName}
${fullAddress}
`
        break

      case 'fdcpa':
        letter = `
${fullName}
${fullAddress}
${date}

VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED

${creditorName || '[CREDITOR NAME]'}
[ADDRESS]
[CITY, STATE ZIP]

RE: CEASE AND DESIST - DEBT COLLECTION

Dear Sir/Madam:

This letter serves as formal notice that I am exercising my rights under the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692c(d).

I hereby demand that you:

1. CEASE all communication with me regarding this debt
2. STOP all collection calls, letters, and attempts to collect
3. NOT report this debt to any credit bureau

Unless you can provide proof that:
- You have a valid judgment against me, OR
- You are the original creditor with a signed contract

...any further attempts to collect are violations of federal law.

I am recording this communication. Any violation of the FDCPA will result in legal action, including statutory damages of up to $1,000 per violation, plus actual damages, attorney fees, and court costs.

Do not contact me except to confirm you are complying with this request.

Sincerely,

${fullName}
${fullAddress}
`
        break

      case 'goodwill':
        letter = `
${fullName}
${fullAddress}
${date}

VIA CERTIFIED MAIL

${creditorName || '[CREDITOR NAME]'}
[ADDRESS]
[CITY, STATE ZIP]

RE: Goodwill Request - Account # ${accountNumber || '[ACCOUNT NUMBER]'}

Dear Sir/Madam:

I am writing to request a goodwill deletion of the account referenced above from my credit report.

I understand that I paid (or am paying) this debt in full/settlement. I am now working to rebuild my credit and would appreciate your help in removing this negative item as a gesture of goodwill.

I have been a loyal customer in the past and would like to continue building my credit responsibly. I kindly ask that you consider deleting this account from my credit report as a courtesy.

If you are able to accommodate this request, please send written confirmation to my address above.

Thank you for your time and consideration.

Sincerely,

${fullName}
${fullAddress}
`
        break

      case 'packet': {
        const reasonTextMap: Record<string, string> = {
          identity_theft: 'I did not authorize or open this account and believe this may be identity theft.',
          inaccurate_reporting: 'The reporting on this account contains inaccurate and/or unverifiable information.',
          not_mine: 'This account is not mine and was reported in error.',
          paid_not_updated: 'This account has been paid/settled and is not reporting accurately.'
        }

        const lawBlockMap: Record<string, string[]> = {
          identity_theft: [
            '15 U.S.C. §1681i - Reinvestigation obligations',
            '15 U.S.C. §1681s-2(a)/(b) - Furnisher accuracy and investigation duties',
            '15 U.S.C. §1681n / §1681o - Civil liability for noncompliance'
          ],
          inaccurate_reporting: [
            '15 U.S.C. §1681e(b) - Maximum possible accuracy',
            '15 U.S.C. §1681i - Reinvestigation and deletion of unverifiable information',
            '15 U.S.C. §1681s-2(b) - Furnisher duty after notice of dispute'
          ],
          not_mine: [
            '15 U.S.C. §1681i(a)(1)(A) - Reinvestigation required',
            '15 U.S.C. §1681i(a)(5) - Delete if unverifiable',
            '15 U.S.C. §1681s-2(b) - Furnisher verification duties'
          ],
          paid_not_updated: [
            '15 U.S.C. §1681s-2(a)(2) - Duty to update/correct information',
            '15 U.S.C. §1681i(a) - Reinvestigation of disputed item',
            '15 U.S.C. §1681e(b) - Reasonable procedures to assure accuracy'
          ]
        }

        const laws = (lawBlockMap[disputeReason] || lawBlockMap.inaccurate_reporting)
          .map((l, i) => `${i + 1}. ${l}`)
          .join('\n');

        letter = `
AFFIDAVIT + CASE LAW PACKET

PACKET INDEX
Exhibit A - Consumer Affidavit
Exhibit B - Legal Notice and Statutory Demand
Exhibit C - Method of Verification (MOV) Demand
Exhibit D - Certified Mail Checklist

============================
EXHIBIT A - CONSUMER AFFIDAVIT
============================

Affiant: ${fullName}
Address: ${fullAddress}
Date: ${date}
Creditor/Furnisher: ${creditorName || '[CREDITOR NAME]'}
Account: ${accountNumber || '[ACCOUNT NUMBER]'}
Reported Balance: $${debtAmount || '[AMOUNT]'}
Bureau(s): ${bureau === 'all' ? 'All (Experian, Equifax, TransUnion)' : bureau}
Credit Report Date: ${reportDate || '[REPORT DATE]'}

I, ${fullName}, being of lawful age and under penalty of perjury, declare:

1. I have personal knowledge of the facts in this affidavit.
2. ${reasonTextMap[disputeReason] || reasonTextMap.inaccurate_reporting}
3. I dispute the above account and demand deletion if it cannot be verified with competent evidence.
4. I authorize reinvestigation and correction/deletion of inaccurate or unverifiable data.

Signature: ____________________________
Date: _________________________________

============================
EXHIBIT B - LEGAL NOTICE
============================

To: ${creditorName || '[CREDITOR NAME]'} and relevant consumer reporting agencies.

This is a formal dispute and legal notice regarding Account ${accountNumber || '[ACCOUNT NUMBER]'}.

Applicable authority includes:
${laws}

DEMAND:
- Conduct lawful reinvestigation/verification
- Provide documentary proof of accuracy
- Delete or correct any inaccurate/unverifiable reporting

============================
EXHIBIT C - METHOD OF VERIFICATION (MOV) DEMAND
============================

Provide the method and documentary basis used to verify this account, including:
- Original contract/application
- Chain of title/assignment (if applicable)
- Payment/balance ledger
- Date and source of verification

============================
EXHIBIT D - SEND CHECKLIST
============================

[ ] Print packet
[ ] Sign affidavit
[ ] Add supporting documents (ID, utility bill, payment proof, police report if applicable)
[ ] Send via certified mail with return receipt
[ ] Keep copies and tracking records
`
        break
      }
    }

    setGeneratedLetter(letter.trim())
    setStep(4)
  }

  const downloadPDF = () => {
    const doc = new jsPDF()
    
    // Add letter content
    const lines = generatedLetter.split('\n')
    let y = 20
    
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 170)
      doc.text(wrapped, 20, y)
      y += wrapped.length * 7
    })
    
    doc.save(`${formData.letterType}_letter_${formData.fullName.replace(/\s+/g, '_')}.pdf`)
  }

  const steps = [
    { num: 1, label: 'Your Info' },
    { num: 2, label: 'Debt Details' },
    { num: 3, label: 'Letter Type' },
    { num: 4, label: 'Download' }
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🛡️</span>
            <span className="text-xl font-bold">CreditRestorePro</span>
          </Link>
          <Link href="/" className="text-zinc-400 hover:text-white text-sm">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Progress */}
      <div className="border-b border-zinc-800 py-4">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex justify-between">
            {steps.map((s) => (
              <div 
                key={s.num}
                className={`flex items-center gap-2 ${step >= s.num ? 'text-emerald-400' : 'text-zinc-600'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step > s.num ? 'bg-emerald-500 text-black' : 
                  step === s.num ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-400' : 
                  'bg-zinc-800 text-zinc-500'
                }`}>
                  {step > s.num ? '✓' : s.num}
                </div>
                <span className="hidden sm:inline text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Your Information</h2>
            <p className="text-zinc-400">Enter your personal details for the letter.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Street Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm mb-2">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    placeholder="Detroit"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    placeholder="MI"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2">ZIP</label>
                  <input
                    type="text"
                    value={formData.zip}
                    onChange={(e) => updateField('zip', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                    placeholder="48201"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!formData.fullName || !formData.address}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-4 rounded-xl transition-colors mt-8"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Debt Details */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Debt Information</h2>
            <p className="text-zinc-400">Enter the details of the negative item you want to dispute.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">Creditor / Collection Agency Name</label>
                <input
                  type="text"
                  value={formData.creditorName}
                  onChange={(e) => updateField('creditorName', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="Midland Credit Management"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Account Number (if known)</label>
                <input
                  type="text"
                  value={formData.accountNumber}
                  onChange={(e) => updateField('accountNumber', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="Account # (or leave blank)"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Debt Amount</label>
                <input
                  type="text"
                  value={formData.debtAmount}
                  onChange={(e) => updateField('debtAmount', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                  placeholder="$2,500"
                />
              </div>
              <div>
                <label className="block text-sm mb-2">Bureau</label>
                <select
                  value={formData.bureau}
                  onChange={(e) => updateField('bureau', e.target.value as FormData['bureau'])}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Bureaus</option>
                  <option value="experian">Experian</option>
                  <option value="equifax">Equifax</option>
                  <option value="transunion">TransUnion</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-2">Credit Report Date (optional)</label>
                <input
                  type="date"
                  value={formData.reportDate}
                  onChange={(e) => updateField('reportDate', e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-zinc-700 hover:border-zinc-600 py-4 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!formData.creditorName}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-4 rounded-xl transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Letter Type */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Choose Letter Type</h2>
            <p className="text-zinc-400">Select the type of dispute letter you need.</p>
            
            <div className="space-y-3">
              {[
                { id: 'validation', label: '🗂️ Debt Validation', desc: 'Request proof the debt is yours. If they can\'t verify, it must be removed.' },
                { id: 'fcra', label: '📢 FCRA Dispute', desc: 'Challenge inaccurate bureau reporting. Force them to investigate.' },
                { id: 'fdcpa', label: '🚫 Cease & Desist', desc: 'Stop collection calls immediately. Legal requirement for collectors.' },
                { id: 'goodwill', label: '🤝 Goodwill Letter', desc: 'Request deletion after paying. Works for old accounts.' },
                { id: 'packet', label: '⚖️ Affidavit + Case Law Packet', desc: 'Build a litigation-style packet with affidavit, legal notice, MOV demand, and checklist.' }
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => updateField('letterType', type.id as LetterType)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    formData.letterType === type.id 
                      ? 'border-emerald-500 bg-emerald-500/10' 
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="text-sm text-zinc-400">{type.desc}</div>
                </button>
              ))}
            </div>

            {formData.letterType === 'packet' && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mt-4">
                <label className="block text-sm mb-2">Primary Dispute Basis</label>
                <select
                  value={formData.disputeReason}
                  onChange={(e) => updateField('disputeReason', e.target.value as FormData['disputeReason'])}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="inaccurate_reporting">Inaccurate Reporting</option>
                  <option value="identity_theft">Identity Theft</option>
                  <option value="not_mine">Not My Account</option>
                  <option value="paid_not_updated">Paid But Not Updated</option>
                </select>
              </div>
            )}

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-zinc-700 hover:border-zinc-600 py-4 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={generateLetter}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-4 rounded-xl transition-colors"
              >
                {formData.letterType === 'packet' ? 'Generate Packet' : 'Generate Letter'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Download */}
        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Your {formData.letterType === 'packet' ? 'Packet' : 'Letter'} is Ready!</h2>
            <p className="text-zinc-400">Review and download your {formData.letterType === 'packet' ? 'packet' : 'letter'} below.</p>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono">{generatedLetter}</pre>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex-1 border border-zinc-700 hover:border-zinc-600 py-4 rounded-xl transition-colors"
              >
                Edit
              </button>
              <button
                onClick={downloadPDF}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-bold py-4 rounded-xl transition-colors"
              >
                Download PDF
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mt-6">
              <h4 className="font-semibold text-emerald-400 mb-2">📮 Next Steps</h4>
              {formData.letterType === 'packet' ? (
                <ul className="text-sm text-zinc-300 space-y-1">
                  <li>• Print packet + exhibits index</li>
                  <li>• Sign affidavit (notarize if possible)</li>
                  <li>• Attach ID, utility bill, and any proof docs</li>
                  <li>• Send to bureau/furnisher via certified mail + return receipt</li>
                  <li>• Log tracking numbers and response deadlines (15/30/45 days)</li>
                </ul>
              ) : (
                <ul className="text-sm text-zinc-400 space-y-1">
                  <li>• Print this letter</li>
                  <li>• Sign it</li>
                  <li>• Send via certified mail with return receipt</li>
                  <li>• Keep a copy for your records</li>
                </ul>
              )}
            </div>

            <Link href="/" className="block text-center text-zinc-500 hover:text-white mt-4">
              Generate Another Letter →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
