// ═══════════════════════════════════════════════════════════
// lib/aiPrivacy.ts — Client-side privacy minimization helpers
// Derives broad anonymized tiers and seasons from exact data
// ═══════════════════════════════════════════════════════════

export function deriveClientBudgetBand(budgetTotal?: number): string {
  if (budgetTotal === undefined || budgetTotal === null) return 'Budget Tier: Flexible'
  if (budgetTotal < 100_000) return 'Under ₹1 Lakh (Modest)'
  if (budgetTotal < 500_000) return '₹1 Lakh - ₹5 Lakhs (Pocket-friendly)'
  if (budgetTotal < 1_500_000) return '₹5 Lakhs - ₹15 Lakhs (Mid-range)'
  if (budgetTotal < 5_000_000) return '₹15 Lakhs - ₹50 Lakhs (Premium)'
  return '₹50 Lakhs+ (Grand/Luxury)'
}

export function deriveClientSeason(dateStr?: string): string {
  if (!dateStr) return 'Flexible timing'
  const match = dateStr.match(/^\d{4}-(\d{2})-\d{2}$/)
  if (!match) return 'Flexible timing'
  const month = parseInt(match[1], 10)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const mName = monthNames[month - 1] || ''
  if (month === 12 || month === 1 || month === 2) return `Winter (${mName})`
  if (month >= 3 && month <= 5) return `Summer/Spring (${mName})`
  if (month >= 6 && month <= 9) return `Monsoon (${mName})`
  return `Autumn/Post-Monsoon (${mName})`
}
